#!/usr/bin/env node
// =============================================================================
//  seed-modulo-sostenibilidad.mjs
//
//  Crea en Firestore el módulo «Sostenibilidad aplicada al sistema
//  productivo» (30 h · 2 h/semana) con:
//    - 6 Unidades Didácticas (eventos 'tema' en programación)
//    - Resultados de Aprendizaje y Criterios de Evaluación
//    - Actividades (eventos 'actividad' + documentos en colección 'tareas')
//    - Exámenes (eventos 'examen' + documentos en colección 'examenes')
//
//  Distribución según las fechas de evaluación de la app:
//    1ª Evaluación  14 sept – 16 nov   → UD1, UD2
//    2ª Evaluación  17 nov  – 19 feb   → UD3, UD4
//
//  Uso:
//    node seed-modulo-sostenibilidad.mjs              # dry-run (solo muestra)
//    node seed-modulo-sostenibilidad.mjs --apply      # escribe en Firestore
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
  nombre: 'Sostenibilidad aplicada al sistema productivo',
  codigo: '1666',
  abreviatura: 'SOST',
  curso: 1,
  horasTotales: 30,
  horasSemanales: 2,
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
    descripcion: 'Caracteriza el desarrollo sostenible analizando la relación entre la empresa, la actividad económica y el medio ambiente.',
    porcentajePeso: 25,
    evaluacion: '1ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE1a', codigo: 'CE1a', descripcion: 'Se han definido los objetivos y metas del desarrollo sostenible.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE1b', codigo: 'CE1b', descripcion: 'Se ha analizado el impacto de la actividad económica en el medio ambiente.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE1c', codigo: 'CE1c', descripcion: 'Se ha descrito la responsabilidad social de las empresas (RSE).', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE1d', codigo: 'CE1d', descripcion: 'Se han analizado casos reales de empresas con políticas medioambientales.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA2', codigo: 'RA2',
    descripcion: 'Identifica la Agenda 2030 y los Objetivos de Desarrollo Sostenible valorando su aplicación en el ámbito productivo.',
    porcentajePeso: 25,
    evaluacion: '1ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE2a', codigo: 'CE2a', descripcion: 'Se han descrito los antecedentes y el proceso de aprobación de la Agenda 2030.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE2b', codigo: 'CE2b', descripcion: 'Se han identificado los 17 Objetivos de Desarrollo Sostenible (ODS).', porcentajePeso: 30, instrumentoEvaluacion: 'tarea' },
      { id: 'CE2c', codigo: 'CE2c', descripcion: 'Se ha utilizado la guía SDG Compass para aplicar los ODS a la empresa.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE2d', codigo: 'CE2d', descripcion: 'Se ha valorado la contribución empresarial al cumplimiento de los ODS.', porcentajePeso: 20, instrumentoEvaluacion: 'examen' }
    ]
  },
  {
    id: 'RA3', codigo: 'RA3',
    descripcion: 'Describe la economía circular analizando sus principios, su legislación y sus diagramas de sistema.',
    porcentajePeso: 25,
    evaluacion: '2ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE3a', codigo: 'CE3a', descripcion: 'Se ha definido el concepto de economía circular frente a la economía lineal.', porcentajePeso: 30, instrumentoEvaluacion: 'examen' },
      { id: 'CE3b', codigo: 'CE3b', descripcion: 'Se ha descrito la legislación y las estrategias de apoyo a la economía circular.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE3c', codigo: 'CE3c', descripcion: 'Se han interpretado los diagramas del sistema de la economía circular.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE3d', codigo: 'CE3d', descripcion: 'Se han identificado ejemplos de economía circular en sectores productivos.', porcentajePeso: 20, instrumentoEvaluacion: 'tarea' }
    ]
  },
  {
    id: 'RA4', codigo: 'RA4',
    descripcion: 'Elabora planes directores de eficiencia energética identificando su metodología y modelos de gestión.',
    porcentajePeso: 25,
    evaluacion: '2ª Evaluación',
    criteriosEvaluacion: [
      { id: 'CE4a', codigo: 'CE4a', descripcion: 'Se ha descrito la metodología de elaboración de un plan director.', porcentajePeso: 30, instrumentoEvaluacion: 'examen' },
      { id: 'CE4b', codigo: 'CE4b', descripcion: 'Se han diferenciado los modelos de gestión energética.', porcentajePeso: 25, instrumentoEvaluacion: 'tarea' },
      { id: 'CE4c', codigo: 'CE4c', descripcion: 'Se ha analizado la eficiencia energética dentro de un plan director.', porcentajePeso: 25, instrumentoEvaluacion: 'examen' },
      { id: 'CE4d', codigo: 'CE4d', descripcion: 'Se ha proyectado un caso práctico de plan director de eficiencia energética.', porcentajePeso: 20, instrumentoEvaluacion: 'tarea' }
    ]
  }
];

// ── Unidades Didácticas (eventos tipo 'tema') ────────────────────────────────
// Fechas ajustadas a las evaluaciones reales de la app (2 h/semana).
//   1ª Evaluación: 14 sept – 16 nov
//   2ª Evaluación: 17 nov – 19 feb
const COLOR_TEMA = '#1565c0';

const UNIDADES = [
  {
    id: 'UD1',
    titulo: 'UD1 · Desarrollo sostenible: empresa y medio ambiente',
    descripcion: 'Objetivos y metas del desarrollo sostenible. La actividad económica y su impacto en el medio ambiente. La responsabilidad social de las empresas (RSE).',
    evaluacion: '1ª Evaluación',
    fechaInicio: new Date('2025-09-15'),
    fechaFin:    new Date('2025-10-10'),
    horas: 8,
    raIds: ['RA1']
  },
  {
    id: 'UD2',
    titulo: 'UD2 · Agenda 2030 y Objetivos de Desarrollo Sostenible',
    descripcion: 'La Agenda 2030: antecedentes, proceso de aprobación y contenido. Los 17 Objetivos de Desarrollo Sostenible (ODS). Guía SDG Compass.',
    evaluacion: '1ª Evaluación',
    fechaInicio: new Date('2025-10-13'),
    fechaFin:    new Date('2025-11-14'),
    horas: 7,
    raIds: ['RA2']
  },
  {
    id: 'UD3',
    titulo: 'UD3 · Economía circular',
    descripcion: 'La economía circular frente a la lineal. Legislación y estrategias de apoyo. Diagramas del sistema de la economía circular.',
    evaluacion: '2ª Evaluación',
    fechaInicio: new Date('2025-11-17'),
    fechaFin:    new Date('2025-12-19'),
    horas: 8,
    raIds: ['RA3']
  },
  {
    id: 'UD4',
    titulo: 'UD4 · Planes directores de eficiencia energética',
    descripcion: 'Metodología de elaboración de un plan director. Modelos de gestión. Eficiencia energética dentro de un plan director.',
    evaluacion: '2ª Evaluación',
    fechaInicio: new Date('2026-01-12'),
    fechaFin:    new Date('2026-02-13'),
    horas: 7,
    raIds: ['RA4']
  }
];

// ── Actividades (eventos 'actividad' + documentos en 'tareas') ───────────────
const ACTIVIDADES = [
  { udId: 'UD1', evaluacion: '1ª Evaluación', titulo: 'Actividad 1 · Impacto ambiental de la actividad económica',
    descripcion: 'Analizar el impacto medioambiental de un sector productivo e identificar medidas de mejora.',
    fecha: new Date('2025-10-06'), fechaEntrega: new Date('2025-10-10'), raIds: ['RA1'], ceIds: ['CE1b','CE1d'], puntuacionMaxima: 10, porcentaje: 10 },

  { udId: 'UD2', evaluacion: '1ª Evaluación', titulo: 'Actividad 2 · Los ODS en la empresa (SDG Compass)',
    descripcion: 'Aplicar la guía SDG Compass para vincular los 17 ODS a la estrategia de una empresa concreta.',
    fecha: new Date('2025-11-10'), fechaEntrega: new Date('2025-11-14'), raIds: ['RA2'], ceIds: ['CE2b','CE2c'], puntuacionMaxima: 10, porcentaje: 10 },

  { udId: 'UD3', evaluacion: '2ª Evaluación', titulo: 'Actividad 3 · Caso de economía circular',
    descripcion: 'Documentar un caso real de economía circular interpretando su diagrama de sistema.',
    fecha: new Date('2025-12-15'), fechaEntrega: new Date('2025-12-19'), raIds: ['RA3'], ceIds: ['CE3b','CE3d'], puntuacionMaxima: 10, porcentaje: 10 },

  { udId: 'UD4', evaluacion: '2ª Evaluación', titulo: 'Actividad 4 · Plan director de eficiencia energética',
    descripcion: 'Elaborar un plan director de eficiencia energética para un centro o empresa, con su modelo de gestión.',
    fecha: new Date('2026-02-09'), fechaEntrega: new Date('2026-02-13'), raIds: ['RA4'], ceIds: ['CE4b','CE4d'], puntuacionMaxima: 10, porcentaje: 10 }
];

// ── Exámenes (eventos 'examen' + documentos en 'examenes') ───────────────────
const EXAMENES = [
  { evaluacion: '1ª Evaluación', titulo: 'Examen 1ª Evaluación · UD1-UD2',
    descripcion: 'Prueba escrita sobre desarrollo sostenible, RSE, Agenda 2030 y los Objetivos de Desarrollo Sostenible.',
    fecha: new Date('2025-11-12'), tipo: 'parcial', raIds: ['RA1','RA2'],
    ceIds: ['CE1a','CE1c','CE2a','CE2d'], puntuacionMaxima: 10, porcentaje: 20 },

  { evaluacion: '2ª Evaluación', titulo: 'Examen 2ª Evaluación · UD3-UD4',
    descripcion: 'Prueba escrita sobre economía circular y planes directores de eficiencia energética.',
    fecha: new Date('2026-02-11'), tipo: 'parcial', raIds: ['RA3','RA4'],
    ceIds: ['CE3a','CE3c','CE4a','CE4c'], puntuacionMaxima: 10, porcentaje: 20 }
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
    log('GRUPO', `Se crearía el grupo "SM2" para ${CURSO}`);
    return '__nuevo_grupo__';
  }
  const ref = await db.collection('grupos').add({
    nombre: 'SM2',
    curso: 1,
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
  console.log('  RESUMEN · Módulo: Sostenibilidad aplicada al sistema productivo');
  console.log('═'.repeat(72));
  console.log(`  Horas totales:  ${MODULO.horasTotales} h (${MODULO.horasSemanales} h/semana)`);
  console.log(`  Abreviatura:    ${MODULO.abreviatura}   ·   Curso: ${CURSO}`);
  console.log(`  Unidades (UD):  ${UNIDADES.length}   → eventos_programacion (temas)`);
  console.log(`  Actividades:    ${ACTIVIDADES.length}   → colección 'tareas'`);
  console.log(`  Exámenes:       ${EXAMENES.length}   → colección 'examenes'`);
  console.log(`  RAs / CEs:      ${RESULTADOS_APRENDIZAJE.length} / ${totalCE}`);
  console.log('─'.repeat(72));
  console.log('  Distribución por evaluación:');
  console.log('    1ª Evaluación (14 sept–16 nov): UD1, UD2 · RA1-RA2');
  console.log('    2ª Evaluación (17 nov–19 feb):  UD3, UD4 · RA3-RA4');
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
    console.log('    node seed-modulo-sostenibilidad.mjs --apply\n');
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
