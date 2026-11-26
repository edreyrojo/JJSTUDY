import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import VaultIcon from './VaultIcon';
import { timerSounds, unlockAudio, vibrate } from '../utils/timerAudio';

const formatTime = (segundos = 0) => {
    const total = Math.max(0, Math.floor(segundos));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const ETIQUETAS_ACCION = {
    derribo: 'Derribo',
    derriboLimpio: 'Derribo limpio',
    barrida: 'Barrida',
    barridaLimpia: 'Barrida limpia',
    pase: 'Pase',
    montada: 'Montada',
    espalda: 'Espalda',
    rodilla: 'Rodilla'
};

const ORDEN_PUNTOS = ['derribo', 'derriboLimpio', 'barrida', 'barridaLimpia', 'pase', 'montada', 'espalda', 'rodilla'];

const RULE_PRESETS = {
    ibjjf: {
        label: 'IBJJF 2026',
        short: 'IBJJF',
        points: { derribo: 2, derriboLimpio: 0, barrida: 2, barridaLimpia: 0, pase: 3, montada: 4, espalda: 4, rodilla: 2 },
        showAdvantage: true,
        showPenalty: true,
        maxPenalties: 3
    },
    adcc: {
        label: 'ADCC',
        short: 'ADCC',
        points: { derribo: 2, derriboLimpio: 4, barrida: 2, barridaLimpia: 4, pase: 3, montada: 2, espalda: 3, rodilla: 2 },
        showAdvantage: false,
        showPenalty: true,
        maxPenalties: null
    },
    submission: {
        label: 'Submission Only',
        short: 'SUB ONLY',
        points: { derribo: 0, derriboLimpio: 0, barrida: 0, barridaLimpia: 0, pase: 0, montada: 0, espalda: 0, rodilla: 0 },
        showAdvantage: false,
        showPenalty: false,
        maxPenalties: null
    }
};

const CUSTOM_DEFAULT = {
    label: 'Personalizado',
    short: 'CUSTOM',
    points: { derribo: 2, derriboLimpio: 0, barrida: 2, barridaLimpia: 0, pase: 3, montada: 4, espalda: 4, rodilla: 2 },
    showAdvantage: true,
    showPenalty: true,
    maxPenalties: 3
};

const cargarReglasCustom = () => {
    try {
        const guardado = localStorage.getItem('lafortuna_timer_rules');
        if (!guardado) return CUSTOM_DEFAULT;
        const parseado = JSON.parse(guardado);
        return {
            ...CUSTOM_DEFAULT,
            ...parseado,
            points: { ...CUSTOM_DEFAULT.points, ...(parseado.points || {}) }
        };
    } catch {
        return CUSTOM_DEFAULT;
    }
};

const calcularGanador = ({ score1, score2, advantage1, advantage2, penalty1, penalty2, nombre1, nombre2 }) => {
    const n1 = (nombre1 || '').trim() || 'Atleta A';
    const n2 = (nombre2 || '').trim() || 'Atleta B';
    if (score1 !== score2) return score1 > score2 ? n1 : n2;
    if (advantage1 !== advantage2) return advantage1 > advantage2 ? n1 : n2;
    if (penalty1 !== penalty2) return penalty1 < penalty2 ? n1 : n2;
    return 'Empate';
};

const PRESETS_INTERVALO = [
    { label: '3-1 x5', workMin: 3, workSec: 0, restMin: 1, restSec: 0, rounds: 5 },
    { label: '5-1 x5', workMin: 5, workSec: 0, restMin: 1, restSec: 0, rounds: 5 },
    { label: '2-1 x6', workMin: 2, workSec: 0, restMin: 1, restSec: 0, rounds: 6 },
    { label: '30s-10s x10', workMin: 0, workSec: 30, restMin: 0, restSec: 10, rounds: 10 },
    { label: '1-0:30 x8', workMin: 1, workSec: 0, restMin: 0, restSec: 30, rounds: 8 }
];

export default function TimerPage({ onBack }) {
    const [ancho, setAncho] = useState(window.innerWidth);
    const esMovil = ancho < 768;
    const esTablet = ancho >= 768 && ancho < 1200;
    const anchoCompetencia = esMovil ? '100%' : esTablet ? '980px' : '1240px';

    useEffect(() => {
        const handleResize = () => setAncho(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [seccion, setSeccion] = useState('practica');
    const [modoPractica, setModoPractica] = useState('intervalos');
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try {
            return localStorage.getItem('lafortuna_timer_sound') !== 'off';
        } catch {
            return true;
        }
    });
    const soundRef = useRef(soundEnabled);

    useEffect(() => {
        soundRef.current = soundEnabled;
        try {
            localStorage.setItem('lafortuna_timer_sound', soundEnabled ? 'on' : 'off');
        } catch {
            /* almacenamiento no disponible */
        }
    }, [soundEnabled]);

    const toggleSound = async () => {
        const siguiente = !soundEnabled;
        setSoundEnabled(siguiente);
        if (siguiente) {
            await unlockAudio();
            timerSounds.test(true);
        }
    };

    const probarSonido = async () => {
        await unlockAudio();
        if (!soundEnabled) setSoundEnabled(true);
        timerSounds.test(true);
    };

    const avisar = (texto) => {
        Swal.fire({
            text: texto,
            icon: 'warning',
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: '#d4af37',
            iconColor: '#d4af37',
            customClass: { popup: 'gold-border-alert' }
        });
    };

    // --- WAKE LOCK ---
    const wakeLockRef = useRef(null);

    const requestWakeLock = useCallback(async () => {
        try {
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                const sentinel = await navigator.wakeLock.request('screen');
                wakeLockRef.current = sentinel;
                sentinel.addEventListener('release', () => {
                    if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
                });
            }
        } catch (error) {
            console.warn('Wake Lock:', error);
        }
    }, []);

    const releaseWakeLock = useCallback(async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        } catch (error) {
            console.warn('Wake Lock release:', error);
        }
    }, []);

    useEffect(() => () => { releaseWakeLock(); }, [releaseWakeLock]);

    // =========================================================
    // INTERVALOS
    // =========================================================
    const [workMin, setWorkMin] = useState(3);
    const [workSec, setWorkSec] = useState(0);
    const [restMin, setRestMin] = useState(1);
    const [restSec, setRestSec] = useState(0);
    const [rounds, setRounds] = useState(5);
    const [prepSec, setPrepSec] = useState(3);
    const [intervalPhase, setIntervalPhase] = useState('idle');
    const [intervalRemaining, setIntervalRemaining] = useState(180);
    const [intervalRound, setIntervalRound] = useState(1);

    const intervalEndAtRef = useRef(0);
    const intervalResumePhaseRef = useRef('work');

    const workTotal = Math.max(1, (Number(workMin) || 0) * 60 + (Number(workSec) || 0));
    const restTotal = Math.max(0, (Number(restMin) || 0) * 60 + (Number(restSec) || 0));
    const intervalDisplay = ['idle', 'finished'].includes(intervalPhase)
        ? (intervalPhase === 'finished' ? 0 : workTotal)
        : intervalRemaining;
    const intervaloUrgente = ['work', 'rest'].includes(intervalPhase) && intervalRemaining <= 10 && intervalRemaining > 0;
    const intervaloConfigBloqueada = !['idle', 'finished'].includes(intervalPhase);

    useEffect(() => {
        if (!['prep', 'work', 'rest'].includes(intervalPhase)) return;
        let last = null;
        let done = false;

        const id = setInterval(() => {
            if (done) return;
            const left = Math.max(0, Math.ceil((intervalEndAtRef.current - Date.now()) / 1000));

            if (left !== last) {
                last = left;
                setIntervalRemaining(left);
                if (left > 0) {
                    if (intervalPhase === 'prep') timerSounds.prep(soundRef.current);
                    else if (left <= 3) timerSounds.countdown(soundRef.current, left);
                    else if (left === 10) timerSounds.warning(soundRef.current);
                }
            }

            if (left > 0) return;
            done = true;
            clearInterval(id);

            if (intervalPhase === 'prep') {
                intervalEndAtRef.current = Date.now() + workTotal * 1000;
                setIntervalRound(1);
                setIntervalRemaining(workTotal);
                setIntervalPhase('work');
                timerSounds.workStart(soundRef.current);
                vibrate([120]);
                return;
            }

            if (intervalPhase === 'work') {
                if (intervalRound >= rounds) {
                    setIntervalPhase('finished');
                    setIntervalRemaining(0);
                    timerSounds.finish(soundRef.current);
                    vibrate([400, 160, 400]);
                    releaseWakeLock();
                } else if (restTotal > 0) {
                    intervalEndAtRef.current = Date.now() + restTotal * 1000;
                    setIntervalRemaining(restTotal);
                    setIntervalPhase('rest');
                    timerSounds.restStart(soundRef.current);
                    vibrate([180]);
                } else {
                    intervalEndAtRef.current = Date.now() + workTotal * 1000;
                    setIntervalRound(r => r + 1);
                    setIntervalRemaining(workTotal);
                    setIntervalPhase('work');
                    timerSounds.workStart(soundRef.current);
                }
                return;
            }

            if (intervalPhase === 'rest') {
                if (intervalRound >= rounds) {
                    setIntervalPhase('finished');
                    setIntervalRemaining(0);
                    timerSounds.finish(soundRef.current);
                    vibrate([400, 160, 400]);
                    releaseWakeLock();
                } else {
                    intervalEndAtRef.current = Date.now() + workTotal * 1000;
                    setIntervalRound(r => r + 1);
                    setIntervalRemaining(workTotal);
                    setIntervalPhase('work');
                    timerSounds.workStart(soundRef.current);
                }
            }
        }, 250);

        return () => clearInterval(id);
    }, [intervalPhase, intervalRound, rounds, workTotal, restTotal, releaseWakeLock]);

    const iniciarIntervalo = async () => {
        await unlockAudio();
        if (['prep', 'work', 'rest'].includes(intervalPhase)) {
            intervalResumePhaseRef.current = intervalPhase;
            setIntervalPhase('paused');
            releaseWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }

        if (intervalPhase === 'paused') {
            intervalEndAtRef.current = Date.now() + Math.max(0, intervalRemaining) * 1000;
            setIntervalPhase(intervalResumePhaseRef.current);
            requestWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }

        if (workTotal <= 0) {
            avisar('Configura al menos un segundo de trabajo.');
            return;
        }

        const inicial = prepSec > 0 ? prepSec : workTotal;
        intervalEndAtRef.current = Date.now() + inicial * 1000;
        setIntervalRound(1);
        setIntervalRemaining(inicial);
        setIntervalPhase(prepSec > 0 ? 'prep' : 'work');
        requestWakeLock();
        if (prepSec > 0) timerSounds.prep(soundRef.current);
        else timerSounds.workStart(soundRef.current);
        vibrate([80]);
    };

    const resetIntervalo = () => {
        setIntervalPhase('idle');
        setIntervalRemaining(workTotal);
        setIntervalRound(1);
        intervalEndAtRef.current = 0;
        releaseWakeLock();
        timerSounds.tick(soundRef.current);
    };

    const aplicarPresetIntervalo = (preset) => {
        if (intervaloConfigBloqueada) return;
        setWorkMin(preset.workMin);
        setWorkSec(preset.workSec);
        setRestMin(preset.restMin);
        setRestSec(preset.restSec);
        setRounds(preset.rounds);
    };

    const etiquetaFaseIntervalo = () => {
        if (intervalPhase === 'prep') return 'PREPARACIÓN';
        if (intervalPhase === 'work') return `TRABAJO · RONDA ${intervalRound}/${rounds}`;
        if (intervalPhase === 'rest') return `DESCANSO · RONDA ${intervalRound}/${rounds}`;
        if (intervalPhase === 'paused') return 'PAUSA';
        if (intervalPhase === 'finished') return 'COMPLETADO';
        return 'INTERVALOS';
    };

    // =========================================================
    // RELOJ RÁPIDO
    // =========================================================
    const [clockMode, setClockMode] = useState('up');
    const [clockDuration, setClockDuration] = useState(300);
    const [clockRemaining, setClockRemaining] = useState(300);
    const [clockElapsed, setClockElapsed] = useState(0);
    const [clockRunning, setClockRunning] = useState(false);

    const clockStartRef = useRef(0);
    const clockEndRef = useRef(0);
    const clockLastSecRef = useRef(null);

    useEffect(() => {
        if (!clockRunning) return;

        const id = setInterval(() => {
            if (clockMode === 'up') {
                const elapsed = Math.max(0, Math.floor((Date.now() - clockStartRef.current) / 1000));
                setClockElapsed(elapsed);
                if (elapsed > 0 && elapsed % 60 === 0 && clockLastSecRef.current !== elapsed) {
                    clockLastSecRef.current = elapsed;
                    timerSounds.warning(soundRef.current);
                }
            } else {
                const remaining = Math.max(0, Math.ceil((clockEndRef.current - Date.now()) / 1000));
                if (remaining !== clockLastSecRef.current) {
                    clockLastSecRef.current = remaining;
                    setClockRemaining(remaining);
                    if (remaining === 60 || remaining === 30 || remaining === 10) timerSounds.warning(soundRef.current);
                    else if (remaining > 0 && remaining <= 3) timerSounds.countdown(soundRef.current, remaining);
                }
                if (remaining <= 0) {
                    clearInterval(id);
                    setClockRunning(false);
                    timerSounds.finish(soundRef.current);
                    vibrate([400, 160, 400]);
                    releaseWakeLock();
                }
            }
        }, 250);

        return () => clearInterval(id);
    }, [clockRunning, clockMode, releaseWakeLock]);

    const iniciarReloj = async () => {
        await unlockAudio();
        if (clockRunning) {
            setClockRunning(false);
            releaseWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }

        clockLastSecRef.current = null;
        if (clockMode === 'up') {
            clockStartRef.current = Date.now() - clockElapsed * 1000;
        } else {
            clockEndRef.current = Date.now() + clockRemaining * 1000;
        }
        setClockRunning(true);
        requestWakeLock();
        timerSounds.workStart(soundRef.current);
    };

    const resetReloj = () => {
        setClockRunning(false);
        setClockElapsed(0);
        setClockRemaining(clockDuration);
        clockLastSecRef.current = null;
        releaseWakeLock();
        timerSounds.tick(soundRef.current);
    };

    const cambiarModoReloj = (modo) => {
        if (clockRunning) return;
        setClockMode(modo);
        setClockElapsed(0);
        setClockRemaining(clockDuration);
        clockLastSecRef.current = null;
    };

    const aplicarDuracionReloj = (segundos) => {
        if (clockRunning) return;
        setClockDuration(segundos);
        setClockRemaining(segundos);
        setClockElapsed(0);
    };

    const sumarMinutoReloj = () => {
        if (clockMode !== 'down') return;
        if (clockRunning) {
            clockEndRef.current += 60000;
            setClockRemaining(r => r + 60);
        } else {
            setClockDuration(d => d + 60);
            setClockRemaining(r => r + 60);
        }
    };

    const clockDisplay = clockMode === 'up' ? clockElapsed : clockRemaining;
    const clockStarted = clockMode === 'up' ? clockElapsed > 0 : clockRemaining < clockDuration;
    const clockStatus = clockRunning ? 'En marcha' : clockStarted ? 'En pausa' : 'Listo';

    // =========================================================
    // COMPETENCIA
    // =========================================================
    const [competidor1, setCompetidor1] = useState('');
    const [competidor2, setCompetidor2] = useState('');
    const [matchDuration, setMatchDuration] = useState(() => {
        try {
            const guardado = Number(localStorage.getItem('lafortuna_timer_duration'));
            const valido = Number.isFinite(guardado) && guardado >= 60 && guardado <= 1200 && guardado % 60 === 0;
            return valido ? guardado : 300;
        } catch {
            return 300;
        }
    });
    const [matchTimeLeft, setMatchTimeLeft] = useState(matchDuration);
    const [matchPhase, setMatchPhase] = useState('idle');
    const [matchPrepLeft, setMatchPrepLeft] = useState(3);
    const [score1, setScore1] = useState(0);
    const [advantage1, setAdvantage1] = useState(0);
    const [penalty1, setPenalty1] = useState(0);
    const [score2, setScore2] = useState(0);
    const [advantage2, setAdvantage2] = useState(0);
    const [penalty2, setPenalty2] = useState(0);
    const [winner, setWinner] = useState('');
    const [historial, setHistorial] = useState([]);
    const [rulesKey, setRulesKey] = useState(() => {
        try {
            const guardado = localStorage.getItem('lafortuna_timer_ruleset');
            return ['ibjjf', 'adcc', 'submission', 'custom'].includes(guardado) ? guardado : 'ibjjf';
        } catch {
            return 'ibjjf';
        }
    });
    const [customRules, setCustomRules] = useState(cargarReglasCustom);
    const [showRulesSettings, setShowRulesSettings] = useState(false);
    const [customDraft, setCustomDraft] = useState(cargarReglasCustom);

    useEffect(() => {
        try {
            localStorage.setItem('lafortuna_timer_ruleset', rulesKey);
        } catch {
            /* almacenamiento no disponible */
        }
    }, [rulesKey]);

    useEffect(() => {
        try {
            localStorage.setItem('lafortuna_timer_duration', String(matchDuration));
        } catch {
            /* almacenamiento no disponible */
        }
    }, [matchDuration]);

    const matchEndAtRef = useRef(0);
    const matchPrepEndAtRef = useRef(0);
    const matchResumePhaseRef = useRef('running');
    const matchRef = useRef({
        score1: 0, score2: 0, advantage1: 0, advantage2: 0, penalty1: 0, penalty2: 0,
        nombre1: '', nombre2: ''
    });

    const rules = useMemo(() => {
        if (rulesKey === 'custom') return customRules || CUSTOM_DEFAULT;
        return RULE_PRESETS[rulesKey] || RULE_PRESETS.ibjjf;
    }, [rulesKey, customRules]);

    const acciones = useMemo(() => {
        const lista = [];
        ORDEN_PUNTOS.forEach(id => {
            const puntos = Number(rules.points?.[id] || 0);
            if (puntos > 0) lista.push({ id, label: ETIQUETAS_ACCION[id], puntos });
        });
        if (rules.showAdvantage) lista.push({ id: 'ventaja', label: 'Ventaja', puntos: 'ADV' });
        if (rules.showPenalty) lista.push({ id: 'castigo', label: 'Castigo', puntos: 'PEN' });
        return lista;
    }, [rules]);

    const soloSumision = !rules.showAdvantage && !rules.showPenalty && ORDEN_PUNTOS.every(id => !rules.points?.[id]);

    useEffect(() => {
        const alVolver = () => {
            if (document.visibilityState !== 'visible') return;
            const activo =
                ['prep', 'work', 'rest'].includes(intervalPhase) ||
                clockRunning ||
                ['prep', 'running'].includes(matchPhase);
            if (activo) {
                requestWakeLock();
                unlockAudio();
            }
        };
        document.addEventListener('visibilitychange', alVolver);
        return () => document.removeEventListener('visibilitychange', alVolver);
    }, [intervalPhase, clockRunning, matchPhase, requestWakeLock]);

    useEffect(() => {
        matchRef.current = {
            score1, score2, advantage1, advantage2, penalty1, penalty2,
            nombre1: competidor1, nombre2: competidor2
        };
    }, [score1, score2, advantage1, advantage2, penalty1, penalty2, competidor1, competidor2]);

    useEffect(() => {
        if (matchPhase !== 'prep') return;
        let last = null;
        let done = false;

        const id = setInterval(() => {
            if (done) return;
            const left = Math.max(0, Math.ceil((matchPrepEndAtRef.current - Date.now()) / 1000));

            if (left !== last) {
                last = left;
                setMatchPrepLeft(left);
                if (left > 0) timerSounds.countdown(soundRef.current, left);
            }

            if (left > 0) return;
            done = true;
            clearInterval(id);
            matchEndAtRef.current = Date.now() + matchDuration * 1000;
            setMatchTimeLeft(matchDuration);
            setMatchPhase('running');
            timerSounds.workStart(soundRef.current);
            vibrate([120]);
            requestWakeLock();
        }, 250);
        return () => clearInterval(id);
    }, [matchPhase, matchDuration, requestWakeLock]);

    useEffect(() => {
        if (matchPhase !== 'running') return;
        let last = null;
        let done = false;

        const id = setInterval(() => {
            if (done) return;
            const left = Math.max(0, Math.ceil((matchEndAtRef.current - Date.now()) / 1000));

            if (left !== last) {
                last = left;
                setMatchTimeLeft(left);
                if (left === 60 || left === 30 || left === 10) timerSounds.warning(soundRef.current);
                else if (left > 0 && left <= 3) timerSounds.countdown(soundRef.current, left);
            }

            if (left > 0) return;
            done = true;
            clearInterval(id);
            setMatchPhase('finished');
            setWinner(calcularGanador(matchRef.current));
            timerSounds.finish(soundRef.current);
            vibrate([400, 160, 400]);
            releaseWakeLock();
        }, 250);

        return () => clearInterval(id);
    }, [matchPhase, releaseWakeLock]);

    const iniciarMatch = async () => {
        await unlockAudio();

        if (['prep', 'running'].includes(matchPhase)) {
            matchResumePhaseRef.current = matchPhase;
            setMatchPhase('paused');
            releaseWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }

        if (matchPhase === 'paused') {
            if (matchResumePhaseRef.current === 'prep') {
                matchPrepEndAtRef.current = Date.now() + Math.max(1, matchPrepLeft) * 1000;
            } else {
                matchEndAtRef.current = Date.now() + Math.max(1, matchTimeLeft) * 1000;
            }
            setMatchPhase(matchResumePhaseRef.current);
            requestWakeLock();
            timerSounds.tick(soundRef.current);
            return;
        }

        if (matchPhase === 'finished') {
            setScore1(0); setScore2(0);
            setAdvantage1(0); setAdvantage2(0);
            setPenalty1(0); setPenalty2(0);
            setWinner('');
            setHistorial([]);
            setMatchTimeLeft(matchDuration);
            matchRef.current = {
                score1: 0, score2: 0, advantage1: 0, advantage2: 0, penalty1: 0, penalty2: 0,
                nombre1: competidor1, nombre2: competidor2
            };
        }

        matchPrepEndAtRef.current = Date.now() + 3000;
        setMatchPrepLeft(3);
        setMatchTimeLeft(matchDuration);
        setMatchPhase('prep');
        requestWakeLock();
        timerSounds.prep(soundRef.current);
        vibrate([80]);
    };

    const resetMatch = async () => {
        const activo = matchPhase !== 'idle' || score1 > 0 || score2 > 0 || advantage1 > 0 || advantage2 > 0 || penalty1 > 0 || penalty2 > 0;
        if (activo) {
            const res = await Swal.fire({
                title: '¿Reiniciar combate?',
                text: 'Se borrarán el tiempo y la puntuación actual.',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, reiniciar'
            });
            if (!res.isConfirmed) return;
        }

        setMatchPhase('idle');
        setMatchTimeLeft(matchDuration);
        setScore1(0); setScore2(0);
        setAdvantage1(0); setAdvantage2(0);
        setPenalty1(0); setPenalty2(0);
        setWinner('');
        setHistorial([]);
        matchEndAtRef.current = 0;
        matchPrepEndAtRef.current = 0;
        setMatchPrepLeft(3);
        matchRef.current = {
            score1: 0, score2: 0, advantage1: 0, advantage2: 0, penalty1: 0, penalty2: 0,
            nombre1: competidor1, nombre2: competidor2
        };
        releaseWakeLock();
        timerSounds.tick(soundRef.current);
    };

    const finalizarMatch = () => {
        if (matchPhase === 'idle' || matchPhase === 'finished') return;
        setMatchPhase('finished');
        setMatchTimeLeft(matchTimeLeft);
        setWinner(calcularGanador(matchRef.current));
        timerSounds.finish(soundRef.current);
        releaseWakeLock();
    };

    const sumarMinutoMatch = () => {
        if (matchPhase === 'idle' || matchPhase === 'finished') {
            setMatchDuration(d => d + 60);
            setMatchTimeLeft(t => t + 60);
        } else if (matchPhase === 'running') {
            matchEndAtRef.current += 60000;
            setMatchTimeLeft(t => t + 60);
        } else if (matchPhase === 'paused') {
            setMatchTimeLeft(t => t + 60);
        } else if (matchPhase === 'prep') {
            setMatchDuration(d => d + 60);
        }
    };

    const guardarSnapshot = () => {
        const actual = matchRef.current;
        setHistorial(prev => [
            ...prev.slice(-19),
            {
                score1: actual.score1, score2: actual.score2,
                advantage1: actual.advantage1, advantage2: actual.advantage2,
                penalty1: actual.penalty1, penalty2: actual.penalty2,
                winner, phase: matchPhase, time: matchTimeLeft
            }
        ]);
    };

    const aplicarAccion = (atleta, accionId) => {
        if (!['running', 'paused'].includes(matchPhase)) return;

        guardarSnapshot();
        const actual = matchRef.current;

        if (accionId === 'sumision') {
            const nombre = atleta === 1 ? competidor1 : competidor2;
            setWinner(`${nombre || (atleta === 1 ? 'Atleta A' : 'Atleta B')} (Sumisión)`);
            setMatchPhase('finished');
            setMatchTimeLeft(matchTimeLeft);
            timerSounds.finish(soundRef.current);
            vibrate([400, 160, 400]);
            releaseWakeLock();
            return;
        }

        if (accionId === 'dq') {
            const nombreGanador = atleta === 1 ? competidor2 : competidor1;
            setWinner(`${nombreGanador || (atleta === 1 ? 'Atleta B' : 'Atleta A')} (DQ del rival)`);
            setMatchPhase('finished');
            setMatchTimeLeft(matchTimeLeft);
            timerSounds.finish(soundRef.current);
            vibrate([400, 160, 400]);
            releaseWakeLock();
            return;
        }

        if (accionId === 'ventaja') {
            if (atleta === 1) {
                const siguiente = (actual.advantage1 || 0) + 1;
                matchRef.current = { ...actual, advantage1: siguiente };
                setAdvantage1(siguiente);
            } else {
                const siguiente = (actual.advantage2 || 0) + 1;
                matchRef.current = { ...actual, advantage2: siguiente };
                setAdvantage2(siguiente);
            }
            timerSounds.point(soundRef.current);
            return;
        }

        if (accionId === 'castigo') {
            const nuevaPenalizacion = (atleta === 1 ? actual.penalty1 : actual.penalty2) + 1;
            if (atleta === 1) {
                matchRef.current = { ...actual, penalty1: nuevaPenalizacion };
                setPenalty1(nuevaPenalizacion);
            } else {
                matchRef.current = { ...actual, penalty2: nuevaPenalizacion };
                setPenalty2(nuevaPenalizacion);
            }

            if (rules.maxPenalties && nuevaPenalizacion >= rules.maxPenalties) {
                const nombreGanador = atleta === 1 ? competidor2 : competidor1;
                setWinner(`${nombreGanador || (atleta === 1 ? 'Atleta B' : 'Atleta A')} (DQ por castigos)`);
                setMatchPhase('finished');
                setMatchTimeLeft(matchTimeLeft);
                timerSounds.finish(soundRef.current);
                vibrate([400, 160, 400]);
                releaseWakeLock();
            } else {
                timerSounds.point(soundRef.current);
            }
            return;
        }

        const puntos = Number(rules.points?.[accionId] || 0);
        if (puntos <= 0) return;
        if (atleta === 1) {
            const siguiente = (actual.score1 || 0) + puntos;
            matchRef.current = { ...actual, score1: siguiente };
            setScore1(siguiente);
        } else {
            const siguiente = (actual.score2 || 0) + puntos;
            matchRef.current = { ...actual, score2: siguiente };
            setScore2(siguiente);
        }
        timerSounds.point(soundRef.current);
    };

    const deshacerAccion = () => {
        if (historial.length === 0) return;
        const ultimo = historial[historial.length - 1];
        setHistorial(prev => prev.slice(0, -1));
        setScore1(ultimo.score1); setScore2(ultimo.score2);
        setAdvantage1(ultimo.advantage1); setAdvantage2(ultimo.advantage2);
        setPenalty1(ultimo.penalty1); setPenalty2(ultimo.penalty2);
        setWinner(ultimo.winner);
        matchRef.current = {
            ...matchRef.current,
            score1: ultimo.score1, score2: ultimo.score2,
            advantage1: ultimo.advantage1, advantage2: ultimo.advantage2,
            penalty1: ultimo.penalty1, penalty2: ultimo.penalty2
        };
        if (matchPhase === 'finished') {
            setMatchPhase('paused');
            setMatchTimeLeft(ultimo.time);
            matchEndAtRef.current = Date.now() + ultimo.time * 1000;
            matchResumePhaseRef.current = 'running';
            releaseWakeLock();
        }
        timerSounds.tick(soundRef.current);
    };

    const cambiarReglas = async (nuevaClave) => {
        if (nuevaClave === rulesKey) return true;
        if (nuevaClave !== 'custom' && !RULE_PRESETS[nuevaClave]) return false;
        const activo = matchPhase !== 'idle' || score1 > 0 || score2 > 0 || advantage1 > 0 || advantage2 > 0;
        if (activo) {
            const res = await Swal.fire({
                title: '¿Cambiar reglas?',
                text: 'Se reiniciará el combate para aplicar el nuevo sistema de puntuación.',
                icon: 'warning',
                showCancelButton: true,
                background: '#0a0a0a',
                color: '#fff',
                confirmButtonColor: '#d4af37',
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, cambiar'
            });
            if (!res.isConfirmed) return false;
        }
        setRulesKey(nuevaClave);
        setMatchPhase('idle');
        setScore1(0); setScore2(0);
        setAdvantage1(0); setAdvantage2(0);
        setPenalty1(0); setPenalty2(0);
        setWinner('');
        setHistorial([]);
        setMatchTimeLeft(matchDuration);
        matchEndAtRef.current = 0;
        matchPrepEndAtRef.current = 0;
        matchRef.current = {
            score1: 0, score2: 0, advantage1: 0, advantage2: 0, penalty1: 0, penalty2: 0,
            nombre1: competidor1, nombre2: competidor2
        };
        releaseWakeLock();
        return true;
    };

    const abrirAjustesReglas = () => {
        setCustomDraft({
            ...customRules,
            points: { ...CUSTOM_DEFAULT.points, ...(customRules.points || {}) }
        });
        setShowRulesSettings(true);
    };

    const guardarAjustesReglas = () => {
        const nuevo = {
            ...CUSTOM_DEFAULT,
            ...customDraft,
            points: ORDEN_PUNTOS.reduce((acc, id) => {
                acc[id] = Math.max(0, Number(customDraft.points?.[id]) || 0);
                return acc;
            }, {}),
            showAdvantage: Boolean(customDraft.showAdvantage),
            showPenalty: Boolean(customDraft.showPenalty),
            maxPenalties: customDraft.maxPenalties ? Number(customDraft.maxPenalties) : null
        };
        setCustomRules(nuevo);
        try {
            localStorage.setItem('lafortuna_timer_rules', JSON.stringify(nuevo));
        } catch {
            /* almacenamiento no disponible */
        }
        setRulesKey('custom');
        setShowRulesSettings(false);
        setMatchPhase('idle');
        setScore1(0); setScore2(0);
        setAdvantage1(0); setAdvantage2(0);
        setPenalty1(0); setPenalty2(0);
        setWinner('');
        setHistorial([]);
        setMatchTimeLeft(matchDuration);
        matchEndAtRef.current = 0;
        matchPrepEndAtRef.current = 0;
        matchRef.current = {
            score1: 0, score2: 0, advantage1: 0, advantage2: 0, penalty1: 0, penalty2: 0,
            nombre1: competidor1, nombre2: competidor2
        };
        releaseWakeLock();
    };

    // =========================================================
    // NAVEGACIÓN / SECCIONES
    // =========================================================
    const cambiarSeccion = (nueva) => {
        if (nueva === seccion) return;
        if (['prep', 'work', 'rest'].includes(intervalPhase)) {
            intervalResumePhaseRef.current = intervalPhase;
            setIntervalPhase('paused');
        }
        if (clockRunning) {
            setClockRunning(false);
        }
        if (['prep', 'running'].includes(matchPhase)) {
            matchResumePhaseRef.current = matchPhase;
            setMatchPhase('paused');
            releaseWakeLock();
        }
        setSeccion(nueva);
    };

    const cambiarModoPractica = (modo) => {
        if (modo === modoPractica) return;
        if (['prep', 'work', 'rest'].includes(intervalPhase)) {
            intervalResumePhaseRef.current = intervalPhase;
            setIntervalPhase('paused');
        }
        if (clockRunning) setClockRunning(false);
        setModoPractica(modo);
    };

    const handleBack = async () => {
        const activo =
            !['idle', 'finished'].includes(intervalPhase) ||
            clockRunning ||
            clockElapsed > 0 ||
            clockRemaining < clockDuration ||
            ['prep', 'running', 'paused'].includes(matchPhase) ||
            score1 > 0 || score2 > 0 ||
            advantage1 > 0 || advantage2 > 0 ||
            penalty1 > 0 || penalty2 > 0 ||
            Boolean(winner);

        if (activo) {
            const res = await Swal.fire({
                text: '¿Salir del temporizador? Los datos actuales se perderán.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d4af37',
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
        onBack();
    };

    const estadoCompetencia = () => {
        if (matchPhase === 'prep') return `PREPARACIÓN ${Math.max(0, matchPrepLeft)}`;
        if (matchPhase === 'running') return 'EN CURSO';
        if (matchPhase === 'paused') return 'PAUSA';
        if (matchPhase === 'finished') {
            if (!winner) return 'FINALIZADO';
            return winner === 'Empate' ? 'EMPATE' : `GANADOR: ${winner}`;
        }
        return 'LISTO PARA INICIAR';
    };

    const puedePuntuar = ['running', 'paused'].includes(matchPhase);
    const matchDisplay = matchPhase === 'prep' ? Math.max(0, matchPrepLeft) : matchTimeLeft;
    const matchUrgente = matchPhase === 'running' && matchTimeLeft <= 10;
    const nombreA = (competidor1 || '').trim() || 'Atleta A';
    const nombreB = (competidor2 || '').trim() || 'Atleta B';
    const nombreGanador = winner.replace(/ \((?:Sumisión|DQ del rival|DQ por castigos)\)$/, '');
    const ganadorA = Boolean(winner) && winner !== 'Empate' && nombreGanador === nombreA;
    const ganadorB = Boolean(winner) && winner !== 'Empate' && nombreGanador === nombreB;

    const rootStyle = seccion === 'competencia'
        ? {
            height: '100dvh',
            minHeight: '100dvh',
            overflow: 'hidden',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 10px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 10px)',
            width: '100%'
        }
        : {
            minHeight: 'var(--app-vh)',
            backgroundColor: '#000',
            color: '#fff',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 14px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 14px)',
            overflowX: 'hidden'
        };

    const resumenReglas = (() => {
        if (soloSumision) return 'Sin puntos: solo finalización o decisión de los jueces.';
        const puntos = ORDEN_PUNTOS
            .filter(id => Number(rules.points?.[id] || 0) > 0)
            .map(id => `${ETIQUETAS_ACCION[id]} +${rules.points[id]}`)
            .join(' · ');
        const extras = [
            rules.showAdvantage ? 'Ventaja' : null,
            rules.showPenalty
                ? (rules.maxPenalties ? `${rules.maxPenalties} castigos = DQ` : 'castigos restan')
                : null
        ].filter(Boolean).join(' · ');
        return `${puntos}${extras ? ` · ${extras}` : ''}`;
    })();

    const bloqueReloj = (
        <div style={esMovil ? { minWidth: 0 } : s.compClockBlock}>
            <div style={{ ...s.compTimeValue, color: matchUrgente ? '#ff6b6b' : '#d4af37' }} className="comp-time-value">{formatTime(matchDisplay)}</div>
            <div style={{ ...s.compStatus, color: winner && winner !== 'Empate' ? '#4CAF50' : matchPhase === 'running' ? '#d4af37' : '#888' }}>
                {winner && winner !== 'Empate' && <VaultIcon name="trophy" size={13} color="#4CAF50" />}
                {estadoCompetencia()}
            </div>
        </div>
    );

    const bloqueControles = (
        <div className="comp-timer-controls" style={esMovil ? s.compTimerControls : s.compTimerControlsWide}>
            <button type="button" onClick={iniciarMatch} className="timer-main-btn" style={esMovil ? s.compPrimaryBtn : { ...s.compPrimaryBtn, ...s.compPrimaryBtnWide }}>
                <VaultIcon name={['prep', 'running'].includes(matchPhase) ? 'pause' : 'play'} size={15} />
                {['prep', 'running'].includes(matchPhase) ? 'PAUSAR' : matchPhase === 'paused' ? 'REANUDAR' : matchPhase === 'finished' ? 'NUEVO' : 'INICIAR'}
            </button>
            <button type="button" onClick={sumarMinutoMatch} style={esMovil ? s.compControlBtn : { ...s.compControlBtn, ...s.compControlBtnWide }} title="Añadir un minuto">
                <VaultIcon name="plus" size={14} /> 1:00
            </button>
            <button type="button" onClick={resetMatch} style={esMovil ? s.compControlBtn : { ...s.compControlBtn, ...s.compControlBtnWide }} title="Reiniciar combate">
                <VaultIcon name="rotate" size={14} />
            </button>
            <button type="button" onClick={finalizarMatch} style={esMovil ? s.compControlBtn : { ...s.compControlBtn, ...s.compControlBtnWide }} title="Finalizar combate" disabled={matchPhase === 'idle' || matchPhase === 'finished'}>
                <VaultIcon name="flag" size={14} />
            </button>
            <button type="button" onClick={deshacerAccion} style={esMovil ? s.compControlBtn : { ...s.compControlBtn, ...s.compControlBtnWide }} title="Deshacer última acción" disabled={historial.length === 0}>
                <VaultIcon name="undo" size={14} />
            </button>
        </div>
    );

    const panelA = (
        <PanelAtleta
            numero={1}
            nombre={competidor1}
            setNombre={setCompetidor1}
            score={score1}
            advantage={advantage1}
            penalty={penalty1}
            acciones={acciones}
            rules={rules}
            soloSumision={soloSumision}
            puedePuntuar={puedePuntuar}
            aplicarAccion={aplicarAccion}
            compacto={esMovil}
            ganador={ganadorA}
            bloquearNombre={['prep', 'running', 'paused'].includes(matchPhase)}
        />
    );

    const panelB = (
        <PanelAtleta
            numero={2}
            nombre={competidor2}
            setNombre={setCompetidor2}
            score={score2}
            advantage={advantage2}
            penalty={penalty2}
            acciones={acciones}
            rules={rules}
            soloSumision={soloSumision}
            puedePuntuar={puedePuntuar}
            aplicarAccion={aplicarAccion}
            compacto={esMovil}
            ganador={ganadorB}
            bloquearNombre={['prep', 'running', 'paused'].includes(matchPhase)}
        />
    );

    return (
        <div style={rootStyle} className="timer-comp-root">
            <style>{`
                .timer-tab { transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
                .timer-tab:hover { color: #d4af37; }
                .timer-main-btn { transition: transform 0.12s ease, background 0.2s ease, border-color 0.2s ease; }
                .timer-main-btn:hover { border-color: #d4af37 !important; }
                .timer-main-btn:active { transform: scale(0.97); }
                .comp-score-btn { transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease; }
                .comp-score-btn:not(:disabled):hover { border-color: #d4af37 !important; background: #171717 !important; }
                .comp-score-btn:not(:disabled):active { transform: scale(0.96); }
                @media (max-height: 760px) {
                    .comp-time-value { font-size: clamp(1.8rem, 7vw, 2.8rem) !important; }
                    .comp-panel { padding: 6px !important; }
                    .comp-score-btn { font-size: 0.56rem !important; }
                    .comp-score-points { font-size: 0.64rem !important; }
                    .comp-timer-controls button { padding: 6px 8px !important; }
                }
                @media (max-height: 560px) and (orientation: landscape) {
                    .timer-comp-root { padding: 4px 8px !important; }
                    .timer-header { margin-bottom: 3px !important; }
                    .timer-subtitle { display: none !important; }
                    .timer-comp-root .timer-tab { padding: 5px !important; }
                    .timer-comp-root select { padding: 3px 5px !important; font-size: 0.6rem !important; }
                    .comp-tools { gap: 5px !important; }
                    .comp-time-value { font-size: 2rem !important; }
                    .comp-timer-box-wide { padding: 5px !important; gap: 5px !important; }
                    .comp-rules-summary { display: none !important; }
                    .comp-panel { padding: 4px !important; gap: 3px !important; }
                    .comp-panel-header { gap: 3px !important; }
                    .comp-score-row { padding: 1px 4px !important; }
                    .comp-score-value { font-size: 1.2rem !important; }
                    .comp-buttons { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 3px !important; }
                    .comp-score-btn { font-size: 0.56rem !important; padding: 0 6px !important; border-radius: 5px !important; }
                    .comp-score-points { font-size: 0.62rem !important; }
                    .comp-special-row button { padding: 3px !important; font-size: 0.5rem !important; }
                    .comp-timer-controls button { padding: 5px 6px !important; font-size: 0.6rem !important; }
                }
            `}</style>

            <div style={{ width: '100%', maxWidth: seccion === 'competencia' ? anchoCompetencia : '900px', margin: '0 auto', flex: seccion === 'competencia' ? 1 : undefined, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="timer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                        <button type="button" onClick={handleBack} className="timer-main-btn" style={s.backBtn} title="Volver">
                            <VaultIcon name="chevronLeft" size={14} /> {esMovil ? '' : 'VOLVER'}
                        </button>
                        <div style={s.titleGroup}>
                            <span style={s.titleIcon}><VaultIcon name="timer" size={18} /></span>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={s.title}>TIMER BJJ</h1>
                                {!esMovil && <p style={s.subtitle} className="timer-subtitle">Intervalos, reloj y competencia</p>}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button type="button" onClick={probarSonido} style={s.iconBtn} title="Probar sonido" aria-label="Probar sonido">
                            <VaultIcon name="bell" size={15} />
                        </button>
                        <button type="button" onClick={toggleSound} style={soundEnabled ? s.iconBtnActive : s.iconBtn} title={soundEnabled ? 'Silenciar' : 'Activar sonido'} aria-label={soundEnabled ? 'Silenciar' : 'Activar sonido'}>
                            <VaultIcon name={soundEnabled ? 'volume' : 'mute'} size={15} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexShrink: 0 }}>
                    <button type="button" onClick={() => cambiarSeccion('practica')} className="timer-tab" style={seccion === 'practica' ? s.mainTabActive : s.mainTab}>
                        <VaultIcon name="timer" size={14} /> PRÁCTICA
                    </button>
                    <button type="button" onClick={() => cambiarSeccion('competencia')} className="timer-tab" style={seccion === 'competencia' ? s.mainTabActive : s.mainTab}>
                        <VaultIcon name="trophy" size={14} /> COMPETENCIA
                    </button>
                </div>

                {seccion === 'practica' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button type="button" onClick={() => cambiarModoPractica('intervalos')} className="timer-tab" style={modoPractica === 'intervalos' ? s.subTabActive : s.subTab}>
                                INTERVALOS
                            </button>
                            <button type="button" onClick={() => cambiarModoPractica('reloj')} className="timer-tab" style={modoPractica === 'reloj' ? s.subTabActive : s.subTab}>
                                RELOJ
                            </button>
                        </div>

                        {modoPractica === 'intervalos' ? (
                            <div style={s.practiceCard}>
                                <div style={s.cardHeader}>
                                    <div>
                                        <h2 style={s.cardTitle}><VaultIcon name="timer" size={16} /> Intervalos de clase</h2>
                                        <p style={s.cardHint}>Trabajo, descanso y repeticiones con avisos de sonido.</p>
                                    </div>
                                    <button type="button" onClick={probarSonido} style={s.ghostBtn}>
                                        <VaultIcon name="volume" size={12} /> PROBAR SONIDO
                                    </button>
                                </div>

                                <div style={s.presetsRow}>
                                    {PRESETS_INTERVALO.map(preset => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => aplicarPresetIntervalo(preset)}
                                            style={s.presetChip}
                                            disabled={intervaloConfigBloqueada}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                <div style={s.configGrid}>
                                    <div style={s.configGroup}>
                                        <span style={s.label}>TRABAJO · MIN:SEG</span>
                                        <div style={s.timeInputs}>
                                            <input type="number" inputMode="numeric" min="0" max="59" value={workMin} disabled={intervaloConfigBloqueada} onChange={(e) => setWorkMin(Math.max(0, Number(e.target.value) || 0))} style={s.numInput} aria-label="Minutos de trabajo" />
                                            <span style={s.timeColon}>:</span>
                                            <input type="number" inputMode="numeric" min="0" max="59" value={workSec} disabled={intervaloConfigBloqueada} onChange={(e) => setWorkSec(Math.min(59, Math.max(0, Number(e.target.value) || 0)))} style={s.numInput} aria-label="Segundos de trabajo" />
                                        </div>
                                    </div>
                                    <div style={s.configGroup}>
                                        <span style={s.label}>DESCANSO · MIN:SEG</span>
                                        <div style={s.timeInputs}>
                                            <input type="number" inputMode="numeric" min="0" max="59" value={restMin} disabled={intervaloConfigBloqueada} onChange={(e) => setRestMin(Math.max(0, Number(e.target.value) || 0))} style={s.numInput} aria-label="Minutos de descanso" />
                                            <span style={s.timeColon}>:</span>
                                            <input type="number" inputMode="numeric" min="0" max="59" value={restSec} disabled={intervaloConfigBloqueada} onChange={(e) => setRestSec(Math.min(59, Math.max(0, Number(e.target.value) || 0)))} style={s.numInput} aria-label="Segundos de descanso" />
                                        </div>
                                    </div>
                                    <div style={s.configGroup}>
                                        <span style={s.label}>RONDAS</span>
                                        <input type="number" inputMode="numeric" min="1" max="50" value={rounds} disabled={intervaloConfigBloqueada} onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} style={s.numInputWide} aria-label="Número de rondas" />
                                    </div>
                                    <div style={s.configGroup}>
                                        <span style={s.label}>PREPARACIÓN</span>
                                        <input type="number" inputMode="numeric" min="0" max="10" value={prepSec} disabled={intervaloConfigBloqueada} onChange={(e) => setPrepSec(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} style={s.numInputWide} aria-label="Segundos de preparación" />
                                    </div>
                                </div>

                                <div style={s.bigTimerBox}>
                                    <span style={{ ...s.phaseLabel, color: intervalPhase === 'rest' ? '#4CAF50' : intervalPhase === 'paused' ? '#888' : '#d4af37' }}>
                                        {etiquetaFaseIntervalo()}
                                    </span>
                                    <div style={{ ...s.bigTime, color: intervaloUrgente ? '#ff6b6b' : intervalPhase === 'rest' ? '#4CAF50' : '#d4af37' }}>
                                        {formatTime(intervalDisplay)}
                                    </div>
                                    <div style={s.timerMeta}>
                                        {intervalPhase === 'prep' && <span>Prepárate para la primera ronda</span>}
                                        {intervalPhase === 'work' && <span>Trabaja la técnica o el sparring</span>}
                                        {intervalPhase === 'rest' && <span>Recupera y prepara la siguiente ronda</span>}
                                        {intervalPhase === 'paused' && <span>Temporizador en pausa</span>}
                                        {intervalPhase === 'finished' && <span>Serie completada</span>}
                                    </div>
                                </div>

                                <div style={s.controlsRow}>
                                    <button type="button" onClick={iniciarIntervalo} className="timer-main-btn" style={s.primaryBtn}>
                                        <VaultIcon name={['prep', 'work', 'rest'].includes(intervalPhase) ? 'pause' : 'play'} size={16} />
                                        {['prep', 'work', 'rest'].includes(intervalPhase) ? 'PAUSAR' : intervalPhase === 'paused' ? 'REANUDAR' : 'INICIAR'}
                                    </button>
                                    <button type="button" onClick={resetIntervalo} className="timer-main-btn" style={s.outlineBtn}>
                                        <VaultIcon name="rotate" size={15} /> REINICIAR
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={s.practiceCard}>
                                <div style={s.cardHeader}>
                                    <div>
                                        <h2 style={s.cardTitle}><VaultIcon name="clock" size={16} /> Reloj rápido</h2>
                                        <p style={s.cardHint}>Tiempo libre para clase o cuenta atrás con avisos.</p>
                                    </div>
                                    <button type="button" onClick={probarSonido} style={s.ghostBtn}>
                                        <VaultIcon name="volume" size={12} /> PROBAR SONIDO
                                    </button>
                                </div>

                                <div style={s.modeRow}>
                                    <button type="button" onClick={() => cambiarModoReloj('up')} style={clockMode === 'up' ? s.modeChipActive : s.modeChip}>
                                        CONTAR
                                    </button>
                                    <button type="button" onClick={() => cambiarModoReloj('down')} style={clockMode === 'down' ? s.modeChipActive : s.modeChip}>
                                        CUENTA ATRÁS
                                    </button>
                                </div>

                                {clockMode === 'down' && (
                                    <div style={s.presetsRow}>
                                        {[60, 120, 180, 300, 600].map(seg => (
                                            <button key={seg} type="button" onClick={() => aplicarDuracionReloj(seg)} style={s.presetChip} disabled={clockRunning}>
                                                {seg / 60} min
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div style={s.bigTimerBox}>
                                    <span style={s.phaseLabel}>{clockMode === 'up' ? 'TIEMPO TRANSCURRIDO' : 'TIEMPO RESTANTE'}</span>
                                    <div style={s.bigTime}>{formatTime(clockDisplay)}</div>
                                    <div style={s.timerMeta}>{clockStatus}</div>
                                </div>

                                <div style={s.controlsRow}>
                                    <button type="button" onClick={iniciarReloj} className="timer-main-btn" style={s.primaryBtn}>
                                        <VaultIcon name={clockRunning ? 'pause' : 'play'} size={16} />
                                        {clockRunning ? 'PAUSAR' : 'INICIAR'}
                                    </button>
                                    <button type="button" onClick={sumarMinutoReloj} disabled={clockMode !== 'down'} className="timer-main-btn" style={{ ...s.outlineBtn, opacity: clockMode !== 'down' ? 0.4 : 1 }}>
                                        <VaultIcon name="plus" size={15} /> 1 MIN
                                    </button>
                                    <button type="button" onClick={resetReloj} className="timer-main-btn" style={s.outlineBtn}>
                                        <VaultIcon name="rotate" size={15} /> REINICIAR
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
                        <div className="comp-tools" style={s.compTools}>
                            <div style={s.compToolGroup}>
                                <span style={s.label}>REGLAS</span>
                                <select
                                    value={rulesKey}
                                    onChange={(e) => {
                                        const valor = e.target.value;
                                        cambiarReglas(valor).then((ok) => {
                                            if (!ok) e.target.value = rulesKey;
                                        });
                                    }}
                                    style={s.compSelect}
                                    disabled={['prep', 'running', 'paused'].includes(matchPhase)}
                                >
                                    <option value="ibjjf">IBJJF 2026</option>
                                    <option value="adcc">ADCC</option>
                                    <option value="submission">SUB ONLY</option>
                                    <option value="custom">PERSONALIZADO</option>
                                </select>
                            </div>
                            <div style={s.compToolGroup}>
                                <span style={s.label}>DURACIÓN</span>
                                <select
                                    value={matchDuration}
                                    disabled={['prep', 'running', 'paused'].includes(matchPhase)}
                                    onChange={(e) => {
                                        const seg = Number(e.target.value);
                                        setMatchDuration(seg);
                                        setMatchTimeLeft(seg);
                                    }}
                                    style={s.compSelect}
                                >
                                    {[...new Set([...Array.from({ length: 20 }, (_, i) => (i + 1) * 60), matchDuration])].sort((a, b) => a - b).map(seg => (
                                        <option key={seg} value={seg}>{seg / 60} min</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={abrirAjustesReglas}
                                style={{ ...s.iconBtn, opacity: ['prep', 'running', 'paused'].includes(matchPhase) ? 0.4 : 1, cursor: ['prep', 'running', 'paused'].includes(matchPhase) ? 'not-allowed' : 'pointer' }}
                                title="Ajustar reglas personalizadas"
                                aria-label="Ajustar reglas personalizadas"
                                disabled={['prep', 'running', 'paused'].includes(matchPhase)}
                            >
                                <VaultIcon name="settings" size={14} />
                            </button>
                            <span style={s.rulesBadge}>{rules.label}</span>
                        </div>

                        {esMovil ? (
                            <>
                                <div style={s.compTimerBox}>
                                    {bloqueReloj}
                                    {bloqueControles}
                                </div>
                                <div style={s.compAthletes}>
                                    {panelA}
                                    {panelB}
                                </div>
                            </>
                        ) : (
                            <div style={s.compDesktopGrid}>
                                {panelA}
                                <div style={s.compCenter}>
                                    <div className="comp-timer-box-wide" style={s.compTimerBoxWide}>
                                        {bloqueReloj}
                                        {bloqueControles}
                                        <div className="comp-rules-summary" style={s.compRulesSummary}>{resumenReglas}</div>
                                    </div>
                                </div>
                                {panelB}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL DE REGLAS PERSONALIZADAS */}
            {showRulesSettings && (
                <div style={s.modalOverlay}>
                    <div style={s.modalCard}>
                        <div style={s.modalHeader}>
                            <h3 style={s.modalTitle}><VaultIcon name="settings" size={16} /> Reglas personalizadas</h3>
                            <button type="button" onClick={() => setShowRulesSettings(false)} style={s.iconBtn} aria-label="Cerrar">
                                <VaultIcon name="close" size={16} />
                            </button>
                        </div>

                        <div style={s.rulesGrid}>
                            {ORDEN_PUNTOS.map(id => (
                                <label key={id} style={s.rulesField}>
                                    <span style={s.label}>{ETIQUETAS_ACCION[id]}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={customDraft.points?.[id] ?? 0}
                                        onChange={(e) => setCustomDraft(prev => ({
                                            ...prev,
                                            points: { ...prev.points, [id]: Math.max(0, Number(e.target.value) || 0) }
                                        }))}
                                        style={s.numInputWide}
                                    />
                                </label>
                            ))}
                        </div>

                        <div style={s.rulesOptions}>
                            <label style={s.checkLabel}>
                                <input type="checkbox" checked={Boolean(customDraft.showAdvantage)} onChange={(e) => setCustomDraft(prev => ({ ...prev, showAdvantage: e.target.checked }))} />
                                Ventajas
                            </label>
                            <label style={s.checkLabel}>
                                <input type="checkbox" checked={Boolean(customDraft.showPenalty)} onChange={(e) => setCustomDraft(prev => ({ ...prev, showPenalty: e.target.checked }))} />
                                Castigos
                            </label>
                            <label style={s.checkLabel}>
                                DQ por castigos
                                <select
                                    value={customDraft.maxPenalties ?? ''}
                                    onChange={(e) => setCustomDraft(prev => ({ ...prev, maxPenalties: e.target.value ? Number(e.target.value) : null }))}
                                    style={s.compSelect}
                                >
                                    <option value="">No</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
                            </label>
                        </div>

                        <div style={s.modalActions}>
                            <button type="button" onClick={() => setShowRulesSettings(false)} style={s.outlineBtn}>CANCELAR</button>
                            <button type="button" onClick={guardarAjustesReglas} style={s.primaryBtn}>GUARDAR REGLAS</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const PanelAtleta = ({ numero, nombre, setNombre, score, advantage, penalty, acciones, rules, soloSumision, puedePuntuar, aplicarAccion, compacto, ganador, bloquearNombre }) => (
    <div className="comp-panel" style={{
        ...s.compPanel,
        borderLeft: `2px solid ${ganador ? '#4CAF50' : numero === 1 ? '#d4af37' : '#888'}`,
        boxShadow: ganador ? 'inset 0 0 0 1px rgba(76,175,80,0.45)' : 'none'
    }}>
        <div className="comp-panel-header" style={s.compPanelHeader}>
            <span style={{ ...s.cornerBadge, backgroundColor: numero === 1 ? '#d4af37' : '#888' }}>{numero === 1 ? 'A' : 'B'}</span>
            <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={numero === 1 ? 'Atleta A' : 'Atleta B'}
                style={{ ...s.compNameInput, opacity: bloquearNombre ? 0.75 : 1 }}
                maxLength={24}
                disabled={bloquearNombre}
                aria-label={numero === 1 ? 'Nombre del atleta A' : 'Nombre del atleta B'}
            />
            {ganador && (
                <span style={s.winnerTag}>
                    <VaultIcon name="trophy" size={11} color="#4CAF50" /> GANADOR
                </span>
            )}
        </div>

        {!soloSumision && (
            <div className="comp-score-row" style={s.compScoreRow}>
                <div style={s.compScoreBlock}>
                    <span style={s.scoreLabel}>PTS</span>
                    <strong className="comp-score-value" style={s.compScoreValue}>{score}</strong>
                </div>
                {rules.showAdvantage && (
                    <div style={s.compSmallStat}>
                        <span style={s.scoreLabel}>ADV</span>
                        <strong style={{ ...s.compSmallValue, color: '#d4af37' }}>{advantage}</strong>
                    </div>
                )}
                {rules.showPenalty && (
                    <div style={s.compSmallStat}>
                        <span style={s.scoreLabel}>PEN</span>
                        <strong style={{ ...s.compSmallValue, color: '#ff6b6b' }}>{penalty}</strong>
                    </div>
                )}
            </div>
        )}

        <div className="comp-buttons" style={s.compButtons}>
            {soloSumision ? (
                <div style={s.soloSumisionBody}>
                    <span style={s.soloSumisionIcon}><VaultIcon name="trophy" size={compacto ? 26 : 34} color="#d4af37" /></span>
                    <strong style={s.soloSumisionTitle}>SIN PUNTOS</strong>
                    <span style={s.soloSumisionHint}>Solo finalización o decisión de los jueces.</span>
                </div>
            ) : (
                <>
                    {acciones.map(accion => (
                        <button
                            key={accion.id}
                            type="button"
                            className="comp-score-btn"
                            disabled={!puedePuntuar}
                            onClick={() => aplicarAccion(numero, accion.id)}
                            style={!puedePuntuar ? { ...s.compScoreBtn, ...s.compScoreBtnDisabled } : s.compScoreBtn}
                        >
                            <span>{accion.label}</span>
                            <strong className="comp-score-points" style={s.compScorePoints}>{typeof accion.puntos === 'number' ? `+${accion.puntos}` : accion.puntos}</strong>
                        </button>
                    ))}
                </>
            )}
        </div>

        <div className="comp-special-row" style={s.compSpecialRow}>
            <button
                type="button"
                disabled={!puedePuntuar}
                onClick={() => aplicarAccion(numero, 'sumision')}
                style={!puedePuntuar ? { ...s.compSpecialBtn, ...s.compSpecialDisabled } : { ...s.compSpecialBtn, backgroundColor: '#d4af37', color: '#000' }}
            >
                <VaultIcon name="trophy" size={12} color={puedePuntuar ? '#000' : '#555'} /> SUMISIÓN
            </button>
            <button
                type="button"
                disabled={!puedePuntuar}
                onClick={() => aplicarAccion(numero, 'dq')}
                style={!puedePuntuar ? { ...s.compSpecialBtn, ...s.compSpecialDisabled } : { ...s.compSpecialBtn, borderColor: 'rgba(255,68,68,0.6)', color: '#ff6b6b' }}
            >
                <VaultIcon name="alert" size={12} color={puedePuntuar ? '#ff6b6b' : '#555'} /> DQ
            </button>
        </div>
    </div>
);

const s = {
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid #444', color: '#ccc', padding: '7px 9px', cursor: 'pointer', borderRadius: '7px', fontSize: '0.68rem', fontWeight: 'bold', flexShrink: 0 },
    titleGroup: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
    titleIcon: { width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #d4af37', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { color: '#d4af37', margin: 0, fontSize: 'clamp(0.95rem, 3.5vw, 1.25rem)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 },
    subtitle: { color: '#777', margin: '2px 0 0 0', fontSize: '0.62rem' },
    iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '7px', cursor: 'pointer', flexShrink: 0 },
    iconBtnActive: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'rgba(212,175,55,0.12)', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '7px', cursor: 'pointer', flexShrink: 0 },

    mainTab: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, background: '#0d0d0d', border: '1px solid #222', color: '#777', padding: '8px', borderRadius: '7px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' },
    mainTabActive: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, background: '#d4af37', border: '1px solid #d4af37', color: '#000', padding: '8px', borderRadius: '7px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' },
    subTab: { flex: 1, background: 'transparent', border: '1px solid #222', color: '#777', padding: '6px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer' },
    subTabActive: { flex: 1, background: 'rgba(212,175,55,0.1)', border: '1px solid #d4af37', color: '#d4af37', padding: '6px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer' },

    practiceCard: { backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' },
    cardTitle: { color: '#d4af37', fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '7px' },
    cardHint: { color: '#666', fontSize: '0.65rem', margin: '4px 0 0 0', lineHeight: 1.35 },
    ghostBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'transparent', border: '1px solid rgba(212,175,55,0.45)', color: '#d4af37', padding: '7px 9px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 },
    presetsRow: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    presetChip: { background: '#0b0b0b', border: '1px solid #333', color: '#aaa', borderRadius: '999px', padding: '6px 10px', fontSize: '0.62rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },

    configGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px' },
    configGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#888', fontSize: '0.58rem', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' },
    timeInputs: { display: 'flex', alignItems: 'center', gap: '6px' },
    timeColon: { color: '#666', fontSize: '0.9rem', fontWeight: 'bold' },
    numInput: { width: '54px', boxSizing: 'border-box', backgroundColor: '#000', border: '1px solid #333', color: '#fff', borderRadius: '5px', padding: '7px 4px', fontSize: '0.8rem', textAlign: 'center', outline: 'none' },
    numInputWide: { width: '100%', backgroundColor: '#000', border: '1px solid #333', color: '#fff', borderRadius: '5px', padding: '7px', fontSize: '0.78rem', textAlign: 'center', outline: 'none', boxSizing: 'border-box' },

    bigTimerBox: { background: '#080808', border: '1px solid #262626', borderRadius: '9px', padding: '12px', textAlign: 'center', marginTop: '4px' },
    phaseLabel: { display: 'block', color: '#d4af37', fontSize: '0.62rem', letterSpacing: '1.5px', fontWeight: 'bold', textTransform: 'uppercase' },
    bigTime: { color: '#d4af37', fontSize: 'clamp(2.8rem, 12vw, 4.5rem)', fontWeight: 'bold', lineHeight: 1, letterSpacing: '2px', fontVariantNumeric: 'tabular-nums', margin: '6px 0 4px' },
    timerMeta: { color: '#666', fontSize: '0.64rem', minHeight: '15px' },
    controlsRow: { display: 'flex', gap: '7px', flexWrap: 'wrap' },
    primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, minWidth: '120px', background: '#d4af37', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.72rem', cursor: 'pointer' },
    outlineBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, minWidth: '110px', background: 'transparent', color: '#aaa', border: '1px solid #444', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.72rem', cursor: 'pointer' },

    modeRow: { display: 'flex', gap: '6px' },
    modeChip: { flex: 1, background: '#0b0b0b', border: '1px solid #333', color: '#888', padding: '7px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' },
    modeChipActive: { flex: 1, background: '#d4af37', border: '1px solid #d4af37', color: '#000', padding: '7px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' },

    compTools: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 },
    compToolGroup: { display: 'flex', flexDirection: 'column', gap: '2px' },
    compSelect: { backgroundColor: '#0b0b0b', border: '1px solid #333', color: '#fff', padding: '6px 8px', borderRadius: '5px', fontSize: '0.68rem', outline: 'none' },
    rulesBadge: { marginLeft: 'auto', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '5px', padding: '4px 7px', fontSize: '0.58rem', fontWeight: 'bold' },

    compTimerBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '9px', padding: '9px 11px', flexWrap: 'wrap', flexShrink: 0 },
    compTimerBoxWide: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: '16px', backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '9px', padding: '18px 12px', flex: 1, minHeight: 0 },
    compClockBlock: { textAlign: 'center', width: '100%' },
    compDesktopGrid: { display: 'grid', gridTemplateColumns: 'minmax(230px, 1fr) minmax(205px, 0.85fr) minmax(230px, 1fr)', gap: '8px', flex: 1, minHeight: 0 },
    compCenter: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 },
    compRulesSummary: { color: '#666', fontSize: '0.58rem', lineHeight: 1.45, textAlign: 'center', borderTop: '1px solid #1c1c1c', paddingTop: '9px' },
    compTimerControlsWide: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' },
    compPrimaryBtnWide: { gridColumn: '1 / -1', padding: '11px', fontSize: '0.72rem' },
    compControlBtnWide: { padding: '9px 8px', fontSize: '0.68rem' },
    compTimeValue: { color: '#d4af37', fontSize: 'clamp(2rem, 7vw, 4.6rem)', fontWeight: 'bold', lineHeight: 1, letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' },
    compStatus: { color: '#888', fontSize: '0.62rem', letterSpacing: '0.8px', fontWeight: 'bold', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' },
    compTimerControls: { display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' },
    compPrimaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#d4af37', color: '#000', border: 'none', padding: '7px 11px', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.66rem', cursor: 'pointer' },
    compControlBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'transparent', border: '1px solid #333', color: '#aaa', padding: '6px 8px', borderRadius: '5px', fontSize: '0.62rem', cursor: 'pointer' },

    compAthletes: { display: 'flex', gap: '8px', flex: 1, minHeight: 0 },
    compPanel: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '9px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' },
    compPanelHeader: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
    cornerBadge: { width: '20px', height: '20px', borderRadius: '50%', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    winnerTag: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#4CAF50', fontSize: '0.46rem', fontWeight: 'bold', letterSpacing: '0.4px', flexShrink: 0 },
    compNameInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#d4af37', fontSize: 'clamp(0.7rem, 1.1vw, 0.95rem)', fontWeight: 'bold', padding: '3px 2px', outline: 'none', textAlign: 'center' },
    compScoreRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '4px', backgroundColor: '#111', borderRadius: '6px', padding: '4px 6px', flexShrink: 0 },
    compScoreBlock: { textAlign: 'center' },
    compScoreValue: { display: 'block', color: '#d4af37', fontSize: 'clamp(1.6rem, 4vw, 3rem)', lineHeight: 1, fontWeight: 'bold' },
    compSmallStat: { textAlign: 'center' },
    compSmallValue: { display: 'block', fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', lineHeight: 1, fontWeight: 'bold' },
    scoreLabel: { color: '#666', fontSize: '0.5rem', letterSpacing: '0.5px', display: 'block' },
    soloSumisionBody: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '7px', textAlign: 'center', border: '1px dashed rgba(212,175,55,0.25)', borderRadius: '8px', padding: '12px' },
    soloSumisionIcon: { width: '52px', height: '52px', borderRadius: '50%', border: '1px solid rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.06)' },
    soloSumisionTitle: { color: '#d4af37', fontSize: '0.72rem', letterSpacing: '1px', fontWeight: 'bold' },
    soloSumisionHint: { color: '#777', fontSize: '0.58rem', lineHeight: 1.35, maxWidth: '150px' },
    compButtons: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr', gridAutoRows: '1fr', gap: '4px' },
    compScoreBtn: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '6px', background: '#111', border: '1px solid #2a2a2a', color: '#ccc', borderRadius: '6px', padding: '0 12px', fontSize: 'clamp(0.7rem, 1vw, 0.9rem)', lineHeight: 1.05, cursor: 'pointer', minHeight: 0, textAlign: 'left' },
    compScoreBtnDisabled: { background: '#080808', borderColor: '#1c1c1c', color: '#444', cursor: 'not-allowed' },
    compScorePoints: { color: '#d4af37', fontSize: 'clamp(0.82rem, 1.4vw, 1.05rem)', fontWeight: 'bold', flexShrink: 0 },
    compSpecialRow: { display: 'flex', gap: '4px', flexShrink: 0 },
    compSpecialBtn: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', background: '#111', border: '1px solid #333', color: '#aaa', borderRadius: '5px', padding: '5px 3px', fontSize: '0.55rem', fontWeight: 'bold', cursor: 'pointer' },
    compSpecialDisabled: { background: '#080808', borderColor: '#1c1c1c', color: '#444', cursor: 'not-allowed' },

    modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.96)', zIndex: 10020, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', boxSizing: 'border-box' },
    modalCard: { width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: '#0d0d0d', border: '1px solid #d4af37', borderRadius: '10px', padding: '16px', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    modalTitle: { color: '#d4af37', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '7px' },
    rulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' },
    rulesField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    rulesOptions: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' },
    checkLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '0.68rem' },
    modalActions: { display: 'flex', gap: '8px', marginTop: '16px' }
};
