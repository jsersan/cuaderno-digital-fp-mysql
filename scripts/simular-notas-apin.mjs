#!/usr/bin/env node
/**
 * simular-notas-apin.mjs
 * ==========================================================================
 * Simula TODAS las notas de APIN / SM2 (curso 2026-2027) con una distribución
 * heterogénea que da ~75% de aprobados (≈9 de 12; ~3 suspenden y van a
 * recuperación). Las puntuaciones de exámenes, tareas y actitud varían entre
 * alumnos y entre pruebas; los alumnos "flojos" faltan más y sacan menos
 * (coherente con simular-asistencia-apin.mjs si usas la MISMA --seed).
 *
 *   FASE 1 · Nivel por alumno (determinista)      → flojo / medioBajo / medioAlto / bueno
 *   FASE 2 · Exámenes      → calificaciones[]: CalificacionExamen
 *   FASE 3 · Tareas        → entregas[]: EntregaTarea
 *   FASE 4 · Finales       → Calificacion (una por alumno y evaluación), 75% aprob.
 *   FASE 5 · Recuperaciones→ Recuperacion con AlumnoRecuperacion[]
 *
 * Lee los PESOS reales del módulo (criteriosCalificacion). No crea alumnos ni
 * exámenes ni tareas: usa los que ya existen.
 *
 * USO:
 *   node scripts/simular-notas-apin.mjs                 # DRY-RUN (no escribe)
 *   node scripts/simular-notas-apin.mjs --commit        # escribe
 *   node scripts/simular-notas-apin.mjs --commit --limpiar   # borra notas previas antes
 *   node scripts/simular-notas-apin.mjs --seed=42
 *   node scripts/simular-notas-apin.mjs --grupo=ID --curso=2026-2027
 * ==========================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMMIT  = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');
const argVal = (name, def) => { const a = process.argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : def; };
const SEED  = parseInt(argVal('--seed', '2026'), 10) || 2026;
const CURSO = argVal('--curso', '2026-2027');
const GRUPO_ID = argVal('--grupo', '');

const ABREV_MODULO = 'APIN';
const NOMBRE_GRUPO = '1SM2';
const NOTA_APROBADO = 5;
const NOTA_MAX_RECUP = 6;
const ESTADO_TAREA = { CORREGIDA: 'corregida', NO_ENTREGADA: 'no_entregada' };

// ── PRNG determinista (mulberry32) ───────────────────────────────────────
function makeRng(seed){let a=seed>>>0;return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rng = makeRng(SEED);
const rand = (min, max) => min + rng() * (max - min);
const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const media = arr => (arr && arr.length) ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
function gauss(m, sd){ const u1 = Math.max(rng(), 1e-9), u2 = rng(); return m + Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2) * sd; }

// ── Niveles: medias realistas por nivel (final sale natural; se fuerza solo el aprobado/suspende) ──
const NIVELES = {
  flojo:     { ex: 3.8, ta: 4.2, ac: [4, 6],   as: [6, 8] },
  medioBajo: { ex: 5.4, ta: 5.9, ac: [6, 7.5], as: [8, 9.3] },
  medioAlto: { ex: 6.9, ta: 7.3, ac: [7, 8.5], as: [9, 10] },
  bueno:     { ex: 8.3, ta: 8.7, ac: [8, 10],  as: [9.5, 10] },
};

/** Asigna nivel a cada alumno de forma determinista: 40% flojo (suspenden) → ~60% aprobados, resto repartido. */
function asignarNiveles(n) {
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nFail = Math.max(1, Math.round(n * 0.40)), resto = n - nFail, por = Math.floor(resto / 3);
  const niv = new Array(n);
  idx.forEach((orig, k) => {
    niv[orig] = k < nFail ? 'flojo'
              : k < nFail + por ? 'medioBajo'
              : k < nFail + 2 * por ? 'medioAlto'
              : 'bueno';
  });
  return niv;
}

let db;
function initFirebase() {
  const saPath = join(__dirname, 'serviceAccount.json');
  let sa; try { sa = JSON.parse(readFileSync(saPath, 'utf8')); }
  catch { console.error(`\n❌ No se encontró ${saPath}\n`); process.exit(1); }
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
  return sa.project_id;
}
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Pesos del módulo (criteriosCalificacion). Normaliza porcentajes → fracciones. Fallback 60/20/10/10. */
function pesosDe(modulo) {
  const c = modulo.criteriosCalificacion || {};
  let ex = c.porcentajeExamenes ?? 60, ta = c.porcentajeTareas ?? 20, ac = c.porcentajeActitud ?? 10, as = c.porcentajeAsistencia ?? 10;
  const tot = ex + ta + ac + as || 100;
  return { ex: ex / tot, ta: ta / tot, ac: ac / tot, as: as / tot, min: c.notaMinimaAprobado ?? NOTA_APROBADO };
}

async function localizar() {
  // Módulo APIN
  let modulo = null;
  (await db.collection('modulos').get()).forEach(d => { const m = d.data();
    if (!modulo && norm(m.abreviatura) === norm(ABREV_MODULO)) modulo = { id: d.id, ...m }; });
  if (!modulo) { console.error(`❌ No existe el módulo ${ABREV_MODULO}`); process.exit(1); }

  // Grupo: por --grupo=ID, o por nombre+curso, o el que más matriculados en APIN tenga.
  const gruposSnap = await db.collection('grupos').get();
  const grupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  let grupo = null;
  if (GRUPO_ID) grupo = grupos.find(g => g.id === GRUPO_ID);
  if (!grupo) {
    let cands = grupos.filter(g => Array.isArray(g.modulosIds) && g.modulosIds.includes(modulo.id) && (!CURSO || g.cursoAcademico === CURSO));
  if (!cands.length) cands = grupos.filter(g => norm(g.nombre).includes(norm(NOMBRE_GRUPO)) && (!CURSO || g.cursoAcademico === CURSO));
    // Prioriza los grupos del MISMO ciclo que el módulo (APIN vive en su propio ciclo)
    const mismoCiclo = cands.filter(g => g.cicloId === modulo.cicloId);
    if (mismoCiclo.length) cands = mismoCiclo;
    if (cands.length > 1) console.log(`ℹ Varios grupos ${NOMBRE_GRUPO} candidatos: ${cands.map(g => `${g.id}/${g.cursoAcademico}`).join(', ')} (elijo por matriculados; usa --grupo=ID para forzar)`);
    if (cands.length === 1) grupo = cands[0];
    else if (cands.length > 1) {
      let mejor = null, mejorN = -1;
      for (const g of cands) {
        const aSnap = await db.collection('alumnos').where('grupoId', '==', g.id).get();
        const nMat = aSnap.docs.filter(d => (d.data().matriculas || []).some(m => m.moduloId === modulo.id)).length;
        const score = nMat || aSnap.size; if (score > mejorN) { mejorN = score; mejor = g; }
      }
      grupo = mejor;
    }
  }
  if (!grupo) {
    console.error(`❌ No se encontró el grupo ${NOMBRE_GRUPO} (curso ${CURSO}).`);
    console.error(`   Grupos ${NOMBRE_GRUPO}: ${grupos.filter(g => norm(g.nombre) === norm(NOMBRE_GRUPO)).map(g => `${g.id}/${g.cursoAcademico}`).join(', ') || '(ninguno)'}`);
    console.error(`   Puedes forzarlo con --grupo=ID`);
    process.exit(1);
  }
  return { modulo, grupo };
}

async function run() {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  SIMULAR NOTAS APIN / ${NOMBRE_GRUPO}  ·  curso ${CURSO}  ·  semilla ${SEED}`);
  console.log(`  Modo: ${COMMIT ? 'COMMIT (escribe)' : 'DRY-RUN (no escribe)'}${LIMPIAR ? ' + LIMPIAR' : ''}`);
  console.log(`${'='.repeat(64)}`);

  const projectId = initFirebase();
  console.log(`🔌 Proyecto: ${projectId}`);
  const { modulo, grupo } = await localizar();
  const M = modulo.id, G = grupo.id, PROF = modulo.profesorId || '';
  const W = pesosDe(modulo);
  console.log(`✓ Módulo APIN: ${M}`);
  console.log(`✓ Grupo ${grupo.nombre}: ${G} (curso ${grupo.cursoAcademico})`);
  console.log(`✓ Pesos: exám ${Math.round(W.ex*100)}% · tareas ${Math.round(W.ta*100)}% · actitud ${Math.round(W.ac*100)}% · asist ${Math.round(W.as*100)}% · aprobado ≥ ${W.min}`);

  // Alumnos del grupo matriculados en APIN (fallback: todos los del grupo)
  const aSnap = await db.collection('alumnos').where('grupoId', '==', G).get();
  let alumnos = aSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.estado === undefined || a.estado === 'activo');
  const matriculados = alumnos.filter(a => (a.matriculas || []).some(m => m.moduloId === M));
  if (matriculados.length) alumnos = matriculados;
  else console.log('⚠ Ningún alumno tiene matrícula explícita en APIN; uso todos los del grupo.');
  alumnos = alumnos.map(a => ({ id: a.id, nombre: a.nombre, apellidos: a.apellidos, full: `${a.apellidos}, ${a.nombre}` }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));
  console.log(`✓ Alumnos: ${alumnos.length}`);
  if (!alumnos.length) { console.error('❌ Sin alumnos.'); process.exit(1); }

  // Exámenes y tareas existentes
  const exSnap = await db.collection('examenes').where('moduloId', '==', M).where('grupoId', '==', G).get();
  const examenes = exSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const tSnap = await db.collection('tareas').where('moduloId', '==', M).where('grupoId', '==', G).get();
  const tareas = tSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })).filter(t => !t.archivada);
  console.log(`✓ Exámenes: ${examenes.length} · Tareas: ${tareas.length}`);
  if (!examenes.length && !tareas.length) { console.error('❌ No hay exámenes ni tareas para poblar.'); process.exit(1); }

  // FASE 1 — niveles
  const niveles = asignarNiveles(alumnos.length);
  const nivelDe = {}; alumnos.forEach((a, i) => nivelDe[a.id] = niveles[i]);
  const cuenta = t => alumnos.filter(a => nivelDe[a.id] === t).length;
  console.log(`\n📊 FASE 1 · Niveles: flojo=${cuenta('flojo')}  medioBajo=${cuenta('medioBajo')}  medioAlto=${cuenta('medioAlto')}  bueno=${cuenta('bueno')}`);

  // FASE 2 — exámenes → calificaciones[]; guardamos REFERENCIAS por (alumno, eval) para poder ajustar
  const exPorEval = {};   // ev -> alumnoId -> [entry,...] (entry.nota mutable)
  const examenUpdates = [];
  const evalsExamen = new Set();
  for (const ex of examenes) {
    const ev = ex.evaluacion || '1ª Evaluación';
    evalsExamen.add(ev);
    const min = ex.notaMinimaAprobado ?? W.min;
    exPorEval[ev] ||= {};
    const calificaciones = alumnos.map(a => {
      const cfg = NIVELES[nivelDe[a.id]];
      const entry = {
        alumnoId: a.id, alumnoNombre: a.full, nota: round1(clamp(gauss(cfg.ex, 1.3), 0, 10)),
        noPresente: false, observaciones: '', fechaCalificacion: Timestamp.now(), _min: min
      };
      (exPorEval[ev][a.id] ||= []).push(entry);
      return entry;
    });
    examenUpdates.push({ ref: ex.ref, titulo: ex.titulo, evaluacion: ev, calificaciones });
  }

  // FASE 3 — tareas → entregas[]; guardamos notas por (alumno, eval) y referencia a la entrega para poder ajustar
  const taPorEval = {};   // ev -> alumnoId -> [{ get/set nota }]
  const tareaUpdates = [];
  const evalsTarea = new Set();
  for (const t of tareas) {
    const ev = t.evaluacion || '1ª Evaluación';
    evalsTarea.add(ev);
    taPorEval[ev] ||= {};
    const entregas = alumnos.map(a => {
      const nivel = nivelDe[a.id], cfg = NIVELES[nivel];
      const noEntrega = (nivel === 'flojo' && rng() < 0.18) || (nivel === 'medioBajo' && rng() < 0.06);
      const entry = noEntrega
        ? { alumnoId: a.id, alumnoNombre: a.full, estado: ESTADO_TAREA.NO_ENTREGADA, nota: 0, observaciones: 'No entregada', archivos: [] }
        : { alumnoId: a.id, alumnoNombre: a.full, fechaEntrega: Timestamp.now(), estado: ESTADO_TAREA.CORREGIDA,
            nota: round1(clamp(gauss(cfg.ta, 1.1), 0, 10)), observaciones: '', archivos: [], corregidoPor: PROF, fechaCorreccion: Timestamp.now() };
      (taPorEval[ev][a.id] ||= []).push(entry);  // referencia mutable a la entrega
      return entry;
    });
    tareaUpdates.push({ ref: t.ref, titulo: t.titulo, evaluacion: ev, entregas });
  }

  // FASE 4 — finales por (alumno, evaluación), forzando el aprobado/suspende según nivel
  const TODAS_EVALS = [...new Set([...evalsExamen, ...evalsTarea])].sort();
  const actitudPorEval = {};  // ev -> alumnoId -> actitud
  const calificacionesFinales = [];
  for (const ev of TODAS_EVALS) {
    actitudPorEval[ev] = {};
    for (const a of alumnos) {
      const nivel = nivelDe[a.id], cfg = NIVELES[nivel];
      const exEntries = exPorEval[ev]?.[a.id] || [];
      const taEntries = taPorEval[ev]?.[a.id] || [];
      const asist = round1(rand(cfg.as[0], cfg.as[1]));
      let actitud = round1(rand(cfg.ac[0], cfg.ac[1]));
      let nEx = round1(media(exEntries.map(e => e.nota)));
      let nTa = round1(media(taEntries.map(e => e.nota)));
      const hasEx = exEntries.length > 0, hasTa = taEntries.length > 0;
      const wEx = hasEx ? W.ex : 0, wTa = hasTa ? W.ta : 0;
      const wsum = wEx + wTa + W.ac + W.as || 1;   // renormaliza si falta exámenes o tareas en la eval
      const calcFinal = () => round1(clamp((wEx*nEx + wTa*nTa + W.ac*actitud + W.as*asist) / wsum, 0, 10));
      let final = calcFinal();
      const debeAprobar = nivel !== 'flojo';
      let guard = 0;
      while (guard++ < 120 && ((debeAprobar && final < W.min) || (!debeAprobar && final >= W.min))) {
        actitud = clamp(actitud + (debeAprobar ? 0.3 : -0.3), 0, 10);
        final = calcFinal();
        if ((actitud === 0 || actitud === 10) && final !== (debeAprobar ? W.min : W.min - 0.1)) {
          const d = debeAprobar ? 0.3 : -0.3;
          for (const e of taEntries) e.nota = round1(clamp(e.nota + d, 0, 10));   // ajusta entregas reales
          nTa = round1(media(taEntries.map(e => e.nota)));
          if (nTa === (debeAprobar ? 10 : 0)) {                                    // último recurso: ajustar exámenes
            for (const e of exEntries) e.nota = round1(clamp(e.nota + d, 0, 10));
            nEx = round1(media(exEntries.map(e => e.nota)));
          }
          final = calcFinal();
        }
      }
      actitudPorEval[ev][a.id] = round1(actitud);
      calificacionesFinales.push({
        alumnoId: a.id, full: a.full, moduloId: M, grupoId: G, profesorId: PROF, cursoAcademico: CURSO,
        evaluacion: ev,
        notaExamenes: hasEx ? nEx : 0, notaTareas: hasTa ? nTa : 0, notaActitud: round1(actitud), notaAsistencia: asist,
        notaCalculada: final, notaFinal: final, aprobado: final >= W.min,
        notasPorRA: [], observaciones: '', necesitaRecuperacion: final < W.min,
        bloqueada: false, publicada: true,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now()
      });
    }
  }

  // Marcar necesitaRecuperacion en cada examen según la nota definitiva
  for (const u of examenUpdates) for (const e of u.calificaciones) { e.necesitaRecuperacion = e.nota < (e._min ?? W.min); delete e._min; }

  // FASE 5 — recuperaciones: por eval, alumnos con algún examen < min. Los "flojo" no recuperan (siguen suspensos).
  const recuperaciones = [];
  for (const ev of evalsExamen) {
    const min = W.min;
    const convocados = [];
    for (const a of alumnos) {
      const entries = exPorEval[ev]?.[a.id] || [];
      const peor = entries.length ? Math.min(...entries.map(e => e.nota)) : null;
      if (peor != null && peor < min) {
        const flojo = nivelDe[a.id] === 'flojo';
        const aprueba = !flojo && rng() < 0.8;  // los flojos no recuperan
        const notaRec = aprueba ? round1(rand(5, NOTA_MAX_RECUP)) : round1(rand(2.5, 4.8));
        convocados.push({ alumnoId: a.id, alumnoNombre: a.full, notaOriginal: peor,
          notaRecuperacion: notaRec, estado: aprueba ? 'aprobado' : 'suspenso', observaciones: '' });
      }
    }
    if (!convocados.length) continue;
    recuperaciones.push({
      titulo: `Recuperación ${ev}: APIN`,
      descripcion: `Recuperación de la ${ev} del módulo Aplicaciones Ofimáticas.`,
      moduloId: M, grupoId: G, profesorId: PROF, evaluacion: ev, tipoRecuperacion: 'examen',
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(new Date(2027, 1, 17, 9, 0, 0)),
      horaInicio: '09:00', horaFin: '11:00',
      puntuacionMaxima: 10, notaMaximaRecuperacion: NOTA_MAX_RECUP, notaMinimaAprobado: NOTA_APROBADO,
      alumnosConvocados: convocados, publicada: true, resultadosPublicados: true,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now()
    });
  }

  // RESUMEN
  const finOf = ev => calificacionesFinales.filter(c => c.evaluacion === ev);
  console.log('\n📋 RESUMEN A ESCRIBIR:');
  console.log(`   · Exámenes a actualizar: ${examenUpdates.length} (${alumnos.length} notas c/u)`);
  console.log(`   · Tareas a actualizar:   ${tareaUpdates.length} (${alumnos.length} entregas c/u)`);
  console.log(`   · Recuperaciones:        ${recuperaciones.length}`);
  recuperaciones.forEach(r => console.log(`       - ${r.titulo}: ${r.alumnosConvocados.length} convocados, ${r.alumnosConvocados.filter(x => x.estado === 'aprobado').length} recuperan`));
  console.log(`   · Calificaciones finales: ${calificacionesFinales.length}`);
  for (const ev of TODAS_EVALS) {
    const f = finOf(ev), ap = f.filter(c => c.aprobado).length;
    console.log(`       ${ev}: aprobados ${ap}/${f.length} (${Math.round(ap/f.length*100)}%) · media ${round1(media(f.map(c => c.notaFinal)))}`);
  }
  const evMuestra = TODAS_EVALS[0];
  console.log(`\n   Muestra (${evMuestra}):`);
  finOf(evMuestra).sort((a,b)=>a.notaFinal-b.notaFinal).forEach(c =>
    console.log(`     ${c.full.padEnd(30)} ex:${c.notaExamenes.toFixed(1)} ta:${c.notaTareas.toFixed(1)} ac:${c.notaActitud.toFixed(1)} as:${c.notaAsistencia.toFixed(1)} → FINAL ${c.notaFinal.toFixed(1)} ${c.aprobado ? '✓' : '✗'}`));

  if (!COMMIT) {
    console.log('\n🔍 DRY-RUN: no se ha escrito nada. Si te cuadra: --commit (o --commit --limpiar)\n');
    process.exit(0);
  }

  if (LIMPIAR) {
    console.log('\n🧹 Limpiando recuperaciones y calificaciones previas de APIN/' + grupo.nombre + '...');
    for (const col of ['recuperaciones', 'calificaciones']) {
      const prev = await db.collection(col).where('moduloId', '==', M).where('grupoId', '==', G).get();
      let b = db.batch(); prev.forEach(d => b.delete(d.ref)); await b.commit();
      console.log(`   ${col}: borrados ${prev.size}`);
    }
  }

  console.log('\n✍️  Escribiendo...');
  for (const u of examenUpdates) await u.ref.update({ calificaciones: u.calificaciones, resultadosPublicados: true, updatedAt: Timestamp.now() });
  console.log(`   · exámenes: ${examenUpdates.length}`);
  for (const u of tareaUpdates) await u.ref.update({ entregas: u.entregas, publicada: true, updatedAt: Timestamp.now() });
  console.log(`   · tareas: ${tareaUpdates.length}`);
  for (const r of recuperaciones) await db.collection('recuperaciones').add(r);
  console.log(`   · recuperaciones: ${recuperaciones.length}`);
  let b = db.batch(), n = 0;
  for (const c of calificacionesFinales) { const { full, ...doc } = c; b.set(db.collection('calificaciones').doc(), doc); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
  await b.commit();
  console.log(`   · calificaciones finales: ${calificacionesFinales.length}`);
  console.log('\n✅ Notas simuladas correctamente.');
  console.log('   Si quieres que la nota de asistencia cuadre con faltas reales, ejecuta también');
  console.log('   simular-asistencia-apin.mjs con la MISMA --seed.\n');
  process.exit(0);
}
run().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
