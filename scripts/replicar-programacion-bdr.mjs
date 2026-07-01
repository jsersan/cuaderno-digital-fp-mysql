#!/usr/bin/env node
/**
 * replicar-programacion-bdr.mjs
 * --------------------------------------------------------------------------
 * Replica la PROGRAMACIÓN DIDÁCTICA del módulo BDR (Diseño de Bases de Datos
 * Relacionales — Grado Medio, 2º curso) en Firestore, creando:
 *   - Eventos de programación (colección "eventos_programacion"): 1 TEMA por
 *     cada unidad didáctica + ACTIVIDADES (tareas) + EXÁMENES, con fechas
 *     repartidas entre septiembre 2026 y marzo 2027 (antes de FCT).
 *   - Tareas (colección "tareas") vinculadas a las actividades.
 *   - Exámenes (colección "examenes") vinculados a los exámenes.
 *
 * Recorrido didáctico: sistemas de información y SGBD → modelo conceptual
 * (Entidad-Relación) → modelo relacional → transformación E-R → relacional →
 * normalización → SQL (DDL/DML/consultas) → proyecto integrador.
 *
 * USO:
 *   node replicar-programacion-bdr.mjs                # simulación (dry-run)
 *   node replicar-programacion-bdr.mjs --commit       # escribe en Firestore
 *   node replicar-programacion-bdr.mjs --commit --limpiar   # borra lo previo y reescribe
 *
 * REQUISITOS:
 *   - npm install firebase-admin
 *   - scripts/serviceAccount.json (clave de cuenta de servicio de Firebase)
 * --------------------------------------------------------------------------
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ----- Flags -----
const COMMIT = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');

// ----- Configuración del curso -----
// ⚠️ Ajusta COD_MODULO y NOMBRE_GRUPO a los valores reales de tu Firestore.
const CURSO = '2026-2027';
const COD_MODULO = 'DBDR';       // código/abreviatura del módulo a buscar
const NOMBRE_GRUPO = 'SM2';      // nombre del grupo (grado medio, 2º curso)

// Evaluaciones (deben coincidir con el enum TipoEvaluacion del front)
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';

// Colores por tipo de evento (igual que en el front)
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };

// --------------------------------------------------------------------------
//  DEFINICIÓN DE LA PROGRAMACIÓN
// --------------------------------------------------------------------------
// Cada UD: número, título, RA asociado, horas, evaluación.
// Las fechas se calculan automáticamente de forma proporcional a las horas.
//
// Resultados de Aprendizaje (RA) tomados del currículo oficial de los módulos
// de bases de datos de FP:
//   RA1: Reconoce los elementos de las bases de datos analizando sus funciones
//        y valorando la utilidad de los sistemas gestores de bases de datos.
//   RA2: Diseña modelos lógicos normalizados interpretando diagramas
//        entidad/relación.
//   RA3: Realiza el diseño físico de bases de datos utilizando asistentes,
//        herramientas gráficas y/o el lenguaje de definición de datos (DDL).
//   RA4: Consulta la información almacenada manejando asistentes, herramientas
//        gráficas y el lenguaje de manipulación de datos (DML).
//   RA5: Modifica la información almacenada utilizando asistentes, herramientas
//        gráficas y el lenguaje de manipulación de datos (DML).
const RA1 = 'RA1: Reconoce los elementos de las bases de datos analizando sus funciones y valorando la utilidad de los sistemas gestores de bases de datos';
const RA2 = 'RA2: Diseña modelos lógicos normalizados interpretando diagramas entidad/relación';
const RA3 = 'RA3: Realiza el diseño físico de bases de datos utilizando asistentes, herramientas gráficas y/o el lenguaje de definición de datos (DDL)';
const RA4 = 'RA4: Consulta la información almacenada manejando asistentes, herramientas gráficas y el lenguaje de manipulación de datos (DML)';
const RA5 = 'RA5: Modifica la información almacenada utilizando asistentes, herramientas gráficas y el lenguaje de manipulación de datos (DML)';

const UNIDADES = [
  { n: 0,  titulo: 'UD0: Presentación del módulo', ra: '', horas: 2, eval: EVAL_1 },
  { n: 1,  titulo: 'UD1: Sistemas de información y bases de datos', ra: RA1, horas: 8,  eval: EVAL_1 },
  { n: 2,  titulo: 'UD2: El modelo conceptual: Entidad-Relación', ra: RA2, horas: 16, eval: EVAL_1 },
  { n: 3,  titulo: 'UD3: Modelo Entidad-Relación extendido', ra: RA2, horas: 12, eval: EVAL_1 },
  { n: 4,  titulo: 'UD4: El modelo relacional', ra: RA2, horas: 12, eval: EVAL_1 },
  { n: 5,  titulo: 'UD5: Transformación del modelo E-R al relacional', ra: RA2, horas: 16, eval: EVAL_1 },
  { n: 6,  titulo: 'UD6: Normalización de bases de datos', ra: RA2, horas: 18, eval: EVAL_2 },
  { n: 7,  titulo: 'UD7: SQL: Lenguaje de definición de datos (DDL)', ra: RA3, horas: 16, eval: EVAL_2 },
  { n: 8,  titulo: 'UD8: SQL: Lenguaje de manipulación de datos (DML)', ra: RA5, horas: 14, eval: EVAL_2 },
  { n: 9,  titulo: 'UD9: Consultas SQL (SELECT)', ra: RA4, horas: 20, eval: EVAL_2 },
  { n: 10, titulo: 'UD10: Herramientas de diseño y proyecto integrador', ra: RA3, horas: 16, eval: EVAL_2 },
];

// --------------------------------------------------------------------------
//  REPARTO TEMPORAL: del 7-sep-2026 al 12-mar-2027 (examen final ese día)
//  El módulo de 2º de grado medio finaliza antes del periodo de FCT.
//  Las UD se reparten proporcionalmente según sus horas acumuladas.
// --------------------------------------------------------------------------
const FECHA_INICIO = new Date(2026, 8, 7);   // 7 septiembre 2026 (lunes)
const FECHA_FIN = new Date(2027, 2, 12);     // 12 marzo 2027 (viernes, examen final)
const MS_DIA = 24 * 3600 * 1000;
const DIAS_TOTALES = Math.round((FECHA_FIN - FECHA_INICIO) / MS_DIA);

// Horas totales del módulo (suma de las UD)
const HORAS_TOTAL = UNIDADES.reduce((s, u) => s + u.horas, 0); // 150

// Calcula, para una posición en horas acumuladas, la fecha proporcional.
// Reserva el último día (13-mar) para el examen final, así que el contenido
// se reparte sobre (DIAS_TOTALES - 1) días.
function fechaPorHoras(horasAcumuladas) {
  const frac = horasAcumuladas / HORAS_TOTAL;
  const dias = Math.round(frac * (DIAS_TOTALES - 1));
  const f = new Date(FECHA_INICIO.getTime() + dias * MS_DIA);
  f.setHours(9, 0, 0, 0);
  return f;
}

// --------------------------------------------------------------------------
//  TAREAS Y EXÁMENES detallados (vinculados a UDs concretas)
// --------------------------------------------------------------------------
// Tareas: entregas prácticas por bloque temático (udRef = nº de UD asociada)
const TAREAS = [
  { titulo: 'Práctica 1: Análisis de un sistema de información', descripcion: 'Identificación de entidades, atributos y relaciones a partir del enunciado de un caso real. Justificación de la conveniencia de usar una base de datos.', udRef: 1, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 2: Diagrama Entidad-Relación de un caso real', descripcion: 'Elaboración de un diagrama E-R completo: entidades, atributos, claves, relaciones y cardinalidades.', udRef: 2, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 3: Modelo E-R extendido', descripcion: 'Modelado de jerarquías de generalización/especialización, entidades débiles y relaciones n-arias.', udRef: 3, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 4: Paso del modelo E-R a tablas', descripcion: 'Transformación del diagrama E-R al modelo relacional: tablas, claves primarias y ajenas, integridad referencial.', udRef: 5, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 5: Normalización de tablas', descripcion: 'Detección de dependencias funcionales y normalización hasta la 3FN (1FN, 2FN, 3FN) de un conjunto de tablas dado.', udRef: 6, eval: EVAL_2, peso: 10 },
  { titulo: 'Práctica 6: Creación de la base de datos con DDL', descripcion: 'Implementación física con SQL: CREATE TABLE, tipos de datos, restricciones (PRIMARY KEY, FOREIGN KEY, NOT NULL, UNIQUE, CHECK).', udRef: 7, eval: EVAL_2, peso: 10 },
  { titulo: 'Práctica 7: Manipulación de datos con DML', descripcion: 'Inserción, actualización y borrado de datos (INSERT, UPDATE, DELETE) respetando la integridad referencial.', udRef: 8, eval: EVAL_2, peso: 10 },
  { titulo: 'Práctica 8: Consultas SQL', descripcion: 'Consultas SELECT con filtros, ordenación, funciones de agregación, agrupaciones (GROUP BY/HAVING) y combinaciones (JOIN).', udRef: 9, eval: EVAL_2, peso: 10 },
  { titulo: 'Proyecto final: Diseño e implementación de una base de datos', descripcion: 'Proyecto integrador: análisis del problema, diseño conceptual (E-R), diseño lógico (relacional normalizado), implementación con SQL y batería de consultas. Incluye documentación y defensa.', udRef: 10, eval: EVAL_2, peso: 25 },
];

// Exámenes: pruebas por evaluación (udRef = nº de UD tras la cual se realiza)
const EXAMENES = [
  { titulo: 'Examen 1ª Evaluación: Modelo Entidad-Relación', descripcion: 'Sistemas de información y SGBD, modelo conceptual E-R (básico y extendido): entidades, atributos, relaciones, cardinalidades, jerarquías y entidades débiles.', udRef: 3, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen 1ª Evaluación: Modelo relacional y transformación', descripcion: 'Modelo relacional (relaciones, tuplas, dominios, claves) y transformación del modelo E-R al relacional con integridad referencial.', udRef: 5, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen final: Normalización y SQL', descripcion: 'Normalización (1FN, 2FN, 3FN) y lenguaje SQL completo: definición (DDL), manipulación (DML) y consultas (SELECT). Examen final del módulo.', udRef: 10, eval: EVAL_2, tipo: 'final', esFinal: true },
];

// --------------------------------------------------------------------------
//  Firebase init
// --------------------------------------------------------------------------
let db;
function initFirebase() {
  const saPath = join(__dirname, 'serviceAccount.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
  } catch (e) {
    console.error(`\n❌ No se encontró ${saPath}`);
    console.error('   Descarga la clave de cuenta de servicio desde:');
    console.error('   Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada');
    console.error('   y guárdala como scripts/serviceAccount.json\n');
    process.exit(1);
  }
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
}

// --------------------------------------------------------------------------
//  Autodetección de módulo y grupo
// --------------------------------------------------------------------------
async function detectarModuloYGrupo() {
  // Módulo por abreviatura o código
  const modsSnap = await db.collection('modulos').get();
  let modulo = null;
  modsSnap.forEach(d => {
    const m = d.data();
    if (!modulo && (m.abreviatura === COD_MODULO || m.codigo === COD_MODULO ||
        (m.nombre || '').toLowerCase().includes('bases de datos'))) {
      modulo = { id: d.id, ...m };
    }
  });

  // Grupo por nombre
  const gruposSnap = await db.collection('grupos').get();
  let grupo = null;
  gruposSnap.forEach(d => {
    const g = d.data();
    if (!grupo && g.nombre === NOMBRE_GRUPO) grupo = { id: d.id, ...g };
  });

  if (!modulo) { console.error(`❌ No se encontró el módulo ${COD_MODULO} en la colección "modulos".`); process.exit(1); }
  if (!grupo)  { console.error(`❌ No se encontró el grupo ${NOMBRE_GRUPO} en la colección "grupos".`); process.exit(1); }

  console.log(`✓ Módulo detectado: ${modulo.abreviatura || modulo.nombre} (id: ${modulo.id})`);
  console.log(`✓ Grupo detectado:  ${grupo.nombre} (id: ${grupo.id})`);
  return { modulo, grupo };
}

// Detecta el profesorId: usa el del módulo si lo tiene, si no el primer profesor
async function detectarProfesor(modulo) {
  if (modulo.profesorId) return modulo.profesorId;
  const profsSnap = await db.collection('usuarios').where('rol', '==', 'profesor').limit(1).get();
  if (!profsSnap.empty) return profsSnap.docs[0].id;
  // fallback: cualquier usuario
  const anySnap = await db.collection('usuarios').limit(1).get();
  return anySnap.empty ? 'desconocido' : anySnap.docs[0].id;
}

// --------------------------------------------------------------------------
//  Limpieza previa (opcional)
// --------------------------------------------------------------------------
async function limpiar(moduloId, grupoId) {
  const colecciones = ['eventos_programacion', 'tareas', 'examenes'];
  for (const col of colecciones) {
    const snap = await db.collection(col)
      .where('moduloId', '==', moduloId)
      .where('grupoId', '==', grupoId).get();
    if (snap.empty) { console.log(`  · ${col}: nada que borrar`); continue; }
    if (!COMMIT) { console.log(`  · ${col}: se borrarían ${snap.size} documentos`); continue; }
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`  · ${col}: borrados ${snap.size} documentos`);
  }
}

// --------------------------------------------------------------------------
//  Construcción de documentos
// --------------------------------------------------------------------------
function nowTs() { return Timestamp.now(); }

async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  REPLICAR PROGRAMACIÓN BDR · curso ${CURSO}`);
  console.log(`  (Diseño de Bases de Datos Relacionales · Grado Medio 2º)`);
  console.log(`  Modo: ${COMMIT ? 'COMMIT (escribe en Firestore)' : 'DRY-RUN (simulación)'}${LIMPIAR ? ' + LIMPIAR' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  initFirebase();
  const { modulo, grupo } = await detectarModuloYGrupo();
  const profesorId = await detectarProfesor(modulo);
  console.log(`✓ Profesor: ${profesorId}\n`);

  if (LIMPIAR) {
    console.log('🧹 Limpiando datos previos...');
    await limpiar(modulo.id, grupo.id);
    console.log('');
  }

  const base = { moduloId: modulo.id, grupoId: grupo.id, profesorId };

  // Precalcular horas acumuladas (inicio y fin) de cada UD y sus fechas
  const tramoUD = {}; // udNum -> { inicio: Date, fin: Date }
  let acum = 0;
  for (const ud of UNIDADES) {
    const fInicio = fechaPorHoras(acum);
    acum += ud.horas;
    const fFin = fechaPorHoras(acum);
    tramoUD[ud.n] = { inicio: fInicio, fin: fFin, horasInicio: acum - ud.horas };
  }

  // ---- 1. EVENTOS: un TEMA por unidad didáctica ----
  const eventos = [];
  for (const ud of UNIDADES) {
    const inicio = tramoUD[ud.n].inicio;
    eventos.push({
      ...base,
      cursoAcademico: CURSO,
      evaluacion: ud.eval,
      tipo: 'tema',
      titulo: ud.titulo,
      descripcion: ud.ra ? `${ud.ra} · ${ud.horas}h` : `${ud.horas}h`,
      fechaInicio: Timestamp.fromDate(inicio),
      fechaFin: Timestamp.fromDate(tramoUD[ud.n].fin),
      color: COLOR.tema,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });
  }

  // ---- 2. TAREAS + sus eventos tipo actividad ----
  const tareasDocs = [];
  const eventosTareas = [];
  for (const t of TAREAS) {
    const tramo = tramoUD[t.udRef] || tramoUD[0];
    const fEntrega = new Date(tramo.fin); // entrega al terminar la UD
    fEntrega.setHours(9, 0, 0, 0);
    const fPub = new Date(tramo.inicio);  // se publica al empezar la UD

    const tareaDoc = {
      ...base,
      titulo: t.titulo,
      descripcion: t.descripcion,
      resultadosAprendizajeIds: [],
      criteriosEvaluacionIds: [],
      fechaPublicacion: Timestamp.fromDate(fPub),
      fechaEntrega: Timestamp.fromDate(fEntrega),
      puntuacionMaxima: 10,
      porcentajeNotaFinal: t.peso,
      penalizacionRetraso: 20,
      permiteEntregaTardia: true,
      esGrupal: false,
      requiereArchivo: true,
      evaluacion: t.eval,
      publicada: true,
      archivada: false,
      entregas: [],
      adjuntos: [],
      createdAt: nowTs(),
      updatedAt: nowTs(),
    };
    tareasDocs.push(tareaDoc);

    eventosTareas.push({
      ...base,
      cursoAcademico: CURSO,
      evaluacion: t.eval,
      tipo: 'actividad',
      titulo: t.titulo,
      descripcion: `Entrega · ${t.peso}% · ${t.descripcion}`,
      fechaInicio: Timestamp.fromDate(fEntrega),
      color: COLOR.actividad,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });
  }

  // ---- 3. EXÁMENES + sus eventos tipo examen ----
  const examenesDocs = [];
  const eventosExamenes = [];
  for (const ex of EXAMENES) {
    // El examen final va fijo el 12-mar; los parciales, al terminar su UD
    let fEx;
    if (ex.esFinal) {
      fEx = new Date(FECHA_FIN);
    } else {
      const tramo = tramoUD[ex.udRef] || tramoUD[0];
      fEx = new Date(tramo.fin);
    }
    fEx.setHours(9, 0, 0, 0);

    const examenDoc = {
      ...base,
      titulo: ex.titulo,
      descripcion: ex.descripcion,
      tipo: ex.tipo,
      evaluacion: ex.eval,
      resultadosAprendizajeIds: [],
      criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(fEx),
      horaInicio: '09:00',
      horaFin: '11:00',
      aula: 'Aula de Informática',
      duracionMinutos: 120,
      puntuacionMaxima: 10,
      porcentajeNotaFinal: ex.tipo === 'final' ? 40 : 30,
      notaMinimaAprobado: 5,
      tienePonderacion: false,
      publicado: true,
      resultadosPublicados: false,
      permiteRecuperacion: true,
      calificaciones: [],
      createdAt: nowTs(),
      updatedAt: nowTs(),
    };
    examenesDocs.push(examenDoc);

    eventosExamenes.push({
      ...base,
      cursoAcademico: CURSO,
      evaluacion: ex.eval,
      tipo: 'examen',
      titulo: ex.titulo,
      descripcion: `${ex.tipo} · 10 pts · ${ex.descripcion}`,
      fechaInicio: Timestamp.fromDate(fEx),
      color: COLOR.examen,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });
  }

  // ---- Resumen ----
  const todosEventos = [...eventos, ...eventosTareas, ...eventosExamenes];
  console.log('📋 RESUMEN A CREAR:');
  console.log(`   · Eventos programación: ${todosEventos.length} (${eventos.length} temas, ${eventosTareas.length} actividades, ${eventosExamenes.length} exámenes)`);
  console.log(`   · Tareas: ${tareasDocs.length}`);
  console.log(`   · Exámenes: ${examenesDocs.length}`);
  console.log(`   · Horas totales del módulo: ${HORAS_TOTAL}h\n`);

  if (!COMMIT) {
    console.log('🔍 DRY-RUN: no se ha escrito nada. Vista previa de eventos:\n');
    for (const e of todosEventos) {
      const f = e.fechaInicio.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      console.log(`   [${e.tipo.padEnd(10)}] ${f}  ${e.titulo}`);
    }
    console.log('\n👉 Ejecuta con --commit para escribir en Firestore.\n');
    return;
  }

  // ---- Escritura por lotes ----
  console.log('✍️  Escribiendo en Firestore...');

  async function escribir(col, docs) {
    let batch = db.batch();
    let count = 0;
    for (const doc of docs) {
      const ref = db.collection(col).doc();
      batch.set(ref, doc);
      count++;
      if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    console.log(`   · ${col}: ${docs.length} creados`);
  }

  await escribir('eventos_programacion', todosEventos);
  await escribir('tareas', tareasDocs);
  await escribir('examenes', examenesDocs);

  console.log('\n✅ Programación replicada correctamente.\n');
}

run().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
