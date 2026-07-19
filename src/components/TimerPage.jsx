// src/components/TimerPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

// 🛠️ FIX GLOBAL: Evita el Memory Leak y el bloqueo de audio en móviles
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
    // ==========================================
    // ESTADO DE RESPONSIVIDAD (MÓVIL)
    // ==========================================
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ==========================================
    // ESTADO GENERAL Y DE PREPARACIÓN
    // ==========================================
    const [isCasualMode, setIsCasualMode] = useState(true);
    const [isPreparing, setIsPreparing] = useState(false);
    const [prepTimeLeft, setPrepTimeLeft] = useState(3);
    const [prepMode, setPrepMode] = useState(null); // 'casual' | 'match'
    const prepInterval = useRef(null);

    // ==========================================
    // BLOQUE 1: ESTADOS DEL CASUAL TIMER
    // ==========================================
    const [duration, setDuration] = useState(60); // Segundos
    const [repetitions, setRepetitions] = useState(1);
    const [rest, setRest] = useState(0); // Segundos
    const [isCasualRunning, setIsCasualRunning] = useState(false);
    const [casualTimeLeft, setCasualTimeLeft] = useState(60);
    const [currentRepetition, setCurrentRepetition] = useState(0);
    const [isRestPhase, setIsRestPhase] = useState(false);
    const casualTimerInterval = useRef(null);

    // ==========================================
    // BLOQUE 2: ESTADOS DEL COMPETITION TIMER
    // ==========================================
    const [competitor1Name, setCompetitor1Name] = useState('');
    const [competitor2Name, setCompetitor2Name] = useState('');
    const [matchDuration, setMatchDuration] = useState(300); // 5 min
    const [matchRounds, setMatchRounds] = useState(1);
    const [warmupTime, setWarmupTime] = useState(0);
    const [isMatchRunning, setIsMatchRunning] = useState(false);
    const [matchTimeLeft, setMatchTimeLeft] = useState(300);
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

    // ==========================================
    // FUNCIONES DE FEEDBACK (AUDIO Y VIBRACIÓN)
    // ==========================================
    const playSound = (type) => {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (type === 'beep') { // Cuenta regresiva
                osc.frequency.value = 440;
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'start') { // ¡COMBATE INICIA!
                osc.frequency.value = 880;
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } else if (type === 'end') { // FIN DE RONDA O DESCANSO
                osc.frequency.value = 300;
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 1.0);
            } else if (type === 'warning') { // AVISO 10 SEGUNDOS
                osc.frequency.value = 600;
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            }
        } catch (error) {
            console.log('Error reproduciendo audio:', error);
        }
    };

    const triggerVibration = (pattern) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    // ==========================================
    // FUNCIÓN UTILITARIA
    // ==========================================
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    // ==========================================
    // EFECTOS (TICK DE LOS RELOJES)
    // ==========================================

    // 1. Efecto: Fase de Preparación
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

    // 2. Efecto Casual
    useEffect(() => {
        if (isCasualRunning) {
            casualTimerInterval.current = setInterval(() => {
                setCasualTimeLeft(prevTime => {
                    if (prevTime === 11) {
                        playSound('warning');
                        triggerVibration([100, 50, 100]);
                    }

                    if (prevTime > 0) return prevTime - 1;

                    clearInterval(casualTimerInterval.current);
                    playSound('end');
                    triggerVibration([500, 200, 500]);

                    if (isRestPhase) {
                        setIsRestPhase(false);
                        if (currentRepetition < repetitions) {
                            setCurrentRepetition(prev => prev + 1);
                            setCasualTimeLeft(duration);
                        } else {
                            setIsCasualRunning(false);
                        }
                    } else {
                        if (currentRepetition < repetitions && rest > 0) {
                            setIsRestPhase(true);
                            setCasualTimeLeft(rest);
                        } else if (currentRepetition < repetitions && rest === 0) {
                            setCurrentRepetition(prev => prev + 1);
                            setCasualTimeLeft(duration);
                        } else {
                            setIsCasualRunning(false);
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

    // 3. Efecto Competición
    useEffect(() => {
        if (isMatchRunning) {
            matchTimerInterval.current = setInterval(() => {
                setMatchTimeLeft((prevTime) => {
                    if (prevTime === 11) {
                        playSound('warning');
                        triggerVibration([100, 50, 100]);
                    }

                    if (prevTime > 0) return prevTime - 1;

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
                            setCurrentMatchRound(prev => prev + 1);
                            setMatchTimeLeft(matchDuration);
                            setIsMatchRunning(false);
                            setTimeout(() => setIsMatchRunning(true), 100);
                        } else {
                            setIsMatchRunning(false);
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
    // CONTROLES CASUAL
    // ==========================================
    const startCasualTimer = () => {
        if (isCasualRunning || isPreparing) return;
        getAudioContext(); // 🛠️ FIX: Desbloquea el audio en el primer click táctil

        if (currentRepetition === 0) {
            setCurrentRepetition(1);
            setCasualTimeLeft(duration);
            setIsRestPhase(false);
        } else if (casualTimeLeft === 0) {
            setCasualTimeLeft(isRestPhase ? rest : duration);
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
    };

    const resetCasualTimer = () => {
        setIsPreparing(false);
        setIsCasualRunning(false);
        setCasualTimeLeft(duration);
        setCurrentRepetition(0);
        setIsRestPhase(false);
    };

    // ==========================================
    // CONTROLES COMPETICIÓN
    // ==========================================
    const startMatchTimer = () => {
        if (isMatchRunning || isPreparing) return;
        getAudioContext(); // 🛠️ FIX: Desbloquea el audio
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
    };

    const updateScore = (p, pts) => p === 1 ? setScore1(s => s + pts) : setScore2(s => s + pts);
    const updateAdvantage = (p, adv) => p === 1 ? setAdvantage1(a => a + adv) : setAdvantage2(a => a + adv);
    const updatePenalty = (p, pen) => p === 1 ? setPenalty1(pn => pn + pen) : setPenalty2(pn => pn + pen);

    const designateWinner = () => {
        let w = '';
        if (score1 !== score2) w = score1 > score2 ? competitor1Name || 'Competidor 1' : competitor2Name || 'Competidor 2';
        else if (advantage1 !== advantage2) w = advantage1 > advantage2 ? competitor1Name || 'Competidor 1' : competitor2Name || 'Competidor 2';
        else if (penalty1 !== penalty2) w = penalty1 < penalty2 ? competitor1Name || 'Competidor 1' : competitor2Name || 'Competidor 2';
        else w = 'Empate';
        setWinner(w);
    };

    const puntosBloqueados = !isMatchRunning || isWarmupPhase || isPreparing;

    // ==========================================
    // INTERCEPTOR DE SALIDA (SWEETALERT2)
    // ==========================================
    const handleBack = async () => {
        const hayActividadCasual = isCasualMode &&
            (isCasualRunning || currentRepetition > 0 || casualTimeLeft !== duration);

        const hayActividadMatch = !isCasualMode &&
            (isMatchRunning || currentMatchRound > 0 || matchTimeLeft !== matchDuration ||
                score1 > 0 || score2 > 0 || advantage1 > 0 || advantage2 > 0 || penalty1 > 0 || penalty2 > 0);

        if (isPreparing || hayActividadCasual || hayActividadMatch) {
            const result = await Swal.fire({
                text: "¿Seguro que quieres salir? El temporizador y los puntos se perderán.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff4444', 
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                background: '#0a0a0a',
                color: '#fff',
                iconColor: '#ffcc00', 
                customClass: { popup: 'gold-border-alert' }
            });

            if (!result.isConfirmed) return;
        }

        clearInterval(prepInterval.current);
        clearInterval(casualTimerInterval.current);
        clearInterval(matchTimerInterval.current);
        onBack();
    };

    // ==========================================
    // ESTILOS LOCALES (RESPONSIVOS)
    // ==========================================
    const localStyles = {
        timerContainer: { 
            backgroundColor: '#111', 
            padding: esMovil ? '20px 10px' : '30px', 
            borderRadius: '12px', 
            border: '1px solid #333', 
            marginTop: '20px', 
            textAlign: 'center',
            boxSizing: 'border-box',
            width: '100%'
        },
        flexCenter: { display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' },
        inputGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: esMovil ? '1 1 45%' : '0 1 auto' },
        label: { color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' },
        input: { backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '10px', borderRadius: '4px', width: '100%', maxWidth: '120px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' },
        competitorCard: { backgroundColor: '#0a0a0a', border: '1px solid #d4af37', padding: '15px', borderRadius: '8px', flex: '1 1 280px', minWidth: '0', boxSizing: 'border-box' },
        scoreBtn: { backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: esMovil ? '6px 8px' : '8px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: esMovil ? '0.75rem' : '0.85rem', margin: '4px', flex: '1 1 30%' },
        scoreBtnDisabled: { backgroundColor: '#111', color: '#444', border: '1px solid #222', cursor: 'not-allowed', padding: esMovil ? '6px 8px' : '8px 12px', borderRadius: '4px', fontSize: esMovil ? '0.75rem' : '0.85rem', margin: '4px', flex: '1 1 30%' },
        statText: { fontSize: esMovil ? '1.5rem' : '1.8rem', margin: '5px 0', color: '#fff' },
        bigTime: { fontSize: esMovil ? '3.5rem' : '5rem', fontWeight: 'bold', color: '#d4af37', textShadow: '0px 0px 10px rgba(212, 175, 55, 0.3)', margin: '20px 0', minHeight: '80px', lineHeight: '1' }
    };

    // ==========================================
    // RENDER UI
    // ==========================================
    return (
        <div style={{ 
            // 🛡️ PROTECCIÓN NOTCH Y BARRA DE INICIO
            paddingTop: `calc(env(safe-area-inset-top, 0px) + ${esMovil ? '15px' : '30px'})`,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${esMovil ? '20px' : '40px'})`,
            paddingLeft: `calc(env(safe-area-inset-left, 0px) + ${esMovil ? '15px' : '30px'})`,
            paddingRight: `calc(env(safe-area-inset-right, 0px) + ${esMovil ? '15px' : '30px'})`,
            minHeight: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box',
            width: '100%',
            overflowX: 'hidden'
        }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <button onClick={handleBack} style={{ ...(styles?.btnOutline || {}), width: 'auto', marginBottom: '20px', padding: '8px 15px' }}>
                    ← {esMovil ? '' : 'VOLVER'}
                </button>
                
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ ...(styles?.goldTitle || {}), fontSize: esMovil ? '1.2rem' : '1.8rem' }}>
                        RELOJ DE ENTRENAMIENTO
                    </h2>

                    <div style={localStyles.flexCenter}>
                        <button onClick={() => { setIsCasualMode(true); resetMatchTimer(); resetCasualTimer(); }} style={isCasualMode ? { ...(styles?.btnGold || {}), flex: esMovil ? '1' : '0 0 150px' } : { ...(styles?.btnOutline || {}), flex: esMovil ? '1' : '0 0 150px' }}>
                            CASUAL
                        </button>
                        <button onClick={() => { setIsCasualMode(false); resetMatchTimer(); resetCasualTimer(); }} style={!isCasualMode ? { ...(styles?.btnGold || {}), flex: esMovil ? '1' : '0 0 150px' } : { ...(styles?.btnOutline || {}), flex: esMovil ? '1' : '0 0 150px' }}>
                            COMPETICIÓN
                        </button>
                    </div>

                    {/* MODO CASUAL */}
                    {isCasualMode && (
                        <div style={localStyles.timerContainer}>
                            <div style={localStyles.flexCenter}>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Minutos</span>
                                    <select style={localStyles.input} value={Math.floor(duration / 60)} onChange={(e) => { setDuration(e.target.value * 60); if (!isCasualRunning && currentRepetition === 0) setCasualTimeLeft(e.target.value * 60); }}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(min => <option key={min} value={min}>{min}</option>)}
                                    </select>
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Rondas</span>
                                    <input style={localStyles.input} type="number" min="1" value={repetitions} onChange={(e) => { setRepetitions(Number(e.target.value)); if (!isCasualRunning) setCurrentRepetition(0); }} />
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Descanso (seg)</span>
                                    <input style={localStyles.input} type="number" min="0" value={rest} onChange={(e) => setRest(Number(e.target.value))} />
                                </div>
                            </div>

                            <div style={localStyles.bigTime}>
                                {isPreparing ? (
                                    <span style={{ color: '#ffcc00' }}>PREP: {prepTimeLeft}</span>
                                ) : isRestPhase ? (
                                    <span style={{ color: '#ff4444', fontSize: esMovil ? '2.5rem' : '4rem' }}>DESCANSO: {formatTime(casualTimeLeft)}</span>
                                ) : (
                                    formatTime(casualTimeLeft)
                                )}
                            </div>

                            {!isPreparing && (
                                <p style={{ fontSize: '1.2rem', color: '#aaa', margin: '10px 0' }}>Ronda: <span style={{ color: '#fff', fontWeight: 'bold' }}>{currentRepetition > 0 ? currentRepetition : 1} / {repetitions}</span></p>
                            )}

                            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                {!isCasualRunning && !isPreparing ? (
                                    <button style={{ ...(styles?.btnGold || {}), flex: '1 1 120px', maxWidth: '200px' }} onClick={startCasualTimer}>INICIAR</button>
                                ) : (
                                    <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 120px', maxWidth: '200px', color: '#ff4444', borderColor: '#ff4444' }} onClick={pauseCasualTimer}>PAUSAR</button>
                                )}
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 120px', maxWidth: '200px' }} onClick={resetCasualTimer}>REINICIAR</button>
                            </div>
                        </div>
                    )}

                    {/* MODO COMPETICIÓN */}
                    {!isCasualMode && (
                        <div style={localStyles.timerContainer}>
                            <div style={localStyles.flexCenter}>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Minutos</span>
                                    <select style={localStyles.input} value={Math.floor(matchDuration / 60)} onChange={(e) => { setMatchDuration(e.target.value * 60); if (!isMatchRunning && currentMatchRound === 0 && !isWarmupPhase) setMatchTimeLeft(e.target.value * 60); }}>
                                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(min => <option key={min} value={min}>{min}</option>)}
                                    </select>
                                </div>
                                <div style={localStyles.inputGroup}>
                                    <span style={localStyles.label}>Calentamiento (seg)</span>
                                    <input style={localStyles.input} type="number" min="0" value={warmupTime} onChange={(e) => setWarmupTime(Number(e.target.value))} />
                                </div>
                            </div>

                            <div style={localStyles.bigTime}>
                                {isPreparing ? (
                                    <span style={{ color: '#ffcc00' }}>PREP: {prepTimeLeft}</span>
                                ) : isWarmupPhase ? (
                                    <span style={{ color: '#aaa', fontSize: esMovil ? '2rem' : '3rem' }}>WARMUP: {formatTime(matchTimeLeft)}</span>
                                ) : (
                                    formatTime(matchTimeLeft)
                                )}
                            </div>

                            {winner && <h3 style={{ color: '#4CAF50', fontSize: esMovil ? '1.5rem' : '2rem', margin: '10px 0' }}>🏆 ¡GANADOR: {winner}! 🏆</h3>}

                            {/* CONTENEDOR DE PUNTUACIONES */}
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '20px' }}>
                                {/* COMPETIDOR 1 */}
                                <div style={localStyles.competitorCard}>
                                    <input style={{ ...localStyles.input, width: '100%', maxWidth: '100%', marginBottom: '15px', fontSize: '1.1rem', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #d4af37' }} value={competitor1Name} onChange={(e) => setCompetitor1Name(e.target.value)} placeholder="Atleta 1" />
                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '15px', alignItems: 'center' }}>
                                        <div><span style={localStyles.label}>PTS</span><div style={{ ...localStyles.statText, color: '#4CAF50' }}>{score1}</div></div>
                                        <div><span style={localStyles.label}>ADV</span><div style={{ ...localStyles.statText, color: '#d4af37' }}>{advantage1}</div></div>
                                        <div><span style={localStyles.label}>PEN</span><div style={{ ...localStyles.statText, color: '#ff4444' }}>{penalty1}</div></div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 2)}>Derribo (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 3)}>Pase (+3)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(1, 4)}>Montada (+4)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateAdvantage(1, 1)}>Ventaja (+1)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updatePenalty(1, 1)}>Castigo (+1)</button>
                                    </div>
                                </div>

                                {/* COMPETIDOR 2 */}
                                <div style={localStyles.competitorCard}>
                                    <input style={{ ...localStyles.input, width: '100%', maxWidth: '100%', marginBottom: '15px', fontSize: '1.1rem', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #d4af37' }} value={competitor2Name} onChange={(e) => setCompetitor2Name(e.target.value)} placeholder="Atleta 2" />
                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '15px', alignItems: 'center' }}>
                                        <div><span style={localStyles.label}>PTS</span><div style={{ ...localStyles.statText, color: '#4CAF50' }}>{score2}</div></div>
                                        <div><span style={localStyles.label}>ADV</span><div style={{ ...localStyles.statText, color: '#d4af37' }}>{advantage2}</div></div>
                                        <div><span style={localStyles.label}>PEN</span><div style={{ ...localStyles.statText, color: '#ff4444' }}>{penalty2}</div></div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 2)}>Derribo (+2)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 3)}>Pase (+3)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateScore(2, 4)}>Montada (+4)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updateAdvantage(2, 1)}>Ventaja (+1)</button>
                                        <button disabled={puntosBloqueados} style={puntosBloqueados ? localStyles.scoreBtnDisabled : localStyles.scoreBtn} onClick={() => updatePenalty(2, 1)}>Castigo (+1)</button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                {!isMatchRunning && !isPreparing ? (
                                    <button style={{ ...(styles?.btnGold || {}), flex: '1 1 140px', maxWidth: '250px' }} onClick={startMatchTimer}>▶ INICIAR COMBATE</button>
                                ) : (
                                    <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 140px', maxWidth: '250px', color: '#ff4444', borderColor: '#ff4444' }} onClick={pauseMatchTimer}>⏸ PAUSAR</button>
                                )}
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 100px' }} onClick={resetMatchTimer}>REINICIAR</button>
                                <button style={{ ...(styles?.btnOutline || {}), flex: '1 1 100px', color: '#4CAF50', borderColor: '#4CAF50' }} onClick={designateWinner}>FINALIZAR</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}