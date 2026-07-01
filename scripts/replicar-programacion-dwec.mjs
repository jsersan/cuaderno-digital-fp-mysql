#!/usr/bin/env node
/**
 * replicar-programacion-dwec.mjs
 * --------------------------------------------------------------------------
 * Replica la PROGRAMACIÓN DIDÁCTICA del módulo DWEC (Desarrollo Web en
 * Entorno Cliente) en Firestore, creando:
 *   - Eventos de programación (colección "eventos_programacion"): 1 TEMA por
 *     cada unidad didáctica + ACTIVIDADES (tareas) + EXÁMENES, con fechas
 *     repartidas entre septiembre 2025 y febrero 2026.
 *   - Tareas (colección "tareas") vinculadas a las actividades.
 *   - Exámenes (colección "examenes") vinculados a los exámenes.
 *
 * Basado en el documento "prDW2_DEWC_2223" (curso 2022/23) adaptado a 2025-26.
 *
 * USO:
 *   node replicar-programacion-dwec.mjs                # simulación (dry-run)
 *   node replicar-programacion-dwec.mjs --commit       # escribe en Firestore
 *   node replicar-programacion-dwec.mjs --commit --limpiar   # borra lo previo y reescribe
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
const CURSO = '2025-2026';
const COD_MODULO = 'DWEC';       // código/abreviatura del módulo a buscar
const NOMBRE_GRUPO = 'DAW2';     // nombre del grupo a buscar

// Evaluaciones (deben coincidir con el enum TipoEvaluacion del front)
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';

// Colores por tipo de evento (igual que en el front)
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };

// --------------------------------------------------------------------------
//  DEFINICIÓN DE LA PROGRAMACIÓN (extraída del documento Word)
// --------------------------------------------------------------------------
// Cada UD: número, título, RA asociado, horas, mes (0=sep..5=feb), evaluación.
// Las fechas se calculan automáticamente dentro de cada mes.
const UNIDADES = [
  { n: 0,  titulo: 'UD0: Presentación del módulo', ra: '', horas: 1,  mes: 0, eval: EVAL_1 },
  { n: 1,  titulo: 'UD1: Selección de arquitecturas y herramientas de programación', ra: 'RA1: Selecciona las arquitecturas y tecnologías de programación sobre clientes web', horas: 3,  mes: 0, eval: EVAL_1 },
  { n: 2,  titulo: 'UD2: Utilización de los objetos predefinidos del lenguaje', ra: 'RA3: Escribe código, identificando y aplicando las funcionalidades aportadas por los objetos predefinidos del lenguaje', horas: 6,  mes: 0, eval: EVAL_1 },
  { n: 3,  titulo: 'UD3: Programación con arrays, funciones y objetos definidos por el usuario', ra: 'RA3: Escribe código, identificando y aplicando las funcionalidades aportadas por los objetos predefinidos del lenguaje', horas: 6,  mes: 0, eval: EVAL_1 },
  { n: 4,  titulo: 'UD4: Utilización del modelo de objetos del documento (DOM)', ra: 'RA4: Programa código para clientes web analizando y usando estructuras definidas por el usuario', horas: 10, mes: 1, eval: EVAL_1 },
  { n: 5,  titulo: 'UD5: Interacción con el usuario: eventos y formularios', ra: 'RA4: Programa código para clientes web analizando y usando estructuras definidas por el usuario', horas: 12, mes: 1, eval: EVAL_1 },
  { n: 6,  titulo: 'UD6: Almacenamiento en JavaScript: Local Storage y Session Storage', ra: 'RA5: Desarrolla aplicaciones web analizando y aplicando las características del almacenamiento interno', horas: 15, mes: 1, eval: EVAL_1 },
  { n: 7,  titulo: 'UD7: TypeScript', ra: 'RA1: Selecciona las arquitecturas y tecnologías de programación sobre clientes web', horas: 9,  mes: 2, eval: EVAL_1 },
  { n: 8,  titulo: 'UD8: Librerías de actualización dinámica (jQuery)', ra: 'RA7: Desarrolla aplicaciones web dinámicas, reconociendo y aplicando mecanismos de comunicación asíncrona', horas: 8,  mes: 2, eval: EVAL_1 },
  { n: 9,  titulo: 'UD9: AJAX y almacenamiento de datos JSON', ra: 'RA7: Desarrolla aplicaciones web dinámicas, reconociendo y aplicando mecanismos de comunicación asíncrona', horas: 22, mes: 2, eval: EVAL_1 },
  { n: 10, titulo: 'UD10: Frameworks de JavaScript: Angular, Vue y React', ra: 'RA7: Desarrolla aplicaciones web dinámicas, reconociendo y aplicando mecanismos de comunicación asíncrona', horas: 46, mes: 3, eval: EVAL_2 },
];

// --------------------------------------------------------------------------
//  REPARTO TEMPORAL: del 7-sep-2025 al 15-feb-2026 (examen final ese día)
//  Las UD se reparten proporcionalmente según sus horas acumuladas.
// --------------------------------------------------------------------------
const FECHA_INICIO = new Date(2025, 8, 7);   // 7 septiembre 2025
const FECHA_FIN = new Date(2026, 1, 15);     // 15 febrero 2026 (examen final)
const MS_DIA = 24 * 3600 * 1000;
const DIAS_TOTALES = Math.round((FECHA_FIN - FECHA_INICIO) / MS_DIA); // ~161 días

// Horas totales del módulo (suma de las UD)
const HORAS_TOTAL = UNIDADES.reduce((s, u) => s + u.horas, 0); // 138

// Calcula, para una posición en horas acumuladas, la fecha proporcional.
// Reserva el último día (15-feb) para el examen final, así que el contenido
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
  { titulo: 'Práctica 1: Arquitecturas y primer script', descripcion: 'Integración de JavaScript en HTML y evaluación de herramientas de desarrollo.', udRef: 1, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 2: Objetos predefinidos y arrays', descripcion: 'Ejercicios con String, Array, Math, Date y funciones definidas por el usuario.', udRef: 3, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 3: Manipulación del DOM', descripcion: 'Selección y modificación dinámica de elementos del documento mediante el DOM.', udRef: 4, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 4: Eventos y validación de formularios', descripcion: 'Gestión de eventos y validación de formularios en cliente.', udRef: 5, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 5: Almacenamiento Local y Session Storage', descripcion: 'Persistencia de datos en el navegador con Web Storage.', udRef: 6, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 6: TypeScript', descripcion: 'Tipado estático, interfaces y clases con TypeScript.', udRef: 7, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 7: jQuery y AJAX', descripcion: 'Actualización dinámica con jQuery y consumo de datos JSON con AJAX.', udRef: 9, eval: EVAL_1, peso: 10 },
  { titulo: 'Proyecto final: Aplicación con Angular', descripcion: 'Desarrollo de una SPA con Angular consumiendo una API REST.', udRef: 10, eval: EVAL_2, peso: 25 },
];

// Exámenes: pruebas por evaluación (udRef = nº de UD tras la cual se realiza)
const EXAMENES = [
  { titulo: 'Examen 1ª Evaluación: Fundamentos de JavaScript y DOM', descripcion: 'Sintaxis, objetos predefinidos, DOM, eventos y formularios.', udRef: 5, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen 1ª Evaluación: Storage, TypeScript y AJAX', descripcion: 'Web Storage, TypeScript, jQuery y comunicación asíncrona.', udRef: 9, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen final: Frameworks (Angular) y módulo completo', descripcion: 'Desarrollo con frameworks de JavaScript. Angular. Examen final del módulo.', udRef: 10, eval: EVAL_2, tipo: 'final', esFinal: true },
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
        (m.nombre || '').toLowerCase().includes('entorno cliente'))) {
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
  console.log(`  REPLICAR PROGRAMACIÓN DWEC · curso ${CURSO}`);
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
    // El examen final va fijo el 15-feb; los parciales, al terminar su UD
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
      aula: 'Aula DAW',
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
  console.log(`   · Exámenes: ${examenesDocs.length}\n`);

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
