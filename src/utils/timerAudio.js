/**
 * Sonidos del timer BJJ.
 * Se generan con Web Audio, sin archivos externos, para que funcionen offline.
 */
let audioCtx = null;

const getCtx = () => {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
};

export const unlockAudio = async () => {
    const ctx = getCtx();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* noop */ }
    }
    return ctx;
};

const tone = ({ freq = 440, duration = 0.12, volume = 0.15, type = 'sine', delay = 0 }) => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
        const start = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.03);
    } catch (error) {
        console.warn('Audio error:', error);
    }
};

export const timerSounds = {
    tick: (on) => on && tone({ freq: 700, duration: 0.06, volume: 0.08 }),
    prep: (on) => on && tone({ freq: 520, duration: 0.08, volume: 0.12 }),
    countdown: (on, n) => on && tone({ freq: n === 1 ? 980 : 620, duration: 0.09, volume: 0.14 }),
    warning: (on) => {
        if (!on) return;
        tone({ freq: 880, duration: 0.1, volume: 0.18 });
        tone({ freq: 880, duration: 0.1, volume: 0.18, delay: 0.16 });
    },
    workStart: (on) => {
        if (!on) return;
        tone({ freq: 660, duration: 0.14, volume: 0.2 });
        tone({ freq: 990, duration: 0.24, volume: 0.2, delay: 0.16 });
    },
    restStart: (on) => {
        if (!on) return;
        tone({ freq: 440, duration: 0.18, volume: 0.17 });
        tone({ freq: 330, duration: 0.28, volume: 0.17, delay: 0.2 });
    },
    finish: (on) => {
        if (!on) return;
        tone({ freq: 880, duration: 0.16, volume: 0.22 });
        tone({ freq: 880, duration: 0.16, volume: 0.22, delay: 0.22 });
        tone({ freq: 440, duration: 0.45, volume: 0.22, delay: 0.44 });
    },
    point: (on) => {
        if (!on) return;
        tone({ freq: 620, duration: 0.06, volume: 0.12, type: 'triangle' });
        tone({ freq: 880, duration: 0.08, volume: 0.09, type: 'triangle', delay: 0.05 });
    },
    test: (on) => {
        if (!on) return;
        tone({ freq: 660, duration: 0.14, volume: 0.2 });
        tone({ freq: 990, duration: 0.24, volume: 0.2, delay: 0.18 });
    }
};

export const vibrate = (pattern = [60]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch { /* noop */ }
    }
};
