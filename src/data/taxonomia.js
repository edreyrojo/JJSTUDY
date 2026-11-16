/**
 * TAXONOMÍA DEL VAULT
 * ---------------------------------------------------------------------------
 * El problema del contenido no era la cantidad, sino que los metadatos venían
 * mezclados: `eje` podía ser un string o un array, los `tags` eran marcas
 * ("NEW WAVE", "XANADU") y 1,063 de 1,064 videos no tenían subcategoría.
 *
 * Aquí definimos DOS dimensiones canónicas para clasificar cada video:
 *
 *   POSICIÓN  -> ¿DÓNDE ocurre?  (montada, media guardia, espalda...)
 *   TIPO      -> ¿QUÉ se enseña? (sumisión, pase, sweep, escape...)
 *
 * Además: modalidad (GI / NO GI), etiquetas específicas y metadatos por curso.
 * La clasificación es determinista y se recalcula sola cuando agregas videos.
 */

// ---------------------------------------------------------------------------
// Normalización de texto (sin acentos, minúsculas, sin signos)
// ---------------------------------------------------------------------------
export const normalizar = (texto = '') =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const regla = (nombre, alias) => ({
  nombre,
  alias: alias.map(normalizar).filter(Boolean),
});

// ---------------------------------------------------------------------------
// DIMENSIONES DE NAVEGACIÓN (lo que ve el usuario en el mapa)
// ---------------------------------------------------------------------------
export const DIMENSIONES = [
  { id: 'AUTORES', nombre: 'AUTORES', icono: '👤', ayuda: 'Por instructor' },
  { id: 'POSICION', nombre: 'POSICIÓN', icono: '📍', ayuda: 'Dónde ocurre' },
  { id: 'TIPO', nombre: 'TIPO', icono: '🎯', ayuda: 'Qué se enseña' },
  { id: 'MODALIDAD', nombre: 'MODALIDAD', icono: '🥋', ayuda: 'GI / NO GI' },
  { id: 'ETIQUETAS', nombre: 'ETIQUETAS', icono: '🏷️', ayuda: 'Técnicas y sistemas' },
];

export const POSICION_GENERAL = 'GENERAL';
export const TIPO_GENERAL = 'TÉCNICA';

// ---------------------------------------------------------------------------
// POSICIONES CANÓNICAS
// El orden importa solo para desempatar: se elige la primera mención en el
// texto. Las posiciones específicas van antes que las genéricas.
// ---------------------------------------------------------------------------
export const POSICIONES = [
  regla('CRUCIFIJO', ['crucifix', 'crucifijo', 'crucifixed']),
  regla('TORTUGA', ['turtle', 'tortuga', 'turtle position']),
  regla('MONTADA', ['mount', 'mounted', 'montada', 'top mount', 'top pins mount', 'mount position']),
  regla('CONTROL LATERAL', ['side control', 'side mount', 'lateral', '100 kilos', 'cien kilos', 'cross side', 'sidecontrol']),
  regla('NORTE SUR', ['north south', 'norte sur', 'northsouth', 'north and south']),
  regla('ESPALDA', ['back control', 'back mount', 'rear mount', 'espalda', 'back attack', 'back attacks', 'back escape', 'back escapes', 'taking the back', 'take the back', 'back take', 'back takes', 'backtake', 'from the back', 'the back']),
  regla('MEDIA GUARDIA', ['half guard', 'halfguard', 'media guardia', 'deep half', 'z guard', 'zguard', 'lockdown', 'lock down', 'half']),
  regla('GUARDIA CERRADA', ['closed guard', 'guardia cerrada']),
  regla('GUARDIA MARIPOSA', ['butterfly guard', 'butterfly', 'mariposa']),
  regla('DE LA RIVA', ['de la riva', 'delariva', 'dlr']),
  regla('REVERSA', ['reverse de la riva', 'reversa', 'rdlr', 'inverted guard', 'invertida', 'inverted']),
  regla('50/50', ['50 50', 'fifty fifty', 'fiftyfifty']),
  regla('X GUARD', ['x guard', 'xguard', 'single leg x', 'single leg x guard', 'slx']),
  regla('K GUARD', ['k guard', 'kguard']),
  regla('LASSO', ['lasso', 'lasso guard']),
  regla('OCTOPUS', ['octopus', 'octopus guard']),
  regla('RUBBER GUARD', ['rubber guard', 'rubberguard']),
  regla('XANADU', ['xanadu', 'xanadu guard']),
  regla('GUARDIA ABIERTA', ['open guard', 'guardia abierta', 'seated guard', 'supine guard', 'sit up guard', 'situp guard', 'seated position', 'supine position']),
  regla('PIERNAS', ['leg lock', 'leg locks', 'leglock', 'leglocks', 'leg entanglement', 'leg entanglements', 'leg attacks', 'the legs', 'ashi', 'ashi garami', 'saddle', 'honey hole', '411', 'inside sankaku']),
  regla('FRONT HEADLOCK', ['front headlock', 'front head lock', 'front head']),
  regla('DE PIE', ['standing', 'stand up', 'standup', 'takedown', 'take down', 'takedowns', 'wrestling', 'clinch', 'feet to floor']),
  regla('GUARDIA', ['guard', 'guardia', 'guards']),
];

// ---------------------------------------------------------------------------
// TIPOS CANÓNICOS (qué se enseña)
// El orden ES la prioridad: "leg lock escapes" debe ser ESCAPE, no LEG LOCK.
// ---------------------------------------------------------------------------
export const TIPOS = [
  regla('INTRO', ['intro', 'introduction', 'trailer', 'teaser', 'welcome', 'sponsors', 'sponsor', 'cover', 'promotional', 'presentacion']),
  regla('ESCAPES', ['escape', 'escapes', 'escaping', 'defense', 'defence', 'defensa', 'defensas', 'defensive', 'survival', 'surviving', 'countering', 'counter to', 'self defense', 'self defence']),
  regla('RETENCIÓN', ['retention', 'retain', 'guard retention']),
  regla('PASES', ['pass', 'passes', 'passing', 'toreando', 'torreando', 'leg drag', 'legdrag', 'stack pass', 'stacking', 'over under', 'overunder', 'duck under', 'duckunder', 'knee cut', 'kneecut', 'knee slide', 'long step', 'longstep', 'tripod', 'headquarters', 'bull fighter', 'bullfighter', 'body lock pass', 'throw by', 'throwby', 'smash pass', 'smashpass']),
  regla('DERRIBOS', ['takedown', 'take down', 'takedowns', 'throw', 'throws', 'single leg', 'double leg', 'judo', 'wrestling', 'ankle pick', 'snap down', 'makikomi', 'seoi nage', 'uchi mata', 'osoto', 'harai', 'tomoe nage']),
  regla('SWEEPS', ['sweep', 'sweeps', 'sweeping', 'barrida', 'barridas', 'ko soto', 'kisoto', 'reversal']),
  regla('TOMAS DE ESPALDA', ['back take', 'back takes', 'backtake', 'backtakes', 'taking the back', 'take the back']),
  regla('JUEGOS / DRILLS', ['games', 'drill', 'drills', 'exercise', 'exercises', 'task based', 'taskbased', 'positional sparring', 'training games', 'mini game', 'mini games']),
  regla('SPARRING', ['sparring', 'rolling', 'rolls', 'narrated rolling', 'narrated rolls', 'competition', 'competicion', 'adcc', 'match', 'matches', 'scrimmage', 'live rounds']),
  regla('ACONDICIONAMIENTO', ['swole', 'conditioning', 'acondicionamiento', 'strength', 'mobility', 'warm up', 'warmup', 'stretching', 'stretch', 'flexibility', 'workout']),
  regla('LEG LOCKS', ['leg lock', 'leg locks', 'leglock', 'leglocks', 'heel hook', 'heelhook', 'kneebar', 'knee bar', 'toe hold', 'toehold', 'ankle lock', 'anklelock', 'calf slicer', 'calfslicer', 'leg entanglement', 'leg attack', 'leg attacks', 'ashi', 'saddle', 'honey hole', '411']),
  regla('SUMISIONES', ['submission', 'submissions', 'choke', 'chokes', 'strangle', 'strangles', 'armbar', 'arm bar', 'armbars', 'triangle', 'kimura', 'americana', 'omoplata', 'guillotine', 'darce', 'd arce', 'anaconda', 'buggy', 'twister', 'rear naked', 'rnc', 'mata leao', 'wristlock', 'wrist lock', 'joint lock', 'finish', 'finishes', 'finishing', 'finalizacion', 'sumision', 'attack', 'attacks', 'attacking']),
  regla('CONTROLES', ['controls', 'controlling', 'pin', 'pins', 'pinning', 'pressure', 'securing', 'ride', 'rides']),
  regla('ENTRADAS', ['entry', 'entries', 'entering', 'enter', 'set up', 'setup', 'grips', 'grip', 'off balancing', 'offbalancing', 'transition', 'transitions', 'entries']),
  regla('CONCEPTOS', ['concept', 'concepts', 'principle', 'principles', 'theory', 'mindset', 'strategy', 'timing', 'fundamentals', 'fundamental', 'basics', 'base', 'connection', 'breathing', 'empowerment', 'masters tips', 'tips', 'overview', 'what will be covered', 'troubleshooting', 'conclusion', 'summary', 'private lesson', 'coaching']),
];

// ---------------------------------------------------------------------------
// ETIQUETAS ESPECÍFICAS (técnicas, sistemas y formatos)
// Se buscan TODAS las coincidencias, no solo la primera.
// ---------------------------------------------------------------------------
export const ETIQUETAS = [
  regla('ARMBAR', ['armbar', 'arm bar', 'juji gatame']),
  regla('TRIANGLE', ['triangle', 'triangulo', 'triangle choke']),
  regla('KIMURA', ['kimura']),
  regla('AMERICANA', ['americana']),
  regla('OMOPLATA', ['omoplata']),
  regla('GUILLOTINE', ['guillotine', 'guillotina']),
  regla('DARCE', ['darce', 'd arce']),
  regla('ANACONDA', ['anaconda']),
  regla('REAR NAKED', ['rear naked', 'rnc', 'mata leao']),
  regla('BUGGY CHOKE', ['buggy', 'buggy choke']),
  regla('TWISTER', ['twister']),
  regla('HEEL HOOK', ['heel hook', 'heelhook']),
  regla('KNEEBAR', ['kneebar', 'knee bar']),
  regla('TOE HOLD', ['toe hold', 'toehold']),
  regla('ANKLE LOCK', ['ankle lock', 'anklelock']),
  regla('CALF SLICER', ['calf slicer', 'calfslicer']),
  regla('WRIST LOCK', ['wrist lock', 'wristlock']),
  regla('EZEKIEL', ['ezekiel']),
  regla('BOW AND ARROW', ['bow and arrow', 'bow arrow']),
  regla('COLLAR CHOKE', ['collar choke', 'cross collar']),
  regla('CLOCK CHOKE', ['clock choke']),
  regla('STRAITJACKET', ['straitjacket', 'strait jacket']),
  regla('TRUCK', ['the truck', 'truck position']),
  regla('BERIMBOLO', ['berimbolo', 'bolo']),
  regla('KISS OF THE DRAGON', ['kiss of the dragon']),
  regla('LEG DRAG', ['leg drag', 'legdrag']),
  regla('DUCK UNDER', ['duck under', 'duckunder']),
  regla('TORREANDO', ['toreando', 'torreando']),
  regla('KNEE CUT', ['knee cut', 'kneecut', 'knee slide']),
  regla('LONG STEP', ['long step', 'longstep']),
  regla('OVER UNDER', ['over under', 'overunder']),
  regla('STACK PASS', ['stack pass', 'stacking pass']),
  regla('TRIPOD', ['tripod']),
  regla('BODY LOCK', ['body lock', 'bodylock']),
  regla('LOCKDOWN', ['lockdown', 'lock down']),
  regla('RUBBER GUARD', ['rubber guard']),
  regla('OCTOPUS', ['octopus']),
  regla('XANADU', ['xanadu']),
  regla('DE LA RIVA', ['de la riva', 'delariva', 'dlr']),
  regla('REVERSE DE LA RIVA', ['reverse de la riva', 'rdlr']),
  regla('50/50', ['50 50', 'fifty fifty']),
  regla('X GUARD', ['x guard', 'xguard']),
  regla('K GUARD', ['k guard', 'kguard']),
  regla('SINGLE LEG X', ['single leg x', 'slx']),
  regla('LASSO', ['lasso']),
  regla('ASHI GARAMI', ['ashi', 'ashi garami']),
  regla('SADDLE', ['saddle']),
  regla('HONEY HOLE', ['honey hole']),
  regla('CRUCIFIJO', ['crucifix', 'crucifijo']),
  regla('NORTH SOUTH', ['north south']),
  regla('100 KILOS', ['100 kilos', 'cien kilos']),
  regla('KNEE ON BELLY', ['knee on belly', 'rodilla en el estomago', 'knee on stomach']),
  regla('TORTUGA', ['turtle', 'tortuga']),
  regla('SCARF HOLD', ['scarf hold', 'kata gatame']),
  regla('SINGLE LEG', ['single leg']),
  regla('DOUBLE LEG', ['double leg']),
  regla('JUDO', ['judo', 'seoi nage', 'uchi mata', 'osoto', 'harai', 'tomoe nage']),
  regla('WRESTLING', ['wrestling']),
  regla('GUARD RETENTION', ['guard retention']),
  regla('PRESSURE PASSING', ['pressure passing', 'pressure pass']),
  regla('DEFENSA PERSONAL', ['self defense', 'self defence', 'defensa personal']),  regla('QUARTER GUARD', ['quarter guard']),
  regla('TOP GAME', ['top game']),
  regla('BOTTOM GAME', ['bottom game']),
  regla('FUNDAMENTOS', ['fundamentals', 'fundamental', 'fundamentos', 'basics']),
  regla('JUEGOS', ['games', 'juegos', 'drills']),
  regla('ACONDICIONAMIENTO', ['swole', 'conditioning', 'strength', 'mobility']),
  regla('COMPETICIÓN', ['competition', 'competicion', 'adcc', 'match']),
  // Sistemas / marcas
  regla('NEW WAVE', ['new wave']),
  regla('10TH PLANET', ['10th planet', '10 planet']),
  regla('SUBMETA', ['submeta']),
  regla('AOJ', ['art of jiu jitsu', 'aoj']),
  regla('GRACIE', ['gracie', 'rickson', 'helio gracie']),
];

// ---------------------------------------------------------------------------
// METADATOS CURADOS POR CURSO
// Esto corrige lo que el nombre del curso no puede expresar por sí solo.
// `posicion` y `tipo` son los valores por defecto cuando el volumen o el
// video no dicen nada más específico.
// ---------------------------------------------------------------------------
export const CURSOS_META = {
  'Octopus Guard 2.0': { posicion: 'OCTOPUS', tipo: 'TÉCNICA', modalidad: 'NO GI', tags: ['CRAIG JONES', 'OCTOPUS', 'GUARDIA'] },
  'OCTOPUS GUARD': { posicion: 'OCTOPUS', tipo: 'TÉCNICA', modalidad: 'NO GI', tags: ['CRAIG JONES', 'OCTOPUS', 'GUARDIA'] },
  'How To Pass Quickly': { posicion: 'GUARDIA', tipo: 'PASES', modalidad: 'AMBOS', tags: ['CRAIG JONES', 'PASES'] },
  'Get Off My Legs Gringo': { posicion: 'PIERNAS', tipo: 'ESCAPES', modalidad: 'NO GI', tags: ['CRAIG JONES', 'LEG LOCKS', 'DEFENSA LEG LOCKS'] },
  'Xanadu Back Takes': { posicion: 'XANADU', tipo: 'TOMAS DE ESPALDA', modalidad: 'AMBOS', tags: ['LEVI JONES-LEARY', 'XANADU', 'ESPALDA'] },
  'Xanadu Guard': { posicion: 'XANADU', tipo: 'TÉCNICA', modalidad: 'AMBOS', tags: ['LEVI JONES-LEARY', 'XANADU', 'GUARDIA'] },
  'LEG DRAG': { posicion: 'GUARDIA', tipo: 'PASES', modalidad: 'AMBOS', tags: ['LEVI JONES-LEARY', 'LEG DRAG', 'PASES'] },
  'Crucifix - Levi Jones-Leary - Submeta': { posicion: 'CRUCIFIJO', tipo: 'TÉCNICA', modalidad: 'AMBOS', tags: ['LEVI JONES-LEARY', 'CRUCIFIJO', 'SUBMETA'] },
  'OTROS': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'AMBOS', tags: ['LEVI JONES-LEARY', 'VARIOS'] },
  'How To Beat Bigger Guys: Guard': { posicion: 'GUARDIA', tipo: 'SWEEPS', modalidad: 'GI', tags: ['BRUNO MALFACINE', 'GUARDIA'] },
  'How To Beat Bigger Guys: HalfGuard': { posicion: 'MEDIA GUARDIA', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['BRUNO MALFACINE', 'HALF GUARD'] },
  'How To Beat Bigger Guys: Open Guard': { posicion: 'GUARDIA ABIERTA', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['BRUNO MALFACINE', 'OPEN GUARD', 'PASES'] },
  'Buggy Choke The World From Everywhere': { posicion: 'GUARDIA', tipo: 'SUMISIONES', modalidad: 'AMBOS', tags: ['PAULO MARMUND', 'BUGGY CHOKE', 'CHOKES'] },
  'RICKSON GRACIE ACADEMY': { posicion: 'GENERAL', tipo: 'CONCEPTOS', modalidad: 'GI', tags: ['GRACIE', 'FUNDAMENTOS', 'DEFENSA PERSONAL', 'ORTODOXO'] },
  'Jiu-Jitsu For Old Guys': { posicion: 'GENERAL', tipo: 'PASES', modalidad: 'GI', tags: ['BERNARDO FARIA', 'ADULTOS MAYORES', 'PASES'] },
  'Mastering The Twister': { posicion: 'ESPALDA', tipo: 'SUMISIONES', modalidad: 'NO GI', tags: ['EDDIE BRAVO', '10TH PLANET', 'TWISTER'] },
  'LOCK DOWN': { posicion: 'MEDIA GUARDIA', tipo: 'TÉCNICA', modalidad: 'NO GI', tags: ['EDDIE BRAVO', '10TH PLANET', 'LOCKDOWN'] },
  'The RubberGuard': { posicion: 'RUBBER GUARD', tipo: 'TÉCNICA', modalidad: 'NO GI', tags: ['EDDIE BRAVO', '10TH PLANET', 'RUBBER GUARD'] },
  'Getting Swole as A Grappler by Gordon Ryan': { posicion: 'GENERAL', tipo: 'ACONDICIONAMIENTO', modalidad: 'AMBOS', tags: ['GORDON RYAN', 'NEW WAVE', 'FUERZA', 'MINDSET'] },
  'Passing': { posicion: 'GUARDIA', tipo: 'PASES', modalidad: 'AMBOS', tags: ['GORDON RYAN', 'NEW WAVE', 'PASES'] },
  'Pillars Of Defense': { posicion: 'GENERAL', tipo: 'ESCAPES', modalidad: 'NO GI', tags: ['GORDON RYAN', 'NEW WAVE', 'DEFENSA'] },
  'Systematically Attacking From': { posicion: 'GENERAL', tipo: 'SUMISIONES', modalidad: 'NO GI', tags: ['GORDON RYAN', 'NEW WAVE', 'ATAQUE'] },
  'Systematically Attacking The': { posicion: 'GENERAL', tipo: 'SUMISIONES', modalidad: 'NO GI', tags: ['GORDON RYAN', 'NEW WAVE', 'ATAQUE'] },
  'My Evolution Your Revolution': { posicion: 'GENERAL', tipo: 'SPARRING', modalidad: 'NO GI', tags: ['GORDON RYAN', 'NEW WAVE', 'ADCC', 'COMPETICIÓN'] },
  'TRIPOD PASSING JOZEF CHEN': { posicion: 'GUARDIA', tipo: 'PASES', modalidad: 'NO GI', tags: ['JOZEF CHEN', 'TRIPOD', 'BODY LOCK'] },
  'AOJ K Guard Masterclass by Cole Abate': { posicion: 'K GUARD', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['COLE ABATE', 'AOJ', 'K GUARD'] },
  'AOJ Duck Under Masterclass by Cole Abate': { posicion: 'GUARDIA', tipo: 'PASES', modalidad: 'GI', tags: ['COLE ABATE', 'AOJ', 'DUCK UNDER'] },
  'Enter The System By John Danaher': { posicion: 'GENERAL', tipo: 'SUMISIONES', modalidad: 'AMBOS', tags: ['JOHN DANAHER', 'NEW WAVE', 'ENTER THE SYSTEM'] },
  'Go Further Faster': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['JOHN DANAHER', 'NEW WAVE', 'FUNDAMENTOS'] },
  'GI AGELESS': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['JOHN DANAHER', 'AGELESS'] },
  'NO GI AGELESS': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'NO GI', tags: ['JOHN DANAHER', 'AGELESS'] },
  'Feet to Floor': { posicion: 'DE PIE', tipo: 'DERRIBOS', modalidad: 'GI', tags: ['JOHN DANAHER', 'NEW WAVE', 'DERRIBOS'], volumenes: { 'volume 1 fundamental standing skills': { posicion: 'DE PIE', tipo: 'DERRIBOS' } } },
  'Youtube': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'AMBOS', tags: ['JOHN DANAHER', 'YOUTUBE', 'COMPETICIÓN', 'COACHING', 'FUNDAMENTOS'] },
  'Gracie Combatives 2.0': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'GI', tags: ['GRACIE', 'FUNDAMENTOS'] },
  'Task Based Games to Rapidly Improve your Jiu-jitsu by Kit Dale': { posicion: 'GENERAL', tipo: 'JUEGOS / DRILLS', modalidad: 'NO GI', tags: ['KIT DALE', 'NO GI GAMES', 'JUEGOS'] },
  'jiu jitsu Games By Kyvanng': { posicion: 'GENERAL', tipo: 'JUEGOS / DRILLS', modalidad: 'NO GI', tags: ['KYVANNG', 'BODEGA JIU-JITSU', 'NO GI GAMES', 'JUEGOS'] },
  'GI GAMES BY Jordan Preisinger': { posicion: 'GENERAL', tipo: 'JUEGOS / DRILLS', modalidad: 'GI', tags: ['JORDAN PREISINGER', 'GI GAMES', 'JUEGOS'] },
  'PRUEBA': { posicion: 'GENERAL', tipo: 'TÉCNICA', modalidad: 'AMBOS', tags: [] },
};

// ---------------------------------------------------------------------------
// OVERRIDES POR VIDEO (curaduría fina)
// Si un video quedó mal clasificado, se corrige aquí por su ID de Drive.
// Solo se sobrescribe lo que indiques; el resto sigue automático.
// ---------------------------------------------------------------------------
export const OVERRIDES_VIDEO = {
  // Ejemplo:
  // '1YtOMvRtLKnFjjMHZWhEFefcdYitHfVkv': {
  //   posicion: 'OCTOPUS',
  //   tipo: 'CONCEPTOS',
  //   modalidad: 'NO GI',
  //   etiquetas: ['CRAIG JONES', 'INTRO'],
  // },
};

// Compatibilidad con el `eje` original (por si algún curso no está curado)
const EJE_A_POSICION = {
  'GUARDIAS': 'GUARDIA',
  'PASES': 'GUARDIA',
  'SWEEPS': 'GUARDIA',
  'ESCAPES': 'GENERAL',
  'SOMETIMIENTOS': 'GENERAL',
  'DERRIBOS': 'DE PIE',
  'CLA': 'GENERAL',
  'SISTEMAS': 'GENERAL',
  'FUNDAMENTOS': 'GENERAL',
  'DEFENSA PERSONAL': 'GENERAL',
  'NO GI': 'GENERAL',
  'GI': 'GENERAL',
  'NEW SCHOOL': 'GENERAL',
  'ORTODOXO': 'GENERAL',
  'OTROS': 'GENERAL',
  'EJEMPLO': 'GENERAL',
};

const EJE_A_TIPO = {
  'PASES': 'PASES',
  'SWEEPS': 'SWEEPS',
  'ESCAPES': 'ESCAPES',
  'SOMETIMIENTOS': 'SUMISIONES',
  'DERRIBOS': 'DERRIBOS',
  'DEFENSA PERSONAL': 'ESCAPES',
  'CLA': 'JUEGOS / DRILLS',
  'FUNDAMENTOS': 'CONCEPTOS',
};

// ---------------------------------------------------------------------------
// MOTOR DE CLASIFICACIÓN
// ---------------------------------------------------------------------------
const coincide = (textoConEspacios, alias) => textoConEspacios.includes(` ${alias} `);

const detectarTipo = (texto) => {
  if (!texto) return null;
  const t = ` ${normalizar(texto)} `;
  for (const r of TIPOS) {
    if (r.alias.some(a => coincide(t, a))) return r.nombre;
  }
  return null;
};

const detectarPosicion = (texto) => {
  if (!texto) return null;
  const t = ` ${normalizar(texto)} `;
  let mejor = null;
  for (const r of POSICIONES) {
    for (const a of r.alias) {
      const idx = t.indexOf(` ${a} `);
      if (idx === -1) continue;
      // Gana la mención más temprana; a igual posición, el alias más largo.
      if (!mejor || idx < mejor.idx || (idx === mejor.idx && a.length > mejor.len)) {
        mejor = { nombre: r.nombre, idx, len: a.length };
      }
    }
  }
  return mejor?.nombre || null;
};

const detectarEtiquetas = (texto) => {
  if (!texto) return [];
  const t = ` ${normalizar(texto)} `;
  return ETIQUETAS.filter(r => r.alias.some(a => coincide(t, a))).map(r => r.nombre);
};

const detectarModalidad = (texto) => {
  if (!texto) return null;
  const t = ` ${normalizar(texto)} `;
  const noGi = coincide(t, 'no gi') || coincide(t, 'nogi') || coincide(t, 'no-gi') ||
    coincide(t, 'sin gi') || coincide(t, 'submission grappling');
  const gi = coincide(t, 'gi') || coincide(t, 'kimono') || coincide(t, 'con gi');
  if (noGi && !gi) return 'NO GI';
  if (gi && !noGi) return 'GI';
  if (noGi && gi) return 'AMBOS';
  return null;
};

const esParteGenerica = (nombre) => {
  const n = normalizar(nombre);
  if (!n) return true;
  if (/^(vol|volume|volumen|part|parte|disc|disk|cd|capitulo|chapter|guard)\s*\d*$/.test(n)) return true;
  if (/^[ivxlcdm]+$/.test(n)) return true;
  if (/^\d+$/.test(n)) return true;
  if (/^(vol|volume|volumen|part|parte)\s*\d+\s*(de|of)?\s*\d*$/.test(n)) return true;
  return false;
};

const unir = (...partes) => partes.filter(Boolean).join(' ');
const unicos = (lista) => {
  const vistos = new Set();
  return lista.filter(t => {
    const k = normalizar(t);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
};

const ejeDeCurso = (curso) => {
  if (!curso) return [];
  if (Array.isArray(curso.eje)) return curso.eje.filter(Boolean);
  return curso.eje ? [curso.eje] : [];
};

/**
 * Clasifica un video.
 * Devuelve posicion, tipo, modalidad, etiquetas y nivel de confianza.
 */
const POSICIONES_NORM = new Set(POSICIONES.map(p => normalizar(p.nombre)));
const TIPOS_NORM = new Set(TIPOS.map(t => normalizar(t.nombre)));

export const clasificarVideo = ({ cursoKey, curso, volumen, parte }) => {
  const meta = CURSOS_META[cursoKey] || {};
  const ejes = ejeDeCurso(curso);
  const textoCurso = unir(cursoKey, curso?.titulo, ejes.join(' '), (curso?.tags || []).join(' '));
  const textoVolumen = volumen?.nombre || '';
  const textoParte = parte?.nombre || '';
  const subcategoria = parte?.subcategoria || '';
  const volMeta = meta.volumenes?.[normalizar(textoVolumen)] || null;
  const override = OVERRIDES_VIDEO[String(parte?.id || '')] || null;

  const posicion =
    override?.posicion ||
    detectarPosicion(textoParte) ||
    detectarPosicion(subcategoria) ||
    volMeta?.posicion ||
    detectarPosicion(textoVolumen) ||
    meta.posicion ||
    detectarPosicion(textoCurso) ||
    ejes.map(e => EJE_A_POSICION[normalizar(e).toUpperCase()]).find(Boolean) ||
    POSICION_GENERAL;

  const tipo =
    override?.tipo ||
    detectarTipo(textoParte) ||
    detectarTipo(subcategoria) ||
    volMeta?.tipo ||
    detectarTipo(textoVolumen) ||
    meta.tipo ||
    detectarTipo(textoCurso) ||
    ejes.map(e => EJE_A_TIPO[normalizar(e).toUpperCase()]).find(Boolean) ||
    TIPO_GENERAL;

  const modalidad =
    override?.modalidad ||
    meta.modalidad ||
    detectarModalidad(unir(textoCurso, textoVolumen, textoParte)) ||
    'AMBOS';

  const autorNorm = normalizar(curso?.autor || '');
  const etiquetas = unicos([
    ...(override?.etiquetas || []),
    ...(Array.isArray(meta.tags) && meta.tags.length > 0 ? meta.tags : (curso?.tags || [])),
    ...detectarEtiquetas(textoParte),
    ...detectarEtiquetas(subcategoria),
    ...detectarEtiquetas(textoVolumen),
    ...detectarEtiquetas(textoCurso),
  ])
    .map(t => String(t).toUpperCase())
    .filter(t => {
      const n = normalizar(t);
      // El "tag cloud" no debe repetir autores ni las facetas de posición/tipo.
      const esNombreDeAutor = n === autorNorm || (autorNorm.includes(n) && n !== 'gracie');
      const esPosicion = POSICIONES_NORM.has(n);
      const esTipo = TIPOS_NORM.has(n) || [...TIPOS_NORM].some(tn => tn.split(' ').includes(n));
      return !esNombreDeAutor && !esPosicion && !esTipo;
    });

  const generica = esParteGenerica(textoParte);
  const confianza = override ? 1 : (generica ? 0.45 : (detectarPosicion(textoParte) || detectarTipo(textoParte) ? 0.9 : 0.65));

  return { posicion, tipo, modalidad, etiquetas, confianza };
};

export const nombreDimension = (id) => DIMENSIONES.find(d => d.id === id)?.nombre || id;
