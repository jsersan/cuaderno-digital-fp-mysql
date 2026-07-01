#!/usr/bin/env node
/**
 * reparar-apin-ambos-cursos.mjs
 * ========================================================================
 * Deja la programación de APIN IDÉNTICA en los cursos 2025-2026 y 2026-2027,
 * con las fechas desplazadas exactamente +1 año en el segundo.
 *
 * Qué hace por cada curso:
 *   1. Localiza el grupo SM2 de ese cursoAcademico (lo crea si falta).
 *   2. BORRA todos los eventos_programacion, tareas y examenes de APIN
 *      en ese grupo (elimina duplicados y fechas rotas).
 *   3. REGENERA la programación completa (12 UDs + 9 tareas + 3 exámenes)
 *      con fechas correctas.
 *
 * USO:
 *   node scripts/reparar-apin-ambos-cursos.mjs            # DRY-RUN
 *   node scripts/reparar-apin-ambos-cursos.mjs --commit    # ESCRIBE
 * ========================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };
const MS_DIA = 24 * 3600 * 1000;
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();

// Cursos a igualar (mismo contenido, fechas +1 año)
const CURSOS = [
  { curso: '2025-2026', inicio: new Date(2025, 8, 7), fin: new Date(2026, 1, 15) },
  { curso: '2026-2027', inicio: new Date(2026, 8, 7), fin: new Date(2027, 1, 15) },
];

// ── APIN: 12 UDs ──
const APIN_UDS = [
  { n: 0,  titulo: 'UD0: Presentación del módulo', horas: 1,  eval: EVAL_1 },
  { n: 1,  titulo: 'UD1: Instalación de aplicaciones ofimáticas', horas: 6,  eval: EVAL_1 },
  { n: 2,  titulo: 'UD2: Elaboración de documentos y plantillas', horas: 21, eval: EVAL_1 },
  { n: 3,  titulo: 'UD3: Elaboración de hojas de cálculo', horas: 28, eval: EVAL_1 },
  { n: 4,  titulo: 'UD4: Elaboración de presentaciones', horas: 14, eval: EVAL_1 },
  { n: 5,  titulo: 'UD5: Gestión de correo y agenda electrónica', horas: 7,  eval: EVAL_1 },
  { n: 6,  titulo: 'UD6: Diseño de una base de datos relacional', horas: 21, eval: EVAL_1 },
  { n: 7,  titulo: 'UD7: Definición y manipulación de bases de datos (I)', horas: 28, eval: EVAL_1 },
  { n: 8,  titulo: 'UD8: Definición y manipulación de bases de datos (II)', horas: 28, eval: EVAL_2 },
  { n: 9,  titulo: 'UD9: Manipulación básica de imágenes', horas: 28, eval: EVAL_2 },
  { n: 10, titulo: 'UD10: Manipulación avanzada de imágenes', horas: 21, eval: EVAL_2 },
  { n: 11, titulo: 'UD11: Manipulación de secuencias de vídeo', horas: 28, eval: EVAL_2 },
];
// ── APIN: 9 tareas ──
const APIN_TAREAS = [
  { titulo: 'Práctica 1: Instalación y configuración de la suite ofimática', desc: 'Instalación, actualización y configuración de aplicaciones ofimáticas.', udRef: 1, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 2: Documento con estilos, índices y plantillas', desc: 'Documento extenso con estilos, tablas, índices y plantillas.', udRef: 2, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 3: Hoja de cálculo con fórmulas y gráficos', desc: 'Funciones avanzadas, referencias, gráficos y formato condicional.', udRef: 3, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 4: Presentación multimedia', desc: 'Presentación con normas de composición, transiciones y multimedia.', udRef: 4, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 5: Gestión de correo y agenda', desc: 'Configuración de cuentas de correo, reglas, contactos y agenda.', udRef: 5, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 6: Diseño de base de datos relacional', desc: 'Modelo entidad-relación y creación de tablas con relaciones.', udRef: 6, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 7: Consultas, formularios e informes', desc: 'Manipulación con consultas, formularios e informes.', udRef: 8, eval: EVAL_2, peso: 15 },
  { titulo: 'Práctica 8: Retoque de imágenes digitales', desc: 'Manipulación básica y avanzada: capas, máscaras y filtros.', udRef: 10, eval: EVAL_2, peso: 10 },
  { titulo: 'Proyecto final: Edición de secuencias de vídeo', desc: 'Captura y edición de vídeo con transiciones, audio y exportación.', udRef: 11, eval: EVAL_2, peso: 15 },
];
// ── APIN: 3 exámenes ──
const APIN_EXAMENES = [
  { titulo: 'Examen 1ª Eval: Procesador de textos y hoja de cálculo', desc: 'Documentos, plantillas, hojas de cálculo con funciones y gráficos.', udRef: 3, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen 1ª Eval: Presentaciones, correo y bases de datos', desc: 'Presentaciones multimedia, gestión de correo y diseño de BD.', udRef: 7, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen final: Bases de datos, imagen y vídeo', desc: 'BD, imágenes digitales y secuencias de vídeo.', udRef: 11, eval: EVAL_2, tipo: 'final', esFinal: true },
];

let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

function fechaProporcional(inicio, fin, fraccion) {
  const d = new Date(inicio.getTime() + fraccion * (fin.getTime() - inicio.getTime()));
  d.setHours(9, 0, 0, 0);
  return d;
}

function generarProgramacion(moduloId, grupoId, profesorId, curso, fechaInicio, fechaFin) {
  const base = { moduloId, grupoId, profesorId };
  const horasTotal = APIN_UDS.reduce((s, u) => s + u.horas, 0);

  const tramo = {};
  let acum = 0;
  for (const ud of APIN_UDS) {
    const fInicio = fechaProporcional(fechaInicio, fechaFin, acum / horasTotal);
    acum += ud.horas;
    const fFin = fechaProporcional(fechaInicio, fechaFin, acum / horasTotal);
    tramo[ud.n] = { inicio: fInicio, fin: fFin };
  }

  const eventos = APIN_UDS.map(ud => ({
    ...base, cursoAcademico: curso, evaluacion: ud.eval, tipo: 'tema',
    titulo: ud.titulo, descripcion: `${ud.horas}h`,
    fechaInicio: Timestamp.fromDate(tramo[ud.n].inicio),
    fechaFin: Timestamp.fromDate(tramo[ud.n].fin),
    color: COLOR.tema, createdAt: nowTs(), updatedAt: nowTs(),
  }));

  const tareasDocs = [], eventosTareas = [];
  for (const t of APIN_TAREAS) {
    const tr = tramo[t.udRef] || tramo[0];
    const fEntrega = new Date(tr.fin); fEntrega.setHours(9, 0, 0, 0);
    const fPub = new Date(tr.inicio);
    tareasDocs.push({
      ...base, titulo: t.titulo, descripcion: t.desc,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fechaPublicacion: Timestamp.fromDate(fPub),
      fechaEntrega: Timestamp.fromDate(fEntrega),
      puntuacionMaxima: 10, porcentajeNotaFinal: t.peso,
      penalizacionRetraso: 20, permiteEntregaTardia: true,
      esGrupal: false, requiereArchivo: true,
      evaluacion: t.eval, publicada: true, archivada: false,
      entregas: [], adjuntos: [], cursoAcademico: curso,
      createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosTareas.push({
      ...base, cursoAcademico: curso, evaluacion: t.eval, tipo: 'actividad',
      titulo: t.titulo, descripcion: `Entrega · ${t.peso}% · ${t.desc}`,
      fechaInicio: Timestamp.fromDate(fEntrega),
      color: COLOR.actividad, createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  const examenesDocs = [], eventosExamenes = [];
  for (const ex of APIN_EXAMENES) {
    let fEx;
    if (ex.esFinal) { fEx = new Date(fechaFin); }
    else { fEx = new Date((tramo[ex.udRef] || tramo[0]).fin); }
    fEx.setHours(9, 0, 0, 0);
    examenesDocs.push({
      ...base, titulo: ex.titulo, descripcion: ex.desc, tipo: ex.tipo,
      evaluacion: ex.eval, resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(fEx), horaInicio: '09:00', horaFin: '11:00',
      aula: 'Aula SMR', duracionMinutos: 120, puntuacionMaxima: 10,
      porcentajeNotaFinal: ex.tipo === 'final' ? 40 : 30,
      notaMinimaAprobado: 5, tienePonderacion: false,
      publicado: true, resultadosPublicados: false,
      permiteRecuperacion: true, calificaciones: [], cursoAcademico: curso,
      createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosExamenes.push({
      ...base, cursoAcademico: curso, evaluacion: ex.eval, tipo: 'examen',
      titulo: ex.titulo, descripcion: `${ex.tipo} · 10 pts · Aula SMR`,
      fechaInicio: Timestamp.fromDate(fEx),
      color: COLOR.examen, createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  return {
    eventos: [...eventos, ...eventosTareas, ...eventosExamenes],
    tareas: tareasDocs,
    examenes: examenesDocs,
  };
}

async function borrarDeColeccion(coleccion, moduloId, grupoId) {
  const snap = await db.collection(coleccion)
    .where('moduloId', '==', moduloId)
    .where('grupoId', '==', grupoId)
    .get();
  if (snap.empty) return 0;
  let batch = db.batch(), n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400 !== 0) await batch.commit();
  return n;
}

async function escribir(coleccion, docs) {
  let batch = db.batch(), n = 0;
  for (const doc of docs) {
    batch.set(db.collection(coleccion).doc(), doc);
    n++;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400 !== 0) await batch.commit();
  return docs.length;
}

async function run() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  REPARAR APIN · IGUALAR 2025-2026 y 2026-2027`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT (escribe)' : '🔍 DRY-RUN (no escribe)'}`);
  console.log(`${'═'.repeat(64)}`);
  initFirebase();

  // Localizar APIN
  let apin = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!apin && norm(m.abreviatura) === 'apin') apin = { id: d.id, ...m };
  });
  if (!apin) { console.error('❌ No se encontró APIN'); process.exit(1); }
  const profesorId = apin.profesorId || '';
  console.log(`\n✓ APIN: ${apin.id} (profesorId: ${profesorId})`);

  // Mapa de grupos SM2 por cursoAcademico
  const gruposSM2 = {};
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (norm(g.nombre) === 'sm2') gruposSM2[g.cursoAcademico] = { id: d.id, ref: d.ref, ...g };
  });
  console.log('✓ Grupos SM2 encontrados:');
  for (const [curso, g] of Object.entries(gruposSM2)) {
    console.log(`   · ${curso}: ${g.id}`);
  }

  // Procesar cada curso
  for (const { curso, inicio, fin } of CURSOS) {
    console.log(`\n── CURSO ${curso} ──`);
    let grupo = gruposSM2[curso];

    // Crear grupo SM2 del curso si falta (copiando del primero que exista)
    if (!grupo) {
      const plantilla = Object.values(gruposSM2)[0];
      if (!plantilla) { console.error(`   ❌ No hay ningún grupo SM2 base para crear el de ${curso}`); continue; }
      console.log(`   ⚠️  No existe SM2 para ${curso}. Se creará (copia de ${plantilla.cursoAcademico}).`);
      if (COMMIT) {
        const nuevo = {
          nombre: 'SM2', curso: plantilla.curso || 2, letra: plantilla.letra || '',
          cicloId: plantilla.cicloId || '', cicloNombre: plantilla.cicloNombre || '',
          centroId: plantilla.centroId || '', tutorId: plantilla.tutorId || profesorId,
          cursoAcademico: curso, turno: plantilla.turno || 'mañana',
          aula: plantilla.aula || 'Aula SMR', alumnosIds: [], modulosIds: [],
          activo: true, createdAt: nowTs(), updatedAt: nowTs(),
        };
        const ref = await db.collection('grupos').add(nuevo);
        grupo = { id: ref.id, ref, ...nuevo };
        gruposSM2[curso] = grupo;
        console.log(`   ✓ Grupo SM2 (${curso}) creado: ${ref.id}`);
      } else {
        console.log(`   [DRY] Se crearía grupo SM2 para ${curso}`);
        continue; // sin grupo no podemos generar en dry-run
      }
    } else {
      console.log(`   ✓ Grupo SM2: ${grupo.id}`);
    }

    // 1. BORRAR lo anterior de APIN en este grupo
    if (COMMIT) {
      const be = await borrarDeColeccion('eventos_programacion', apin.id, grupo.id);
      const bt = await borrarDeColeccion('tareas', apin.id, grupo.id);
      const bx = await borrarDeColeccion('examenes', apin.id, grupo.id);
      console.log(`   🗑️  Borrados: ${be} eventos, ${bt} tareas, ${bx} exámenes`);
    } else {
      const ce = (await db.collection('eventos_programacion').where('moduloId','==',apin.id).where('grupoId','==',grupo.id).get()).size;
      const ct = (await db.collection('tareas').where('moduloId','==',apin.id).where('grupoId','==',grupo.id).get()).size;
      const cx = (await db.collection('examenes').where('moduloId','==',apin.id).where('grupoId','==',grupo.id).get()).size;
      console.log(`   [DRY] Se borrarían: ${ce} eventos, ${ct} tareas, ${cx} exámenes`);
    }

    // 2. REGENERAR
    const data = generarProgramacion(apin.id, grupo.id, profesorId, curso, inicio, fin);
    console.log(`   📋 A crear: ${data.eventos.length} eventos, ${data.tareas.length} tareas, ${data.examenes.length} exámenes`);
    if (COMMIT) {
      await escribir('eventos_programacion', data.eventos);
      await escribir('tareas', data.tareas);
      await escribir('examenes', data.examenes);
      console.log(`   ✓ Programación regenerada para ${curso}`);
    } else {
      // Vista previa de exámenes (los que estaban mal)
      console.log('   Exámenes que se crearían:');
      for (const ex of data.examenes) {
        const f = ex.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        console.log(`      ${f}  ${ex.titulo}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(64)}`);
  if (!COMMIT) {
    console.log('  🔍 DRY-RUN: no se ha escrito nada. Revisa las fechas de arriba.');
    console.log('  Si cuadran, ejecuta con --commit.\n');
  } else {
    console.log('  ✅ APIN igualado en ambos cursos (fechas +1 año en 2026-2027).');
    console.log('  Recarga Programación y Exámenes en cada curso para verlo.\n');
  }
}

run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
