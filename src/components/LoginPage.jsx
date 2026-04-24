import React from 'react';
import Swal from 'sweetalert2';
const notify = (mensaje, tipo = 'success') => {
    Swal.fire({
        text: mensaje,
        icon: tipo, // 'success', 'error', 'warning', 'info'
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
    styles = {} // Recibimos estilos globales
}) => {
    const [esRegistro, setEsRegistro] = React.useState(false);

    // Verificación defensiva
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

                {/* INPUT NOMBRE (SOLO REGISTRO) */}
                {esRegistro && (<>
                    <input
                        type="text"
                        placeholder="Nombre completo"
                        style={{ ...styles.input, width: '100%', marginBottom: '15px' }}
                        value={nombreCompleto}
                        onChange={(e) => setNombreCompleto(e.target.value)}
                    />
                    {/* NUEVO CAMPO: CÓDIGO DE ACADEMIA */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ color: '#666', fontSize: '0.65rem', display: 'block', marginBottom: '5px' }}>¿ERES INSTRUCTOR? PEGA EL CÓDIGO DEL PROFESOR:</label>
                            <input
                                type="text"
                                placeholder="Código de Academia (Opcional)"
                                style={{ ...styles.input, width: '100%', border: '1px solid #333' }}
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

            {/* BOTÓN PRINCIPAL */}
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
            >
                {esRegistro ? '¿Ya tienes cuenta? Entra' : '¿Eres nuevo? Solicita acceso'}
            </button>
        </div>
        </div >
    );
};

export default LoginPage;