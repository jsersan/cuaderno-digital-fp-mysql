#!/usr/bin/env node
/**
 * replicar-programacion-dewc.mjs
 * ========================================================================
 * Reconstruye la PROGRAMACIÓN del módulo DEWC (Desarrollo Web en Entorno
 * Cliente) para el grupo DAW2, curso 2025-2026:
 *   - eventos_programacion : 1 TEMA por UD + ACTIVIDADES (tareas) + EXÁMENES
 *   - tareas               : 8 prácticas reales recuperadas de las capturas
 *                            + algunas de 2ª evaluación para dar cuerpo
 *   - examenes             : pruebas por evaluación
 *
 * Las 8 prácticas y sus fechas/pesos son DATOS REALES (capturas). El resto
 * (UDs, RA, exámenes) es una reconstrucción coherente con el currículo del
 * módulo; ajusta las definiciones de abajo a tu gusto antes de --commit.
 *
 * USO:
 *   node scripts/replicar-programacion-dewc.mjs              # DRY-RUN
 *   node scripts/replicar-programacion-dewc.mjs --commit      # escribe
 *   node scripts/replicar-programacion-dewc.mjs --commit --limpiar  # borra DEWC/DAW2 antes
 * ========================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');

const CURSO = '2025-2026';
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };
const MS_DIA = 24 * 3600 * 1000;
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();
const fecha = (y, m, d) => { const f = new Date(y, m - 1, d, 9, 0, 0); return f; };

// ── UNIDADES DIDÁCTICAS de DEWC ──
const UNIDADES = [
  { n: 0,  titulo: 'UD0: Presentación del módulo', ra: '', horas: 1, eval: EVAL_1 },
  { n: 1,  titulo: 'UD1: Selección de arquitecturas y herramientas de programación', ra: 'RA1: Selecciona las arquitecturas y tecnologías de programación sobre clientes web, identificando y analizando las capacidades y características de cada una', horas: 8, eval: EVAL_1 },
  { n: 2,  titulo: 'UD2: Sintaxis del lenguaje: variables, operadores y estructuras de control', ra: 'RA2: Escribe sentencias simples, aplicándolas y reconociendo las características de la sintaxis del lenguaje', horas: 14, eval: EVAL_1 },
  { n: 3,  titulo: 'UD3: Objetos predefinidos del lenguaje y arrays', ra: 'RA3: Escribe código, identificando y aplicando las funcionalidades aportadas por los objetos predefinidos del lenguaje', horas: 16, eval: EVAL_1 },
  { n: 4,  titulo: 'UD4: Manipulación del DOM', ra: 'RA5: Desarrolla aplicaciones web analizando y aplicando las características del modelo de objetos del documento (DOM)', horas: 18, eval: EVAL_1 },
  { n: 5,  titulo: 'UD5: Eventos y validación de formularios', ra: 'RA5: Desarrolla aplicaciones web analizando y aplicando las características del modelo de objetos del documento (DOM)', horas: 14, eval: EVAL_1 },
  { n: 6,  titulo: 'UD6: Almacenamiento en el cliente (Web Storage)', ra: 'RA5: Desarrolla aplicaciones web aplicando mecanismos de almacenamiento en el cliente', horas: 8, eval: EVAL_1 },
  { n: 7,  titulo: 'UD7: TypeScript: tipado estático, interfaces y clases', ra: 'RA4: Programa código para clientes web analizando y utilizando estructuras definidas por el usuario', horas: 18, eval: EVAL_2 },
  { n: 8,  titulo: 'UD8: Bibliotecas de cliente: jQuery', ra: 'RA5: Desarrolla aplicaciones web utilizando bibliotecas de funciones de cliente', horas: 14, eval: EVAL_2 },
  { n: 9,  titulo: 'UD9: Comunicación asíncrona: AJAX y Fetch', ra: 'RA6: Desarrolla aplicaciones web dinámicas, reconociendo y aplicando mecanismos de comunicación asíncrona entre cliente y servidor', horas: 18, eval: EVAL_2 },
  { n: 10, titulo: 'UD10: Introducción a frameworks de cliente', ra: 'RA6: Desarrolla aplicaciones web dinámicas, reconociendo y aplicando mecanismos de comunicación asíncrona entre cliente y servidor', horas: 14, eval: EVAL_2 },
];

// ── TAREAS (las 8 primeras con fecha/peso REALES de las capturas) ──
const TAREAS = [
  { titulo: 'Práctica 1: Arquitecturas y primer script', desc: 'Integración de JavaScript en HTML y evaluación de herramientas de desarrollo.', udRef: 1, eval: EVAL_1, peso: 5,  fecha: fecha(2025, 9, 11) },
  { titulo: 'Práctica 2: Objetos predefinidos y arrays', desc: 'Ejercicios con String, Array, Math, Date y funciones definidas por el usuario.', udRef: 3, eval: EVAL_1, peso: 10, fecha: fecha(2025, 9, 18) },
  { titulo: 'Práctica 3: Manipulación del DOM', desc: 'Selección y modificación dinámica de elementos del documento mediante el DOM.', udRef: 4, eval: EVAL_1, peso: 10, fecha: fecha(2025, 9, 25) },
  { titulo: 'Práctica 4: Eventos y validación de formularios', desc: 'Gestión de eventos y validación de formularios en cliente.', udRef: 5, eval: EVAL_1, peso: 10, fecha: fecha(2025, 10, 6) },
  { titulo: 'Práctica 5: Almacenamiento Local y Session Storage', desc: 'Persistencia de datos en el navegador con Web Storage.', udRef: 6, eval: EVAL_1, peso: 10, fecha: fecha(2025, 10, 20) },
  { titulo: 'Práctica 6: TypeScript', desc: 'Tipado estático, interfaces y clases con TypeScript.', udRef: 7, eval: EVAL_1, peso: 10, fecha: fecha(2025, 11, 5) },
  { titulo: 'Práctica: TypeScript', desc: 'Tipado estático, interfaces y clases con TypeScript.', udRef: 7, eval: EVAL_2, peso: 10, fecha: fecha(2025, 11, 14) },
  { titulo: 'Práctica: jQuery', desc: 'Manipulación del DOM y eventos con jQuery.', udRef: 8, eval: EVAL_2, peso: 10, fecha: fecha(2025, 11, 25) },
  // —— añadidas para dar cuerpo a la 2ª evaluación (ajusta o elimina) ——
  { titulo: 'Práctica: Comunicación asíncrona con Fetch', desc: 'Consumo de APIs REST con Fetch y async/await; render dinámico de resultados.', udRef: 9, eval: EVAL_2, peso: 15, fecha: fecha(2025, 12, 16) },
  { titulo: 'Proyecto final de cliente web', desc: 'Aplicación web de cliente que integra DOM, eventos, almacenamiento y consumo de API.', udRef: 10, eval: EVAL_2, peso: 20, fecha: fecha(2026, 2, 6) },
];

// ── EXÁMENES (reconstrucción coherente; ajusta fechas/títulos) ──
const EXAMENES = [
  { titulo: 'Examen 1ª Evaluación: fundamentos de JavaScript y DOM', desc: 'Sintaxis, objetos predefinidos, arrays y manipulación del DOM.', eval: EVAL_1, tipo: 'parcial', fecha: fecha(2025, 11, 13), peso: 100 },
  { titulo: 'Examen 2ª Evaluación: TypeScript, jQuery y AJAX', desc: 'Tipado estático, bibliotecas de cliente y comunicación asíncrona.', eval: EVAL_2, tipo: 'parcial', fecha: fecha(2026, 2, 12), peso: 100 },
];

let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function detectar() {
  let modulo = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!modulo && (norm(m.abreviatura) === 'dewc' || norm(m.abreviatura) === 'dwec'))
      modulo = { id: d.id, ...m };
  });
  let grupo = null;
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (!grupo && norm(g.nombre) === 'daw2' && (g.cursoAcademico === CURSO || !g.cursoAcademico))
      grupo = { id: d.id, ...g };
  });
  if (!modulo) { console.error('❌ No se encontró el módulo DEWC/DWEC'); process.exit(1); }
  if (!grupo)  { console.error(`❌ No se encontró el grupo DAW2 de ${CURSO}`); process.exit(1); }
  return { modulo, grupo };
}

async function borrarPrevio(moduloId, grupoId) {
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    const snap = await db.collection(col).where('moduloId','==',moduloId).where('grupoId','==',grupoId).get();
    let b = db.batch(), n = 0;
    for (const d of snap.docs) { b.delete(d.ref); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
    if (n % 400 !== 0) await b.commit();
    if (snap.size) console.log(`   🗑️  ${col}: ${snap.size} borrados`);
  }
}

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  REPLICAR PROGRAMACIÓN DEWC · DAW2 · ${CURSO}`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT' : '🔍 DRY-RUN'}${LIMPIAR ? ' + LIMPIAR' : ''}`);
  console.log(`${'═'.repeat(60)}`);
  initFirebase();

  const { modulo, grupo } = await detectar();
  const profesorId = modulo.profesorId || grupo.tutorId || '';
  console.log(`\n✓ Módulo: ${modulo.abreviatura} (${modulo.id})`);
  console.log(`✓ Grupo:  ${grupo.nombre} (${grupo.id})`);

  if (LIMPIAR && COMMIT) { console.log('\n── Limpiando lo anterior ──'); await borrarPrevio(modulo.id, grupo.id); }

  const base = { moduloId: modulo.id, grupoId: grupo.id, profesorId };
  const horasTotal = UNIDADES.reduce((s, u) => s + u.horas, 0);
  const inicio = fecha(2025, 9, 8), fin = fecha(2026, 2, 13);
  const diasTotales = Math.round((fin - inicio) / MS_DIA);

  // Tramos por UD (proporcional a horas)
  const tramo = {}; let acum = 0;
  for (const ud of UNIDADES) {
    const fI = new Date(inicio.getTime() + Math.round(acum / horasTotal * diasTotales) * MS_DIA); fI.setHours(9,0,0,0);
    acum += ud.horas;
    const fF = new Date(inicio.getTime() + Math.round(acum / horasTotal * diasTotales) * MS_DIA); fF.setHours(9,0,0,0);
    tramo[ud.n] = { inicio: fI, fin: fF };
  }

  // 1. Eventos TEMA
  const eventos = UNIDADES.map(ud => ({
    ...base, cursoAcademico: CURSO, evaluacion: ud.eval, tipo: 'tema',
    titulo: ud.titulo, descripcion: ud.ra ? `${ud.ra} · ${ud.horas}h` : `${ud.horas}h`,
    fechaInicio: Timestamp.fromDate(tramo[ud.n].inicio), fechaFin: Timestamp.fromDate(tramo[ud.n].fin),
    color: COLOR.tema, createdAt: nowTs(), updatedAt: nowTs(),
  }));

  // 2. Tareas + eventos actividad
  const tareasDocs = [], eventosTareas = [];
  for (const t of TAREAS) {
    const fEntrega = t.fecha || (tramo[t.udRef] || tramo[0]).fin;
    const fPub = (tramo[t.udRef] || tramo[0]).inicio;
    tareasDocs.push({
      ...base, titulo: t.titulo, descripcion: t.desc,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fechaPublicacion: Timestamp.fromDate(fPub), fechaEntrega: Timestamp.fromDate(fEntrega),
      puntuacionMaxima: 10, porcentajeNotaFinal: t.peso, penalizacionRetraso: 20,
      permiteEntregaTardia: true, esGrupal: false, requiereArchivo: true,
      evaluacion: t.eval, publicada: true, archivada: false, entregas: [], adjuntos: [],
      cursoAcademico: CURSO, createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosTareas.push({
      ...base, cursoAcademico: CURSO, evaluacion: t.eval, tipo: 'actividad',
      titulo: t.titulo, descripcion: `Entrega · ${t.peso}% · ${t.desc}`,
      fechaInicio: Timestamp.fromDate(fEntrega), color: COLOR.actividad,
      createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  // 3. Exámenes + eventos examen
  const examenesDocs = [], eventosExamenes = [];
  for (const ex of EXAMENES) {
    examenesDocs.push({
      ...base, titulo: ex.titulo, descripcion: ex.desc, tipo: ex.tipo, evaluacion: ex.eval,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(ex.fecha), horaInicio: '09:00', horaFin: '11:00',
      aula: 'Aula DAW', duracionMinutos: 120, puntuacionMaxima: 10,
      porcentajeNotaFinal: ex.peso, notaMinimaAprobado: 5, tienePonderacion: false,
      publicado: true, resultadosPublicados: false, permiteRecuperacion: true,
      calificaciones: [], cursoAcademico: CURSO, createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosExamenes.push({
      ...base, cursoAcademico: CURSO, evaluacion: ex.eval, tipo: 'examen',
      titulo: ex.titulo, descripcion: `${ex.tipo} · 10 pts · Aula DAW`,
      fechaInicio: Timestamp.fromDate(ex.fecha), color: COLOR.examen,
      createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  const todosEventos = [...eventos, ...eventosTareas, ...eventosExamenes];
  console.log(`\n📋 A crear: ${todosEventos.length} eventos (${eventos.length} temas, ${eventosTareas.length} actividades, ${eventosExamenes.length} exámenes), ${tareasDocs.length} tareas, ${examenesDocs.length} exámenes`);

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN · vista previa cronológica:');
    [...eventos, ...eventosTareas, ...eventosExamenes]
      .sort((a, b) => a.fechaInicio.toDate() - b.fechaInicio.toDate())
      .forEach(e => {
        const f = e.fechaInicio.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        console.log(`   [${e.tipo.padEnd(10)}] ${f}  ${e.titulo}`);
      });
    console.log('\n👉 Ejecuta con --commit para escribir.\n');
    return;
  }

  async function escribir(col, docs) {
    let b = db.batch(), n = 0;
    for (const doc of docs) { b.set(db.collection(col).doc(), doc); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
    if (n % 400 !== 0) await b.commit();
    console.log(`   · ${col}: ${docs.length} creados`);
  }
  console.log('\n✍️  Escribiendo...');
  await escribir('eventos_programacion', todosEventos);
  await escribir('tareas', tareasDocs);
  await escribir('examenes', examenesDocs);
  console.log('\n✅ Programación de DEWC reconstruida. Recarga Programación/Tareas/Exámenes.\n');
}

run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
