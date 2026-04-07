graph TD
    %% El problema detectado
    App[App.jsx] -- Envía 'usuario' --> Gestion[Gestión Alumnos]
    App -- NO está enviando 'usuario' --> Planeador[Planeador Clases]
    
    %% La solución
    subgraph Sincronización de Datos
    Gestion -- Guarda en Firestore --> DB[(Firebase: Alumnos)]
    Planeador -- Debería leer de --> DB
    end

    %% Error de academiaId
    Error{¿usuario.uid?} -- No existe --> Fail[TypeError: undefined]
    Error -- Existe --> Funciona[Carga Academia]