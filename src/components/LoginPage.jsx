import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};

const LoginPage = ({
    onLogin,
    onBack,
    onRegister,
    email = "",
    setEmail,
    password = "",
    setPassword,
    nombreCompleto = "",
    academiaIdInput = "",
    setAcademiaIdInput,
    setNombreCompleto,
    error,
    styles = {}
}) => {
    const [esRegistro, setEsRegistro] = useState(false);
    const [cargandoGoogle, setCargandoGoogle] = useState(false);
    const [esMovil, setEsMovil] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Verificación defensiva de props
    if (!setPassword || !setEmail) {
        console.error("ERROR: LoginPage no recibió las funciones setPassword o setEmail desde App.jsx");
    }

    // --- LÓGICA DE GOOGLE AUTH CON ENLACE Y MIGRACIÓN DE PROGRESO ---
    const handleGoogleLogin = async () => {
        setCargandoGoogle(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // Buscamos si ya existe una cuenta previa registrada con el mismo correo electrónico
                const q = query(collection(db, "usuarios"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // ¡Cuenta previa encontrada! Enlazamos y migramos el progreso al nuevo UID de Google
                    const docAntiguo = querySnapshot.docs[0];
                    const datosViejos = docAntiguo.data();

                    await setDoc(userRef, {
                        ...datosViejos,
                        uid: user.uid, // Actualizamos al UID actual de Google
                        fechaUltimoAcceso: new Date().toISOString()
                    });

                    notify("¡Cuenta sincronizada con éxito! Se recuperó tu progreso anterior.");
                } else {
                    // Usuario totalmente nuevo por Google
                    const ADMIN_MAESTRO = "zamna.ed@gmail.com";
                    const isAdmin = user.email === ADMIN_MAESTRO;

                    await setDoc(userRef, {
                        uid: user.uid,
                        email: user.email,
                        nombre: user.displayName || user.email.split('@')[0],
                        rol: isAdmin ? 'admin' : 'alumno',
                        validado: isAdmin ? true : false,
                        fechaRegistro: new Date().toISOString(),
                        vistos: []
                    });

                    if (isAdmin) {
                        notify("¡Bienvenido Maestro! Acceso total concedido.");
                    } else {
                        notify("Registro con Google exitoso. Espera a que el profesor valide tu perfil.");
                    }
                }
            } else {
                notify("¡Bienvenido de vuelta!");
            }

            if (typeof onLogin === 'function') {
                onLogin();
            }

        } catch (err) {
            console.error("Error en Google Auth:", err);
            notify("No se pudo iniciar sesión con Google: " + err.message, "error");
        } finally {
            setCargandoGoogle(false);
        }
    };

    return (
        <div style={{
            ...(styles.containerCenter || {}),
            background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)',
            padding: '20px',
            boxSizing: 'border-box',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            // 🛡️ Soporte Notch Integral (Safe Area)
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 20px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 20px)',
            width: '100%',
            overflowX: 'hidden'
        }}>

            {/* HEADER LOGO */}
            <div style={{ marginBottom: '25px', textAlign: 'center', width: '100%' }}>
                <h1 style={{
                    ...(styles.goldTitle || {}),
                    fontSize: 'clamp(1.8rem, 6vw, 2.8rem)',
                    letterSpacing: '4px',
                    margin: '0'
                }}>LA FORTUNA</h1>
                <p style={{ color: '#d4af37', fontSize: '0.75rem', marginTop: '4px', letterSpacing: '2px' }}>
                    BRAZILIAN JIU JITSU VAULT
                </p>
            </div>

            {/* CARD DE LOGIN */}
            <div style={{
                ...(styles.card || {}),
                width: '100%',
                maxWidth: '400px',
                border: '1px solid #d4af37',
                padding: '25px',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
            }}>

                <h2 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px', textAlign: 'center', letterSpacing: '1px' }}>
                    {esRegistro ? 'SOLICITAR ACCESO' : 'INICIAR SESIÓN'}
                </h2>

                {error && (
                    <p style={{
                        color: '#ff4444',
                        fontSize: '0.8rem',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        padding: '10px',
                        borderRadius: '6px',
                        textAlign: 'center',
                        marginBottom: '15px'
                    }}>
                        {error}
                    </p>
                )}

                {/* BOTÓN GOOGLE AUTH */}
                <button
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        margin: '0 auto 15px auto',
                        padding: '12px',
                        backgroundColor: '#fff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                    }}
                    onClick={handleGoogleLogin}
                    disabled={cargandoGoogle}
                    type="button"
                >
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    {cargandoGoogle ? 'Conectando...' : 'Continuar con Google'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', color: '#444', margin: '15px 0' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #333' }}></div>
                    <span style={{ padding: '0 10px', fontSize: '0.7rem', textTransform: 'uppercase', color: '#777' }}>o con email</span>
                    <div style={{ flex: 1, borderBottom: '1px solid #333' }}></div>
                </div>

                {/* INPUTS CONDICIONALES (SOLO MODO REGISTRO) */}
                {esRegistro && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ color: '#aaa', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>NOMBRE COMPLETO</label>
                            <input
                                type="text"
                                placeholder="Tu nombre y apellido"
                                style={{
                                    ...(styles.input || {}),
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    fontSize: '16px',
                                    padding: '10px'
                                }}
                                value={nombreCompleto}
                                onChange={(e) => setNombreCompleto(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={{ color: '#aaa', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>CÓDIGO DE ACADEMIA (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Código del Profesor"
                                style={{
                                    ...(styles.input || {}),
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    fontSize: '16px',
                                    padding: '10px'
                                }}
                                value={academiaIdInput}
                                onChange={(e) => setAcademiaIdInput(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* INPUT EMAIL */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#aaa', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>CORREO ELECTRÓNICO</label>
                    <input
                        type="email"
                        placeholder="tu@correo.com"
                        style={{
                            ...(styles.input || {}),
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            padding: '10px'
                        }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                {/* INPUT PASSWORD */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ color: '#aaa', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>CONTRASEÑA</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        style={{
                            ...(styles.input || {}),
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: '16px',
                            padding: '10px'
                        }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {/* CHECKBOX */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <input type="checkbox" id="recordar" defaultChecked style={{ accentColor: '#d4af37', width: '16px', height: '16px' }} />
                    <label htmlFor="recordar" style={{ color: '#888', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Mantener sesión iniciada
                    </label>
                </div>

                {/* BOTÓN PRINCIPAL (LOGIN O REGISTRO) */}
                <button
                    style={{
                        ...(styles.btnGold || {}),
                        width: '100%',
                        display: 'block',
                        padding: '12px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        borderRadius: '6px'
                    }}
                    onClick={esRegistro ? onRegister : onLogin}
                    type="button"
                >
                    {esRegistro ? 'ENVIAR SOLICITUD' : 'ENTRAR AL SISTEMA'}
                </button>

                {/* LINK CAMBIO MODO */}
                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <button
                        onClick={() => setEsRegistro(!esRegistro)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#d4af37',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                        type="button"
                    >
                        {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>
                </div>

                {/* BOTÓN VOLVER */}
                {onBack && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button
                            onClick={onBack}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                            type="button"
                        >
                            ← Volver
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;