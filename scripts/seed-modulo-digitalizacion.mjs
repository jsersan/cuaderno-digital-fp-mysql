#!/usr/bin/env node
// =============================================================================
//  seed-modulo-digitalizacion.mjs
//
//  Crea en Firestore el módulo «Digitalización aplicada a los sectores
//  productivos» (99 h · 3 h/semana) con:
//    - 6 Unidades Didácticas (eventos 'tema' en programación)
//    - Resultados de Aprendizaje y Criterios de Evaluación
//    - Actividades (eventos 'actividad' + documentos en colección 'tareas')
//    - Exámenes (eventos 'examen' + documentos en colección 'examenes')
//
//  Distribución según las fechas de evaluación de la app:
//    1ª Evaluación  14 sept – 16 nov   → UD1, UD2, UD3
//    2ª Evaluación  17 nov  – 19 feb   → UD4, UD5, UD6
//
//  Uso:
//    node seed-modulo-digitalizacion.mjs              # dry-run (solo muestra)
//    node seed-modulo-digitalizacion.mjs --apply      # escribe en Firestore
//
//  Requisitos:
//    - scripts/serviceAccount.json (o serviceAccount.json en la raíz)
//    - npm i firebase-admin
//
//  Variables de entorno opcionales:
//    GRUPO_ID  CICLO_ID  PROFESOR_UID  CENTRO_ID  CURSO (def. '2025-2026')
// =============================================================================

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Configuración ────────────────────────────────────────────────────────────
const APPLY     = process.argv.includes('--apply');
const CURSO     = process.env.CURSO        || '2025-2026';
const CENTRO_ID = process.env.CENTRO_ID    || 'default';
const PROFESOR  = process.env.PROFESOR_UID || '';
const CICLO_ID  = process.env.CICLO_ID     || '';
const GRUPO_ID  = process.env.GRUPO_ID     || '';

// ── Firebase ─────────────────────────────────────────────────────────────────
const keyPath = resolve(__dirname, 'scripts', 'serviceAccount.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
} catch {
  const alt = resolve(__dirname, 'serviceAccount.json');
  try {
    serviceAccount = JSON.parse(readFileSync(alt, 'utf-8'));
  } catch {
    console.error('❌ No se encontró la service account en scripts/serviceAccount.json ni en serviceAccount.json');
    process.exit(1);
  }
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Datos del módulo ─────────────────────────────────────────────────────────
const MODULO = {
  nombre: 'Digitalización aplicada a los sectores productivos',
  codigo: '1665',
  abreviatura: 'DIGA',
  curso: 1,
  horasTotales: 99,
  horasSemanales: 3,
  esFCT: false,
  esProyecto: false,
  activo: true,
  criteriosCalificacion: {
    porcentajeExamenes: 40,
    porcentajeTareas: 40,
    porcentajeActitud: 10,
    porcentajeAsistencia: 10,
    notaMinimaAprobado: 5,
    porcentajeMinimoAsistencia: 85,
    requiereAprobadoExamen: false,
    recuperacionDisponible: true
  },
  ponderacionRA: {}
};

// ── Resultados de Aprendizaje y Criterios de Evaluación ──────────────────────
const RESULTADOS_APRENDIZAJE = [
  {
    id: 'RA1', codigo: 'RA1',
    descripcion: 'Caracteriza la transformación digital identificando las tecnologías habilitadoras y los procesos de cambio organizativo.',
    porcentajePeso: 20,
    evaluacion: '1ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE1a', codigo: 'CE1a', descripcion: 'Se ha diferenciado entre digitalización y transformación digital.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE1b', codigo: 'CE1b', descripcion: 'Se han identificado los pilares del social business: plataformas, procesos y personas.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE1c', codigo: 'CE1c', descripcion: 'Se han descrito los modelos organizativos asociados a la transformación digital.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE1d', codigo: 'CE1d', descripcion: 'Se han analizado casos reales de transformación digital empresarial.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA2', codigo: 'RA2',
    descripcion: 'Identifica las tecnologías habilitadoras digitales (THD) valorando su aplicación en los sectores productivos.',
    porcentajePeso: 20,
    evaluacion: '1ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE2a', codigo: 'CE2a', descripcion: 'Se ha definido el concepto de proyecto 4.0.', porcentajePeso: 20, instrumentoEvaluacion: 'examen' },
      { id: 'CE2b', codigo: 'CE2b', descripcion: 'Se han descrito los habilitadores digitales: Big Data, Machine Learning, cobots, impresión 3D e IoT.', porcentajePeso: 40, instrumentoEvaluacion: 'tarea' },
      { id: 'CE2c', codigo: 'CE2c', descripcion: 'Se han identificado aplicaciones reales de THD en la industria.', porcentajePeso: 20, instrumentoEvaluacion: 'tarea' },
      { id: 'CE2d', codigo: 'CE2d', descripcion: 'Se ha valorado el impacto de las THD en la competitividad empresarial.', porcentajePeso: 20, instrumentoEvaluacion: 'examen' }
    ]
  },
  {
    id: 'RA3', codigo: 'RA3',
    descripcion: 'Describe los sistemas basados en cloud/nube analizando sus características, modelos y ventajas.',
    porcentajePeso: 15,
    evaluacion: '1ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE3a', codigo: 'CE3a', descripcion: 'Se ha definido el concepto de Cloud Computing y sus características.', porcentajePeso: 30, instrumentoEvaluacion: 'examen' },
      { id: 'CE3b', codigo: 'CE3b', descripcion: 'Se han identificado las ventajas del Cloud Computing.', porcentajePeso: 20, instrumentoEvaluacion: 'tarea' },
      { id: 'CE3c', codigo: 'CE3c', descripcion: 'Se han diferenciado los modelos de implementación de la nube.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE3d', codigo: 'CE3d', descripcion: 'Se han descrito los niveles o capas y otros modelos de servicios para la nube.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA4', codigo: 'RA4',
    descripcion: 'Analiza la inteligencia artificial (IA) diferenciando sus tipos y su relación con el Machine Learning y el Deep Learning.',
    porcentajePeso: 15,
    evaluacion: '2ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE4a', codigo: 'CE4a', descripcion: 'Se ha definido el concepto de inteligencia artificial.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE4b', codigo: 'CE4b', descripcion: 'Se han clasificado los tipos de inteligencia artificial.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE4c', codigo: 'CE4c', descripcion: 'Se ha diferenciado entre IA, Machine Learning y Deep Learning.', porcentajePeso: 30, instrumentoEvaluacion: 'examen' },
      { id: 'CE4d', codigo: 'CE4d', descripcion: 'Se han identificado aplicaciones prácticas de IA en sectores productivos.', porcentajePeso: 20, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA5', codigo: 'RA5',
    descripcion: 'Define Big Data y Small Data identificando sus objetivos, características (las 4 V) y la analítica predictiva.',
    porcentajePeso: 15,
    evaluacion: '2ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE5a', codigo: 'CE5a', descripcion: 'Se han definido los conceptos de Big Data y Small Data.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE5b', codigo: 'CE5b', descripcion: 'Se ha identificado el objetivo del Big Data.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE5c', codigo: 'CE5c', descripcion: 'Se han descrito las 4 V del Big Data.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE5d', codigo: 'CE5d', descripcion: 'Se ha explicado el concepto de analítica predictiva y sus aplicaciones.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA6', codigo: 'RA6',
    descripcion: 'Planifica proyectos de transformación digital identificando sus etapas y aplicaciones de uso.',
    porcentajePeso: 15,
    evaluacion: '2ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE6a', codigo: 'CE6a', descripcion: 'Se han descrito las etapas del camino de la transformación digital.', porcentajePeso: 30, instrumentoEvaluacion: 'tarea' },
      { id: 'CE6b', codigo: 'CE6b', descripcion: 'Se ha explicado la fase de convergencia y la etapa innovadora/adaptativa.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE6c', codigo: 'CE6c', descripcion: 'Se ha proyectado un caso práctico de transformación digital.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE6d', codigo: 'CE6d', descripcion: 'Se han identificado factores de éxito en la transformación digital.', porcentajePeso: 20, instrumentoEvaluacion: 'examen' }
    ]
  }
];

// ── Unidades Didácticas (eventos tipo 'tema') ────────────────────────────────
// Fechas ajustadas a las evaluaciones reales de la app (3 h/semana).
//   1ª Evaluación: 14 sept – 16 nov
//   2ª Evaluación: 17 nov – 19 feb
const COLOR_TEMA = '#1565c0';

const UNIDADES = [
  {
    id: 'UD1',
    titulo: 'UD1 · Transformación Digital y Empresarial',
    descripcion: 'Digitalización vs. transformación digital. Social business: plataformas, procesos y personas. Modelos organizativos.',
    evaluacion: '1ª Evaluación',
    fechaInicio: new Date('2025-09-15'),
    fechaFin:    new Date('2025-10-03'),
    horas: 9,
    raIds: ['RA1']
  },
  {
    id: 'UD2',
    titulo: 'UD2 · Tecnologías Habilitadoras Digitales (THD)',
    descripcion: 'Definición de proyecto 4.0. Big Data, Machine Learning, robótica colaborativa (cobots), impresión 3D aditiva, IoT.',
    evaluacion: '1ª Evaluación',
    fechaInicio: new Date('2025-10-06'),
    fechaFin:    new Date('2025-10-24'),
    horas: 9,
    raIds: ['RA2']
  },
  {
    id: 'UD3',
    titulo: 'UD3 · Sistemas basados en Cloud/Nube',
    descripcion: 'Cloud Computing: características y ventajas. Modelos de implementación. Niveles o capas (IaaS, PaaS, SaaS).',
    evaluacion: '1ª Evaluación',
    fechaInicio: new Date('2025-10-27'),
    fechaFin:    new Date('2025-11-14'),
    horas: 9,
    raIds: ['RA3']
  },
  {
    id: 'UD4',
    titulo: 'UD4 · Inteligencia Artificial (IA)',
    descripcion: 'Concepto y tipos de IA. IA vs. Machine Learning. Deep Learning. Aplicaciones en sectores productivos.',
    evaluacion: '2ª Evaluación',
    fechaInicio: new Date('2025-11-17'),
    fechaFin:    new Date('2025-12-12'),
    horas: 12,
    raIds: ['RA4']
  },
  {
    id: 'UD5',
    titulo: 'UD5 · Big Data',
    descripcion: 'Big Data y Small Data: conceptos y objetivos. Las 4 V (Volumen, Velocidad, Variedad, Veracidad). Analítica predictiva.',
    evaluacion: '2ª Evaluación',
    fechaInicio: new Date('2026-01-12'),
    fechaFin:    new Date('2026-01-30'),
    horas: 9,
    raIds: ['RA5']
  },
  {
    id: 'UD6',
    titulo: 'UD6 · Proyectos de Transformación Digital',
    descripcion: 'Etapas del camino: negocio tradicional, presencia activa, emprendimiento interno, convergencia, innovación. Factores de éxito.',
    evaluacion: '2ª Evaluación',
    fechaInicio: new Date('2026-02-02'),
    fechaFin:    new Date('2026-02-19'),
    horas: 9,
    raIds: ['RA6']
  }
];

// ── Actividades (eventos 'actividad' + documentos en 'tareas') ───────────────
const ACTIVIDADES = [
  { udId: 'UD1', evaluacion: '1ª Evaluación', titulo: 'Actividad 1 · Mapa conceptual de la transformación digital',
    descripcion: 'Elaborar un mapa conceptual que diferencie digitalización y transformación digital, con los pilares del social business.',
    fecha: new Date('2025-09-29'), fechaEntrega: new Date('2025-10-03'), raIds: ['RA1'], ceIds: ['CE1a','CE1b'], puntuacionMaxima: 10, porcentaje: 6 },

  { udId: 'UD1', evaluacion: '1ª Evaluación', titulo: 'Actividad 2 · Caso real de empresa digitalizada',
    descripcion: 'Investigar y analizar un caso real de transformación digital empresarial y exponer conclusiones.',
    fecha: new Date('2025-10-01'), fechaEntrega: new Date('2025-10-08'), raIds: ['RA1'], ceIds: ['CE1d'], puntuacionMaxima: 10, porcentaje: 5 },

  { udId: 'UD2', evaluacion: '1ª Evaluación', titulo: 'Actividad 3 · Catálogo de tecnologías habilitadoras',
    descripcion: 'Crear una ficha por cada THD (Big Data, ML, cobots, impresión 3D, IoT) con definición y aplicación industrial.',
    fecha: new Date('2025-10-20'), fechaEntrega: new Date('2025-10-24'), raIds: ['RA2'], ceIds: ['CE2b','CE2c'], puntuacionMaxima: 10, porcentaje: 6 },

  { udId: 'UD3', evaluacion: '1ª Evaluación', titulo: 'Actividad 4 · Comparativa de modelos de nube',
    descripcion: 'Tabla comparativa IaaS / PaaS / SaaS con ventajas, ejemplos comerciales y casos de uso.',
    fecha: new Date('2025-11-10'), fechaEntrega: new Date('2025-11-14'), raIds: ['RA3'], ceIds: ['CE3b','CE3d'], puntuacionMaxima: 10, porcentaje: 6 },

  { udId: 'UD4', evaluacion: '2ª Evaluación', titulo: 'Actividad 5 · Tipos de IA y aplicaciones',
    descripcion: 'Clasificar tipos de IA e identificar aplicaciones prácticas en distintos sectores productivos.',
    fecha: new Date('2025-12-09'), fechaEntrega: new Date('2025-12-15'), raIds: ['RA4'], ceIds: ['CE4b','CE4d'], puntuacionMaxima: 10, porcentaje: 6 },

  { udId: 'UD5', evaluacion: '2ª Evaluación', titulo: 'Actividad 6 · Las 4 V del Big Data',
    descripcion: 'Documentar con ejemplos las 4 V del Big Data y explicar un caso de analítica predictiva.',
    fecha: new Date('2026-01-26'), fechaEntrega: new Date('2026-01-30'), raIds: ['RA5'], ceIds: ['CE5b','CE5d'], puntuacionMaxima: 10, porcentaje: 6 },

  { udId: 'UD6', evaluacion: '2ª Evaluación', titulo: 'Actividad 7 · Proyecto de transformación digital',
    descripcion: 'Proyectar un caso práctico de transformación digital para una empresa, describiendo etapas y factores de éxito.',
    fecha: new Date('2026-02-12'), fechaEntrega: new Date('2026-02-18'), raIds: ['RA6'], ceIds: ['CE6a','CE6c'], puntuacionMaxima: 10, porcentaje: 5 }
];

// ── Exámenes (eventos 'examen' + documentos en 'examenes') ───────────────────
const EXAMENES = [
  { evaluacion: '1ª Evaluación', titulo: 'Examen 1ª Evaluación · UD1-UD3',
    descripcion: 'Prueba escrita sobre transformación digital, tecnologías habilitadoras y cloud computing.',
    fecha: new Date('2025-11-12'), tipo: 'parcial', raIds: ['RA1','RA2','RA3'],
    ceIds: ['CE1c','CE2a','CE2d','CE3a','CE3c'], puntuacionMaxima: 10, porcentaje: 20 },

  { evaluacion: '2ª Evaluación', titulo: 'Examen 2ª Evaluación · UD4-UD6',
    descripcion: 'Prueba escrita sobre inteligencia artificial, Big Data y proyectos de transformación digital.',
    fecha: new Date('2026-02-17'), tipo: 'parcial', raIds: ['RA4','RA5','RA6'],
    ceIds: ['CE4a','CE4c','CE5a','CE5c','CE6b','CE6d'], puntuacionMaxima: 10, porcentaje: 20 }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ts(date) {
  return Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}
function log(tag, msg) {
  const prefix = APPLY ? '✅' : '🔍';
  console.log(`${prefix} [${tag}] ${msg}`);
}

// ── Resolver profesor ────────────────────────────────────────────────────────
async function resolverProfesor() {
  if (PROFESOR) return PROFESOR;
  const snap = await db.collection('usuarios')
    .where('centroId', '==', CENTRO_ID)
    .where('rol', '==', 'admin')
    .limit(1)
    .get();
  if (!snap.empty) {
    const uid = snap.docs[0].data().uid || snap.docs[0].id;
    log('PROFESOR', `Resuelto automáticamente: ${uid} (${snap.docs[0].data().nombre} ${snap.docs[0].data().apellidos})`);
    return uid;
  }
  const snap2 = await db.collection('usuarios')
    .where('centroId', '==', CENTRO_ID)
    .limit(1)
    .get();
  if (!snap2.empty) {
    const uid = snap2.docs[0].data().uid || snap2.docs[0].id;
    log('PROFESOR', `Fallback al primer usuario: ${uid}`);
    return uid;
  }
  console.error('❌ No se encontró ningún usuario en el centro. Pasa PROFESOR_UID como variable de entorno.');
  process.exit(1);
}

// ── Resolver o crear ciclo ───────────────────────────────────────────────────
async function resolverCiclo() {
  if (CICLO_ID) return CICLO_ID;
  const snap = await db.collection('ciclos')
    .where('centroId', '==', CENTRO_ID)
    .where('activo', '==', true)
    .limit(1)
    .get();
  if (!snap.empty) {
    const id = snap.docs[0].id;
    log('CICLO', `Usando ciclo existente: ${id} (${snap.docs[0].data().abreviatura || snap.docs[0].data().nombre})`);
    return id;
  }
  if (!APPLY) {
    log('CICLO', 'Se crearía un ciclo genérico (transversal)');
    return '__nuevo_ciclo__';
  }
  const ref = await db.collection('ciclos').add({
    nombre: 'Ciclo Formativo (transversal)',
    codigoOficial: 'TRANS',
    abreviatura: 'TRANS',
    nivel: 'Grado Superior',
    familia: 'Informática y Comunicaciones',
    duracion: 2000,
    cursos: 2,
    centroId: CENTRO_ID,
    modulosIds: [],
    activo: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  log('CICLO', `Ciclo creado: ${ref.id}`);
  return ref.id;
}

// ── Resolver o crear grupo ───────────────────────────────────────────────────
async function resolverGrupo(cicloId, profesorId) {
  if (GRUPO_ID) return GRUPO_ID;
  const snap = await db.collection('grupos')
    .where('cicloId', '==', cicloId)
    .where('cursoAcademico', '==', CURSO)
    .where('activo', '==', true)
    .limit(1)
    .get();
  if (!snap.empty) {
    const id = snap.docs[0].id;
    log('GRUPO', `Usando grupo existente: ${id} (${snap.docs[0].data().nombre})`);
    return id;
  }
  if (!APPLY) {
    log('GRUPO', `Se crearía el grupo "2AW3" para ${CURSO}`);
    return '__nuevo_grupo__';
  }
  const ref = await db.collection('grupos').add({
    nombre: '2AW3',
    curso: 2,
    letra: 'A',
    cicloId,
    cicloNombre: 'Ciclo Formativo (transversal)',
    centroId: CENTRO_ID,
    tutorId: profesorId,
    cursoAcademico: CURSO,
    turno: 'mañana',
    aula: '',
    alumnosIds: [],
    modulosIds: [],
    activo: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  log('GRUPO', `Grupo creado: ${ref.id}`);
  return ref.id;
}

// ── Buscar módulo existente ──────────────────────────────────────────────────
async function buscarModulo(profesorId) {
  const snap = await db.collection('modulos')
    .where('abreviatura', '==', MODULO.abreviatura)
    .where('profesorId', '==', profesorId)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  return null;
}

// ── Crear o actualizar módulo ────────────────────────────────────────────────
async function crearModulo(profesorId, cicloId) {
  const existente = await buscarModulo(profesorId);
  const payload = {
    ...MODULO,
    profesorId,
    cicloId,
    resultadosAprendizaje: RESULTADOS_APRENDIZAJE,
    updatedAt: Timestamp.now()
  };

  if (existente) {
    log('MÓDULO', `Ya existe (${existente}). Actualizando RAs y datos...`);
    if (APPLY) await db.collection('modulos').doc(existente).update(payload);
    return existente;
  }

  log('MÓDULO', `Creando "${MODULO.abreviatura} – ${MODULO.nombre}" (${MODULO.horasTotales} h)`);
  if (!APPLY) return '__nuevo_modulo__';

  const ref = await db.collection('modulos').add({ ...payload, createdAt: Timestamp.now() });
  log('MÓDULO', `Módulo creado: ${ref.id}`);
  return ref.id;
}

// ── Limpiar colección por módulo+grupo ───────────────────────────────────────
async function limpiar(coleccion, moduloId, grupoId) {
  const snap = await db.collection(coleccion)
    .where('moduloId', '==', moduloId)
    .where('grupoId', '==', grupoId)
    .get();
  if (snap.empty) return;
  log(coleccion.toUpperCase(), `Eliminando ${snap.size} documentos existentes…`);
  if (APPLY) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// ── Crear eventos de programación: SOLO temas (UDs) ──────────────────────────
// La vista de Programación combina eventos_programacion (temas) + tareas + examenes.
// Por eso las actividades van SOLO a 'tareas' y los exámenes SOLO a 'examenes':
// si se creasen también como eventos 'actividad'/'examen' aquí, saldrían DUPLICADOS.
async function crearEventos(moduloId, grupoId) {
  await limpiar('eventos_programacion', moduloId, grupoId);

  const base = { moduloId, grupoId, cursoAcademico: CURSO, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };

  log('EVENTOS', `Creando ${UNIDADES.length} temas (UDs)…`);
  for (const ud of UNIDADES) {
    const payload = {
      ...base,
      evaluacion: ud.evaluacion,
      tipo: 'tema',
      titulo: ud.titulo,
      descripcion: ud.descripcion,
      fechaInicio: ts(ud.fechaInicio),
      fechaFin: ts(ud.fechaFin),
      color: COLOR_TEMA,
      resultadosAprendizajeIds: ud.raIds
    };
    log('  TEMA', `${ud.titulo}  [${ud.evaluacion}]  ${ud.horas}h  (${ud.fechaInicio.toLocaleDateString('es-ES')} → ${ud.fechaFin.toLocaleDateString('es-ES')})`);
    if (APPLY) await db.collection('eventos_programacion').add(payload);
  }
}

// ── Crear documentos en colección 'tareas' ───────────────────────────────────
async function crearTareas(moduloId, grupoId, profesorId) {
  await limpiar('tareas', moduloId, grupoId);
  log('TAREAS', `Creando ${ACTIVIDADES.length} tareas…`);
  for (const act of ACTIVIDADES) {
    const payload = {
      titulo: act.titulo,
      descripcion: act.descripcion,
      moduloId,
      grupoId,
      profesorId,                          // ← CLAVE: el listado filtra por profesorId
      cursoAcademico: CURSO,
      evaluacion: act.evaluacion,
      // Vinculación curricular
      resultadosAprendizajeIds: act.raIds,
      criteriosEvaluacionIds: act.ceIds,
      unidadId: act.udId,
      // Fechas
      fechaPublicacion: ts(act.fecha),
      fechaEntrega: ts(act.fechaEntrega),
      // Configuración
      puntuacionMaxima: act.puntuacionMaxima,
      porcentajeNotaFinal: act.porcentaje,
      penalizacionRetraso: 0,
      permiteEntregaTardia: true,
      esGrupal: false,
      requiereArchivo: true,
      // Estado
      publicada: true,
      archivada: false,
      // Entregas y materiales
      entregas: [],
      adjuntos: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    log('  TAREA', `${act.titulo}  (${act.porcentaje}%)`);
    if (APPLY) await db.collection('tareas').add(payload);
  }
}

// ── Crear documentos en colección 'examenes' ─────────────────────────────────
async function crearExamenes(moduloId, grupoId, profesorId) {
  await limpiar('examenes', moduloId, grupoId);
  log('EXAMENES', `Creando ${EXAMENES.length} exámenes…`);
  for (const ex of EXAMENES) {
    const payload = {
      titulo: ex.titulo,
      descripcion: ex.descripcion,
      moduloId,
      grupoId,
      profesorId,                          // ← CLAVE: el listado filtra por profesorId
      cursoAcademico: CURSO,
      tipo: ex.tipo,
      evaluacion: ex.evaluacion,
      // Vinculación curricular
      resultadosAprendizajeIds: ex.raIds,
      criteriosEvaluacionIds: ex.ceIds,
      // Fecha y lugar
      fecha: ts(ex.fecha),
      horaInicio: '09:00',
      horaFin: '10:00',
      aula: '',
      duracionMinutos: 60,
      // Configuración
      puntuacionMaxima: ex.puntuacionMaxima,
      porcentajeNotaFinal: ex.porcentaje,
      notaMinimaAprobado: 5,
      tienePonderacion: true,
      // Estado
      publicado: true,
      resultadosPublicados: false,
      permiteRecuperacion: true,
      // Calificaciones
      calificaciones: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    log('  EXAM', `${ex.titulo}  (${ex.porcentaje}%)`);
    if (APPLY) await db.collection('examenes').add(payload);
  }
}

// ── Resumen ──────────────────────────────────────────────────────────────────
function imprimirResumen() {
  const totalCE = RESULTADOS_APRENDIZAJE.reduce((s, ra) => s + ra.criteriosEvaluacion.length, 0);
  console.log('\n' + '═'.repeat(72));
  console.log('  RESUMEN · Módulo: Digitalización aplicada a los sectores productivos');
  console.log('═'.repeat(72));
  console.log(`  Horas totales:  ${MODULO.horasTotales} h (${MODULO.horasSemanales} h/semana)`);
  console.log(`  Abreviatura:    ${MODULO.abreviatura}   ·   Curso: ${CURSO}`);
  console.log(`  Unidades (UD):  ${UNIDADES.length}   → eventos_programacion (temas)`);
  console.log(`  Actividades:    ${ACTIVIDADES.length}   → colección 'tareas'`);
  console.log(`  Exámenes:       ${EXAMENES.length}   → colección 'examenes'`);
  console.log(`  RAs / CEs:      ${RESULTADOS_APRENDIZAJE.length} / ${totalCE}`);
  console.log('─'.repeat(72));
  console.log('  Distribución por evaluación:');
  console.log('    1ª Evaluación (14 sept–16 nov): UD1, UD2, UD3 · RA1-RA3');
  console.log('    2ª Evaluación (17 nov–19 feb):  UD4, UD5, UD6 · RA4-RA6');
  console.log('─'.repeat(72));
  console.log('  Ponderación calificaciones:');
  console.log(`    Exámenes ${MODULO.criteriosCalificacion.porcentajeExamenes}% · Tareas ${MODULO.criteriosCalificacion.porcentajeTareas}% · Actitud ${MODULO.criteriosCalificacion.porcentajeActitud}% · Asistencia ${MODULO.criteriosCalificacion.porcentajeAsistencia}%`);
  console.log('═'.repeat(72) + '\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(APPLY
    ? '🚀  MODO --apply: se escribirán datos en Firestore'
    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply para ejecutar)');
  console.log(`${'─'.repeat(72)}\n`);

  const profesorId = await resolverProfesor();
  const cicloId    = await resolverCiclo();
  const grupoId    = await resolverGrupo(cicloId, profesorId);
  const moduloId   = await crearModulo(profesorId, cicloId);

  await crearEventos(moduloId, grupoId);
  await crearTareas(moduloId, grupoId, profesorId);
  await crearExamenes(moduloId, grupoId, profesorId);

  if (APPLY && moduloId !== '__nuevo_modulo__') {
    const grupoSnap = await db.collection('grupos').doc(grupoId).get();
    if (grupoSnap.exists) {
      const mods = grupoSnap.data().modulosIds || [];
      if (!mods.includes(moduloId)) {
        await db.collection('grupos').doc(grupoId).update({
          modulosIds: [...mods, moduloId],
          updatedAt: Timestamp.now()
        });
        log('GRUPO', `Módulo ${MODULO.abreviatura} añadido a modulosIds del grupo`);
      }
    }
  }

  imprimirResumen();

  if (APPLY) {
    console.log('✅  Todos los datos han sido escritos en Firestore.');
    console.log(`    Módulo ID:  ${moduloId}`);
    console.log(`    Grupo ID:   ${grupoId}`);
    console.log(`    Ciclo ID:   ${cicloId}\n`);
  } else {
    console.log('ℹ️   Ejecuta con --apply para escribir los datos:\n');
    console.log('    node seed-modulo-digitalizacion.mjs --apply\n');
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
