import React from 'react';
import Swal from 'sweetalert2';

const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonColor: '#d4af37',
        iconColor: tipo === 'success' ? '#4CAF50' : '#ff4444',
        border: '1px solid #d4af37',
        customClass: {
            popup: 'gold-border-alert'
        }
    });
};

const LoginPage = ({
    onLogin,
    onBack,
    onRegister,
    onGoogleLogin, // <-- Botón de Google Auth integrado
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
    const [esRegistro, setEsRegistro] = React.useState(false);

    // Verificación defensiva para evitar fallos de props
    if (!setPassword || !setEmail) {
        console.error("ERROR: LoginPage no recibió las funciones setPassword o setEmail desde App.jsx");
    }

    return (
        <div style={{
            ...styles.containerCenter,
            background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)',
            padding: '20px',
            boxSizing: 'border-box',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
        }}>

            {/* HEADER LOGO */}
            <div style={{ marginBottom: '30px', textAlign: 'center', width: '100%' }}>
                <h1 style={{
                    ...styles.goldTitle,
                    fontSize: 'clamp(2rem, 8vw, 3rem)',
                    letterSpacing: '5px',
                    margin: '0'
                }}>LA FORTUNA</h1>
                <p style={{ color: '#d4af37', fontSize: '0.8rem', marginTop: '-10px', letterSpacing: '2px' }}>
                    BRAZILIAN JIU JITSU VAULT
                </p>
            </div>

            {/* CARD DE LOGIN */}
            <div style={{
                ...styles.card,
                width: '100%',
                maxWidth: '380px',
                border: '1px solid #d4af37',
                padding: '25px',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(10, 10, 10, 0.9)',
                borderRadius: '10px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>

                <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>
                    {esRegistro ? 'SOLICITAR ACCESO' : 'INICIAR SESIÓN'}
                </h2>

                {error && (
                    <p style={{
                        color: '#ff4444',
                        fontSize: '0.8rem',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        padding: '10px',
                        borderRadius: '5px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </p>
                )}

                {/* BOTÓN GOOGLE AUTH */}
                <button
                    style={{
                        width: '100%',
                        maxWidth: '320px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        margin: '0 auto 20px auto',
                        padding: '12px',
                        backgroundColor: '#fff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'background-color 0.2s'
                    }}
                    onClick={onGoogleLogin}
                    type="button"
                >
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continuar con Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', color: '#444', margin: '15px 0' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #333' }}></div>
                    <span style={{ padding: '0 10px', fontSize: '0.75rem', textTransform: 'uppercase' }}>o con email</span>
                    <div style={{ flex: 1, borderBottom: '1px solid #333' }}></div>
                </div>

                {/* INPUTS CONDICIONALES (SOLO MODO REGISTRO) */}
                {esRegistro && (<>
                    <input
                        type="text"
                        placeholder="Nombre completo"
                        style={{
                            ...styles.input,
                            width: '100%',
                            maxWidth: '280px',
                            margin: '10px auto',
                            display: 'block'
                        }}
                        value={nombreCompleto}
                        onChange={(e) => setNombreCompleto(e.target.value)}
                    />
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ color: '#666', fontSize: '0.65rem', display: 'block', marginBottom: '5px' }}>¿ERES INSTRUCTOR? PEGA EL CÓDIGO DEL PROFESOR:</label>
                        <input
                            type="text"
                            placeholder="Código de Academia (Opcional)"
                            style={{
                                ...styles.input,
                                width: '100%',
                                maxWidth: '280px',
                                margin: '10px auto',
                                display: 'block'
                            }}
                            value={academiaIdInput}
                            onChange={(e) => setAcademiaIdInput(e.target.value)}
                        />
                    </div>
                </>
                )}

                {/* INPUT EMAIL */}
                <input
                    type="email"
                    placeholder="Email"
                    style={{
                        ...styles.input,
                        width: '100%',
                        maxWidth: '280px',
                        margin: '10px auto',
                        display: 'block'
                    }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                {/* INPUT PASSWORD */}
                <input
                    type="password"
                    placeholder="Contraseña"
                    style={{
                        ...styles.input,
                        width: '100%',
                        maxWidth: '280px',
                        margin: '10px auto',
                        display: 'block'
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {/* CHECKBOX */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '15px auto', maxWidth: '320px' }}>
                    <input type="checkbox" id="recordar" defaultChecked style={{ accentColor: '#d4af37' }} />
                    <label htmlFor="recordar" style={{ color: '#666', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Mantener sesión iniciada
                    </label>
                </div>

                {/* BOTÓN PRINCIPAL (LOGIN O REGISTRO) */}
                <button
                    style={{
                        ...styles.btnGold,
                        width: '100%',
                        maxWidth: '320px',
                        display: 'block',
                        margin: '20px auto 10px auto',
                        padding: '12px'
                    }}
                    onClick={esRegistro ? onRegister : onLogin}
                    type="button"
                >
                    {esRegistro ? 'ENVIAR SOLICITUD' : 'ENTRAR'}
                </button>

                {/* LINK CAMBIO MODO */}
                <button
                    onClick={() => setEsRegistro(!esRegistro)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        marginTop: '15px',
                        width: '100%',
                        textAlign: 'center',
                        textDecoration: 'underline'
                    }}
                    type="button"
                >
                    {esRegistro ? '¿Ya tienes cuenta? Entra' : '¿Eres nuevo? Solicita acceso'}
                </button>
            </div>
        </div>
    );
};

export default LoginPage;