// src/components/TimerPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

// 🛠️ FIX GLOBAL: Audio Context para evitar bloqueos en móviles
let globalAudioCtx = null;
const getAudioContext = () => {
    if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
    }
    return globalAudioCtx;
};

export default function TimerPage({ onBack, styles }) {
    // --- ESTADO DE RESPONSIVIDAD ---
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- SCREEN WAKE LOCK API (Evita que el móvil se apague) ---
    const wakeLockRef = useRef(null);

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.log('Wake Lock error:', err);
        }
    };

    const releaseWakeLock = async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        } catch (err) {
            console.log('Wake Lock release error:', err);
        }
    };

    useEffect(() => {
        return () => {
            releaseWakeLock();
        };
    }, []);

    // --- ESTADOS GENERALES Y DE PREPARACIÓN ---
    const [isCasualMode, setIsCasualMode] = useState(true);
    const [isPreparing, setIsPreparing] = useState(false);
    const [prepTimeLeft, setPrepTimeLeft] = useState(3);
    const prepInterval = useRef(null);
    const [prepMode, setPrepMode] = useState(null); // 'casual' | 'match'

    // --- BLOQUE 1: CASUAL TIMER ---
    const [duration, setDuration] = useState(300); // 5 min por defecto
    const [repetitions, setRepetitions] = useState(3);
    const [rest, setRest] = useState(60); // 60s descanso
    const [isCasualRunning, setIsCasualRunning] = useState(false);
    const [casualTimeLeft, setCasualTimeLeft] = useState(300);
    const [currentRepetition, setCurrentRepetition] = useState(0);
    const [isRestPhase, setIsRestPhase] = useState(false);
    const casualTimerInterval = useRef(null);

    // --- BLOQUE 2: COMPETITION TIMER ---
    const [competitor1Name, setCompetitor1Name] = useState('');
    const [competitor2Name, setCompetitor2Name] = useState('');
    const [matchDuration, setMatchDuration] = useState(300); // 5 min
    const [matchRounds, setMatchRounds] = useState(1);
    const [warmupTime, setWarmupTime] = useState(0);
    const [isMatchRunning, setIsMatchRunning] = useState(false);
    const [matchTimeLeft, setMatchTimeLeft] = useState(300);
    
    // Puntuaciones IBJJF Oficiales
    const [score1, setScore1] = useState(0);
    const [advantage1, setAdvantage1] = useState(0);
    const [penalty1, setPenalty1] = useState(0);
    
    const [score2, setScore2] = useState(0);
    const [advantage2, setAdvantage2] = useState(0);
    const [penalty2, setPenalty2] = useState(0);

    const [currentMatchRound, setCurrentMatchRound] = useState(0);
    const [winner, setWinner] = useState('');
    const [isWarmupPhase, setIsWarmupPhase] = useState(false);
    const matchTimerInterval = useRef(null);

    // --- FEEDBACK ACÚSTICO Y TÁCTIL ---
    const playSound = (type) => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (type === 'beep') {
                osc.frequency.value = 440;
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'start') {
                osc.frequency.value = 880;
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } else if (type === 'end') {
                osc.frequency.value = 300;
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 1.0);
            } else if (type === 'warning') {
                osc.frequency.value = 600;
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            }
        } catch (error) {
            console.log('Error audio:', error);
        }
    };

    const triggerVibration = (pattern) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // ==========================================
    // EFECTOS Y CONTROL DE TIEMPO
    // ==========================================
    useEffect(() => {
        if (isPreparing) {
            prepInterval.current = setInterval(() => {
                setPrepTimeLeft((prev) => {
                    if (prev > 1) {
                        playSound('beep');
                        triggerVibration([50]);
                        return prev - 1;
                    }
                    clearInterval(prepInterval.current);
                    playSound('start');
                    triggerVibration([500]);
                    setIsPreparing(false);

                    requestWakeLock(); // Activa Wake Lock al iniciar

                    if (prepMode === 'casual') setIsCasualRunning(true);
                    if (prepMode === 'match') setIsMatchRunning(true);
                    return 0;
                });
            }, 1000);
        } else {
            clearInterval(prepInterval.current);
        }
        return () => clearInterval(prepInterval.current);
    }, [isPreparing, prepMode]);

    // Motor Casual
    useEffect(() => {
        if (isCasualRunning) {
            casualTimerInterval.current = setInterval(() => {
                setCasualTimeLeft((prev) => {
                    if (prev === 11) {
                        playSound('warning');
                        triggerVibration([100, 50, 100]);
                    }
                    if (prev > 0) return prev - 1;

                    clearInterval(casualTimerInterval.current);
                    playSound('end');
                    triggerVibration([500, 200, 500]);

                    if (isRestPhase) {
                        setIsRestPhase(false);
                        if (currentRepetition < repetitions) {
                            setCurrentRepetition(r => r + 1);
                            setCasualTimeLeft(duration);
                        } else {
                            setIsCasualRunning(false);
                            releaseWakeLock();
                        }
                    } else {
                        if (currentRepetition < repetitions && rest > 0) {
                            setIsRestPhase(true);
                            setCasualTimeLeft(rest);
                        } else if (currentRepetition < repetitions && rest === 0) {
                            setCurrentRepetition(r => r + 1);
                            setCasualTimeLeft(duration);
                        } else {
                            setIsCasualRunning(false);
                            releaseWakeLock();
                        }
                    }
                    return 0;
                });
            }, 1000);
        } else {
            clearInterval(casualTimerInterval.current);
        }
        return () => clearInterval(casualTimerInterval.current);
    }, [isCasualRunning, isRestPhase, duration, repetitions, rest, currentRepetition]);

    // Motor Competición
    useEffect(() => {
        if (isMatchRunning) {
            matchTimerInterval.current = setInterval(() => {
                setMatchTimeLeft((prev) => {
                    if (prev === 11) {
                        playSound('warning');
                        triggerVibration([100, 50, 100]);
                    }
                    if (prev > 0) return prev - 1;

                    clearInterval(matchTimerInterval.current);
                    playSound('end');
                    triggerVibration([500, 200, 500, 200, 500]);

                    if (isWarmupPhase) {
                        setIsWarmupPhase(false);
                        setCurrentMatchRound(1);
                        setMatchTimeLeft(matchDuration);
                        setIsMatchRunning(false);
                        setTimeout(() => setIsMatchRunning(true), 100);
                    } else {
                        if (currentMatchRound < matchRounds) {
                            setCurrentMatchRound(r => r + 1);
                            setMatchTimeLeft(matchDuration);
                            setIsMatchRunning(false);
                            setTimeout(() => setIsMatchRunning(true), 100);
                        } else {
                            setIsMatchRunning(false);
                            releaseWakeLock();
                            designateWinner();
                        }
                    }
                    return 0;
                });
            }, 1000);
        } else {
            clearInterval(matchTimerInterval.current);
        }
        return () => clearInterval(matchTimerInterval.current);
    }, [isMatchRunning, isWarmupPhase, matchDuration, matchRounds, currentMatchRound]);

    // ==========================================
    // CONTROLES
    // ==========================================
    const startCasualTimer = () => {
        if (isCasualRunning || isPreparing) return;
        getAudioContext();
        if (currentRepetition === 0) {
            setCurrentRepetition(1);
            setCasualTimeLeft(duration);
            setIsRestPhase(false);
        }
        setPrepMode('casual');
        setPrepTimeLeft(3);
        setIsPreparing(true);
        playSound('beep');
        triggerVibration([50]);
    };

    const pauseCasualTimer = () => {
        setIsPreparing(false);
        setIsCasualRunning(false);
        releaseWakeLock();
    };

    const resetCasualTimer = () => {
        setIsPreparing(false);
        setIsCasualRunning(false);
        setCasualTimeLeft(duration);
        setCurrentRepetition(0);
        setIsRestPhase(false);
        releaseWakeLock();
    };

    const startMatchTimer = () => {
        if (isMatchRunning || isPreparing) return;
        getAudioContext();
        setWinner('');
        if (currentMatchRound === 0) {
            if (warmupTime > 0 && !isWarmupPhase) {
                setIsWarmupPhase(true);
                setMatchTimeLeft(warmupTime);
            } else {
                setIsWarmupPhase(false);
                setCurrentMatchRound(1);
                setMatchTimeLeft(matchDuration);
            }
        }
        setPrepMode('match');
        setPrepTimeLeft(3);
        setIsPreparing(true);
        playSound('beep');
        triggerVibration([50]);
    };

    const pauseMatchTimer = () => {
        setIsPreparing(false);
        setIsMatchRunning(false);
        releaseWakeLock();
    };

    const resetMatchTimer = () => {
        setIsPreparing(false);
        setIsMatchRunning(false);
        setMatchTimeLeft(matchDuration);
        setScore1(0); setAdvantage1(0); setPenalty1(0);
        setScore2(0); setAdvantage2(0); setPenalty2(0);
        setCurrentMatchRound(0);
        setWinner('');
        setIsWarmupPhase(false);
        releaseWakeLock();
    };

    // Manejo de Puntuación IBJJF
    const updateScore = (p, pts) => p === 1 ? setScore1(s => Math.max(0, s + pts)) : setScore2(s => Math.max(0, s + pts));
    const updateAdvantage = (p, adv) => p === 1 ? setAdvantage1(a => Math.max(0, a + adv)) : setAdvantage2(a => Math.max(0, a + adv));
    const updatePenalty = (p, pen) => p === 1 ? setPenalty1(pn => Math.max(0, pn + pen)) : setPenalty2(pn => Math.max(0, pn + pen));

    // Finalizar por Sumisión / Descalificación (Detienen el reloj inmediatamente)
    const declareSubmissionWinner = (competitorNum) => {
        setIsMatchRunning(false);
        setIsPreparing(false);
        releaseWakeLock();
        const name1 = competitor1Name.trim() || 'Atleta 1';
        const name2 = competitor2Name.trim() || 'Atleta 2';
        setWinner(competitorNum === 1 ? `${name1} (Sumisión)` : `${name2} (Sumisión)`);
    };

    const declareDisqualificationWinner = (disqualifiedNum) => {
        setIsMatchRunning(false);
        setIsPreparing(false);
        releaseWakeLock();
        const name1 = competitor1Name.trim() || 'Atleta 1';
        const name2 = competitor2Name.trim() || 'Atleta 2';
        if (disqualifiedNum === 1) {
            setWinner(`${name2} (por DQ de ${name1})`);
        } else {
            setWinner(`${name1} (por DQ de ${name2})`);
        }
    };

    const designateWinner = () => {
        setIsMatchRunning(false);
        setIsPreparing(false);
        releaseWakeLock();
        let w = '';
        const name1 = competitor1Name.trim() || 'Atleta 1';
        const name2 = competitor2Name.trim() || 'Atleta 2';

        if (score1 !== score2) {
            w = score1 > score2 ? name1 : name2;
        } else if (advantage1 !== advantage2) {
            w = advantage1 > advantage2 ? name1 : name2;
        } else if (penalty1 !== penalty2) {
            w = penalty1 < penalty2 ? name1 : name2;
        } else {
            w = 'Empate Técnico';
        }
        setWinner(w);
    };

    const puntosBloqueados = !isMatchRunning || isWarmupPhase || isPreparing;

    // Interceptor de Salida
    const handleBack = async () => {
        const actividad = isCasualMode
            ? (isCasualRunning || currentRepetition > 0 || casualTimeLeft !== duration)
            : (isMatchRunning || currentMatchRound > 0 || score1 > 0 || score2 > 0);

        if (isPreparing || actividad) {
            const res = await Swal.fire({
                text: "¿Salir del temporizador? Los datos actuales se perderán.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff4444',
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                background: '#0a0a0a',
                color: '#fff',
                iconColor: '#d4af37',
                customClass: { popup: 'gold-border-alert' }
            });
            if (!res.isConfirmed) return;
        }

        releaseWakeLock();
        clearInterval(prepInterval.current);
        clearInterval(casualTimerInterval.current);
        clearInterval(matchTimerInterval.current);
        onBack();
    };

    // Estilos internos optimizados
    const localStyles = {
        timerContainer: { backgroundColor: '#111', padding: esMovil ? '15px 8px' : '25px', borderRadius: '12px', border: '1px solid #333', marginTop: '15px', textAlign: 'center', width: '100%', boxSizing: 'border-box' },
        flexCenter: { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '15px' },
        inputGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: esMovil ? '1 1 45%' : '0 1 auto' },
        label: { color: '#aaa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' },
        input: { backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', width: '100%', maxWidth: '110px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' },
        competitorCard: { backgroundColor: '#0a0a0a', border: '1px solid #d4af37', padding: '12px', borderRadius: '8px', flex: '1 1 260px', minWidth: '0', boxSizing: 'border-box' },
        scoreBtn: { backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', margin: '2px', flex: '1 1 30%', transition: 'all 0.15s ease' },
        scoreBtnDisabled: { backgroundColor: '#111', color: '#444', border: '1px solid #222', cursor: 'not-allowed', padding: '6px 8px', borderRadius: '4px', fontSize: '0.75rem', margin: '2px', flex: '1 1 30%' },
        statText: { fontSize: esMovil ? '1.3rem' : '1.6rem', margin: '2px 0', fontWeight: 'bold' },
        bigTime: { fontSize: esMovil ? '3.2rem' : '4.8rem', fontWeight: 'bold', color: '#d4af37', textShadow: '0px 0px 15px rgba(212, 175, 55, 0.3)', margin: '15px 0', lineHeight: '1' }
    };

    return (
        <div style={{
            paddingTop: `calc(env(safe-area-inset-top, 0px) + ${esMovil ? '12px' : '25px'})`,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${esMovil ? '20px' : '30px'})`,
            paddingLeft: `calc(env(safe-area-inset-left, 0px) + ${esMovil ? '12px' : '25px'})`,
            paddingRight: `calc(env(safe-area-inset-right, 0px) + ${esMovil ? '12px' : '25px'})`,
            minHeight: '100vh', backgroundColor: '#000', color: '#fff', boxSizing: 'border-box', width: '100%', overflowX: 'hidden'
        }}>
            <div style={{ maxWidth: '950px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <button onClick={handleBack} style={{ ...(styles?.btnOutline || {}), width: 'auto', marginBottom: '15px', padding: '8px 14px', borderColor: '#d4af37', color: '#d4af37', cursor: 'pointer' }}>
                    ← {esMovil ? '' : 'VOLVER'}
                </button>

                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ ...(styles?.goldTitle || {}), fontSize: esMovil ? '1.1rem' : '1.6rem', letterSpacing: '2px', margin: '0 0 15px 0' }}>
                        CENTRO DE CRONOMETRAJE 🥋
                    </h2>

                    {/* SELECTOR DE MODO (Preserva el estado de la partida al alternar pestañas) */}
                    <div style={localStyles.flexCenter}>
                        <button onClick={() => setIsCasualMode(true)} style={isCasualMode ? { ...(styles?.btnGold || {}), flex: '1', padding: '10px' } : { ...(styles?.btnOutline || {}), flex: '1', padding: '10px', borderColor: '#444', color: '#888' }}>
                            CASUAL
                        </button>
                        <button onClick={() => setIsCasualMode(false)} style={!isCasualMode ? { ...(styles?.btnGold || {}), flex: '1', padding: '10px' } : { ...(styles?.btnOutline || {}), flex: '1', padding: '10px', borderColor: '#444', color: '#888' }}>
                            COMPETICIÓN
                        </button>
                    </div>

                    {/* ================= MODO CASUAL ================= */}
                    {isCasualMode && (
                        <div style={localStyles.timerContainer}>
                            <div style={localStyles.flexCenter}>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Duración Min</span>
                                    <select style={localStyles.input} value={Math.floor(duration / 60)} onChange={(e) => { setDuration(e.target.value * 60); if (!isCasualRunning && currentRepetition === 0) setCasualTimeLeft(e.target.value * 60); }}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(m => <option key={m} value={m}>{m} min</option>)}
                                    </select>
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Rondas</span>
                                    <input style={localStyles.input} type="number" min="1" max="50" value={repetitions} onChange={(e) => { setRepetitions(Number(e.target.value)); if (!isCasualRunning) setCurrentRepetition(0); }} />
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Descanso (s)</span>
                                    <input style={localStyles.input} type="number" min="0" max="300" value={rest} onChange={(e) => setRest(Number(e.target.value))} />
                                </div>
                            </div>

                            <div style={localStyles.bigTime}>
                                {isPreparing ? (
                                    <span style={{ color: '#ffcc00' }}>PREP: {prepTimeLeft}</span>
                                ) : isRestPhase ? (
                                    <span style={{ color: '#ff4444' }}>DESCANSO: {formatTime(casualTimeLeft)}</span>
                                ) : (
                                    formatTime(casualTimeLeft)
                                )}
                            </div>

                            {!isPreparing && (
                                <p style={{ fontSize: '1rem', color: '#aaa', margin: '5px 0' }}>
                                    Ronda: <span style={{ color: '#d4af37', fontWeight: 'bold' }}>{currentRepetition > 0 ? currentRepetition : 1} / {repetitions}</span>
                                </p>
                            )}

                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                {!isCasualRunning && !isPreparing ? (
                                    <button style={{ ...(styles?.btnGold || {}), flex: '1', maxWidth: '180px', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={startCasualTimer}>INICIAR</button>
                                ) : (
                                    <button style={{ ...(styles?.btnOutline || {}), flex: '1', maxWidth: '180px', padding: '12px', color: '#ff4444', borderColor: '#ff4444', fontWeight: 'bold', cursor: 'pointer' }} onClick={pauseCasualTimer}>PAUSAR</button>
                                )}
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1', maxWidth: '180px', padding: '12px', borderColor: '#555', color: '#aaa', cursor: 'pointer' }} onClick={resetCasualTimer}>REINICIAR</button>
                            </div>
                        </div>
                    )}

                    {/* ================= MODO COMPETICIÓN ================= */}
                    {!isCasualMode && (
                        <div style={localStyles.timerContainer}>
                            <div style={localStyles.flexCenter}>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Combate (Min)</span>
                                    <select style={localStyles.input} value={Math.floor(matchDuration / 60)} onChange={(e) => { setMatchDuration(e.target.value * 60); if (!isMatchRunning && currentMatchRound === 0 && !isWarmupPhase) setMatchTimeLeft(e.target.value * 60); }}>
                                        {[2, 3, 4, 5, 6, 7, 8, 10].map(m => <option key={m} value={m}>{m} min</option>)}
                                    </select>
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Calentamiento (s)</span>
                                    <input style={localStyles.input} type="number" min="0" max="120" value={warmupTime} onChange={(e) => setWarmupTime(Number(e.target.value))} />
                                </div>
                            </div>

                            <div style={localStyles.bigTime}>
                                {isPreparing ? (
                                    <span style={{ color: '#ffcc00' }}>PREP: {prepTimeLeft}</span>
                                ) : isWarmupPhase ? (
                                    <span style={{ color: '#aaa', fontSize: esMovil ? '2.2rem' : '3.5rem' }}>CALENTAMIENTO: {formatTime(matchTimeLeft)}</span>
                                ) : (
                                    formatTime(matchTimeLeft)
                                )}
                            </div>

                            {winner && <h3 style={{ color: '#4CAF50', fontSize: '1.4rem', margin: '10px 0', textTransform: 'uppercase' }}>🏆 GANADOR: {winner} 🏆</h3>}

                            {/* PANELES DE ATLETAS Y PUNTUACIÓN REGLAS IBJJF */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '15px' }}>
                                
                                {/* ATLETA 1 */}
                                <div style={localStyles.competitorCard}>
                                    <input style={{ ...localStyles.input, width: '100%', maxWidth: '100%', marginBottom: '10px', fontSize: '1rem', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #d4af37', color: '#d4af37', fontWeight: 'bold' }} value={competitor1Name} onChange={(e) => setCompetitor1Name(e.target.value)} placeholder="Atleta Azul / Esquina 1" />
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '12px', alignItems: 'center', backgroundColor: '#111', padding: '8px', borderRadius: '6px' }}>
                                        <div><span style={localStyles.label}>PTS</span><div style={{ ...localStyles.statText, color: '#4CAF50' }}>{score1}</div></div>
                                        <div><span style={localStyles.label}>ADV</span><div style={{ ...localStyles.statText, color: '#d4af37' }}>{advantage1}</div></div>
                                        <div><span style={localStyles.label}>PEN</span><div style={{ ...localStyles.statText, color: '#ff4444' }}>{penalty1}</div></div>
                                    </div>

                                    {/* Botones Compactos de Puntuación */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 2)}>Derribo (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 3)}>Pase (+3)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 4)}>Montada (+4)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 2)}>Rodilla (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateAdvantage(1, 1)}>Ventaja (+1)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updatePenalty(1, 1)}>Castigo (+1)</button>
                                    </div>

                                    {/* Botones de Finalización Inmediata (Sumisión / DQ) */}
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : { ...localStyles.scoreBtn, backgroundColor: '#1b4d3e', color: '#4CAF50', borderColor: '#4CAF50', flex: '1' }} onClick={() => declareSubmissionWinner(1)}>Sumisión 🏆</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : { ...localStyles.scoreBtn, backgroundColor: '#4a1515', color: '#ff4444', borderColor: '#ff4444', flex: '1' }} onClick={() => declareDisqualificationWinner(1)}>DQ ❌</button>
                                    </div>
                                </div>

                                {/* ATLETA 2 */}
                                <div style={localStyles.competitorCard}>
                                    <input style={{ ...localStyles.input, width: '100%', maxWidth: '100%', marginBottom: '10px', fontSize: '1rem', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #d4af37', color: '#d4af37', fontWeight: 'bold' }} value={competitor2Name} onChange={(e) => setCompetitor2Name(e.target.value)} placeholder="Atleta Blanco / Esquina 2" />
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '12px', alignItems: 'center', backgroundColor: '#111', padding: '8px', borderRadius: '6px' }}>
                                        <div><span style={localStyles.label}>PTS</span><div style={{ ...localStyles.statText, color: '#4CAF50' }}>{score2}</div></div>
                                        <div><span style={localStyles.label}>ADV</span><div style={{ ...localStyles.statText, color: '#d4af37' }}>{advantage2}</div></div>
                                        <div><span style={localStyles.label}>PEN</span><div style={{ ...localStyles.statText, color: '#ff4444' }}>{penalty2}</div></div>
                                    </div>

                                    {/* Botones Compactos de Puntuación */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 2)}>Derribo (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 3)}>Pase (+3)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 4)}>Montada (+4)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 2)}>Rodilla (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateAdvantage(2, 1)}>Ventaja (+1)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updatePenalty(2, 1)}>Castigo (+1)</button>
                                    </div>

                                    {/* Botones de Finalización Inmediata (Sumisión / DQ) */}
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : { ...localStyles.scoreBtn, backgroundColor: '#1b4d3e', color: '#4CAF50', borderColor: '#4CAF50', flex: '1' }} onClick={() => declareSubmissionWinner(2)}>Sumisión 🏆</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : { ...localStyles.scoreBtn, backgroundColor: '#4a1515', color: '#ff4444', borderColor: '#ff4444', flex: '1' }} onClick={() => declareDisqualificationWinner(2)}>DQ ❌</button>
                                    </div>
                                </div>

                            </div>

                            {/* CONTROLES DE COMPETICIÓN */}
                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {!isMatchRunning && !isPreparing ? (
                                    <button style={{ ...(styles?.btnGold || {}), flex: '1 1 130px', padding: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={startMatchTimer}>▶ INICIAR</button>
                                ) : (
                                    <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 130px', padding: '12px', color: '#ff4444', borderColor: '#ff4444', fontWeight: 'bold', cursor: 'pointer' }} onClick={pauseMatchTimer}>⏸ PAUSAR</button>
                                )}
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 100px', padding: '12px', borderColor: '#555', color: '#aaa', cursor: 'pointer' }} onClick={resetMatchTimer}>REINICIAR</button>
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 100px', padding: '12px', borderColor: '#4CAF50', color: '#4CAF50', fontWeight: 'bold', cursor: 'pointer' }} onClick={designateWinner}>FINALIZAR</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}