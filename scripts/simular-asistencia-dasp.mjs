#!/usr/bin/env node
/**
 * ============================================================================
 *  simular-asistencia-dasp.mjs   (curso 2026-2027)
 *
 *  Simula un curso de ASISTENCIA (sept 2026 → feb 2027) para DASP / SM2.
 *  Escribe en AMBAS colecciones:
 *    - asistencia_mensual : doc por grupo/módulo/mes con faltas I/J por día
 *    - asistencia         : un registro de "pasar lista" por día lectivo y franja
 *
 *  Los niveles de absentismo se asignan con la MISMA lógica determinista que
 *  simular-notas-dasp.mjs: si usas la misma --seed, los alumnos que más faltan
 *  son los que peor van de notas (coherencia notas ↔ asistencia).
 *
 *  NO crea alumnos: usa los matriculados en DASP (o, si no hay matrícula
 *  explícita, todos los del grupo).
 *
 *  USO:
 *    node scripts/simular-asistencia-dasp.mjs            (dry-run)
 *    node scripts/simular-asistencia-dasp.mjs --commit   (escribe)
 *    node scripts/simular-asistencia-dasp.mjs --commit --limpiar
 *    node scripts/simular-asistencia-dasp.mjs --seed=2026 --grupo=ID --curso=2026-2027
 * ============================================================================
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = join(__dirname, 'serviceAccount.json');

// ── CONFIGURACIÓN ───────────────────────────────────────────────────────────
const ABREV_MODULO = 'DASP';
const NOMBRE_GRUPO = '1SM2';
const argVal = (name, def) => { const a = process.argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : def; };
const CURSO_ACADEMICO = argVal('--curso', '2026-2027');
const GRUPO_ID = argVal('--grupo', '');

// Curso: septiembre 2026 → febrero 2027 (mes en base 0)
const MESES = [
  { anio: 2026, mes: 8 },  // Septiembre
  { anio: 2026, mes: 9 },  // Octubre
  { anio: 2026, mes: 10 }, // Noviembre
  { anio: 2026, mes: 11 }, // Diciembre
  { anio: 2027, mes: 0 },  // Enero
  { anio: 2027, mes: 1 }   // Febrero
];

// Franjas en las que DASP se imparte (genera un registro de "pasar lista" por franja y día)
const FRANJAS_DASP = ['08:30-09:25'];   // DASP es 1h/semana → una franja

// Probabilidad de falta por día lectivo según nivel (mismos niveles que las notas).
// Los "flojo" faltan bastante (algunos por debajo del 85%); los "bueno" casi nunca.
const PFALTA = { flojo: 0.10, medioBajo: 0.055, medioAlto: 0.028, bueno: 0.012 }; // tope ~10% faltas; el 25% 'flojo' (3 en DAW2) ronda el 10%, el resto menos
const PJUSTIF = { flojo: 0.4, medioBajo: 0.5, medioAlto: 0.6, bueno: 0.7 };

const COMMIT = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');
const SEED = parseInt(argVal('--seed', '2026'), 10) || 2026;

const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// PRNG determinista (mulberry32) — idéntico al de simular-notas-dasp.mjs
function makeRng(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Asigna nivel a cada alumno EXACTAMENTE igual que simular-notas-dasp.mjs
 *  (misma baraja con el primer consumo del RNG), para que falten más los que
 *  peor van. IMPORTANTE: se llama ANTES de consumir el RNG para otra cosa. */
function asignarNiveles(n, rng) {
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nFail = Math.max(1, Math.round(n * 0.25)), resto = n - nFail, por = Math.floor(resto / 3);
  const niv = new Array(n);
  idx.forEach((orig, k) => { niv[orig] = k < nFail ? 'flojo' : k < nFail + por ? 'medioBajo' : k < nFail + 2 * por ? 'medioAlto' : 'bueno'; });
  return niv;
}

function diasLectivosDelMes(anio, mes) {
  const numDias = new Date(anio, mes + 1, 0).getDate();
  const dias = [];
  for (let d = 1; d <= numDias; d++) { const dow = new Date(anio, mes, d).getDay(); if (dow !== 0 && dow !== 6) dias.push(d); }
  return dias;
}

async function resolverGrupo(db, modulo) {
  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  if (GRUPO_ID) { const g = grupos.find(x => x.id === GRUPO_ID); if (g) return g; }
  let cands = grupos.filter(g => Array.isArray(g.modulosIds) && g.modulosIds.includes(modulo.id) && (!CURSO_ACADEMICO || g.cursoAcademico === CURSO_ACADEMICO));
  if (!cands.length) cands = grupos.filter(g => norm(g.nombre).includes(norm(NOMBRE_GRUPO)) && (!CURSO_ACADEMICO || g.cursoAcademico === CURSO_ACADEMICO));
  const mismoCiclo = cands.filter(g => g.cicloId === modulo.cicloId);  // DASP/SM2 lee del grupo activo del ciclo
  if (mismoCiclo.length) cands = mismoCiclo;
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) {
    console.log(`ℹ Varios grupos ${NOMBRE_GRUPO} candidatos: ${cands.map(g => `${g.id}/${g.cursoAcademico}`).join(', ')} (usa --grupo=ID para forzar)`);
    let mejor = null, mejorN = -1;
    for (const g of cands) {
      const aSnap = await db.collection('alumnos').where('grupoId', '==', g.id).get();
      const nMat = aSnap.docs.filter(d => (d.data().matriculas || []).some(m => m.moduloId === modulo.id)).length;
      const score = nMat || aSnap.size; if (score > mejorN) { mejorN = score; mejor = g; }
    }
    return mejor;
  }
  return null;
}

async function main() {
  let serviceAccount;
  try { serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8')); }
  catch { console.error(`\n❌ No se pudo leer la clave en ${SERVICE_ACCOUNT_PATH}\n`); process.exit(1); }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  console.log(`\n🔌 Proyecto: ${serviceAccount.project_id}`);
  console.log(COMMIT ? '✍️  MODO ESCRITURA (--commit).' : '🧪 MODO SIMULACIÓN (dry-run). Usa --commit para guardar.');
  console.log(`🎲 Semilla: ${SEED}  ·  Curso: ${CURSO_ACADEMICO}`);

  // Módulo DASP
  const modulo = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ...d.data() }))
    .find(m => norm(m.abreviatura) === norm(ABREV_MODULO));
  if (!modulo) { console.error(`\n❌ No existe el módulo "${ABREV_MODULO}".`); process.exit(1); }
  console.log(`\n📘 Módulo: ${modulo.abreviatura} — ${modulo.nombre} (id: ${modulo.id})`);

  // Grupo SM2 del curso
  const grupo = await resolverGrupo(db, modulo);
  if (!grupo) { console.error(`\n❌ No existe el grupo "${NOMBRE_GRUPO}" (curso ${CURSO_ACADEMICO}). Usa --grupo=ID.`); process.exit(1); }
  console.log(`👥 Grupo: ${grupo.nombre} (id: ${grupo.id}, curso ${grupo.cursoAcademico})`);

  // Alumnos matriculados en DASP (fallback: todos los del grupo)
  const alumnosSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  let alumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.estado === undefined || a.estado === 'activo');
  const matric = alumnos.filter(a => (a.matriculas || []).some(m => m.moduloId === modulo.id));
  if (matric.length) alumnos = matric;
  else console.log('⚠ Ningún alumno tiene matrícula explícita en DASP; uso todos los del grupo.');
  alumnos = alumnos.sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));
  if (alumnos.length === 0) { console.error(`\n❌ No hay alumnos en ${grupo.nombre}.`); process.exit(1); }
  console.log(`\n🧑‍🎓 ${alumnos.length} alumno(s):`);
  alumnos.forEach(a => console.log(`   - ${a.apellidos}, ${a.nombre}`));

  // Limpieza opcional
  if (LIMPIAR) {
    console.log(`\n🧹 Limpieza de asistencia previa (sept-feb) de ${grupo.nombre}/${modulo.abreviatura}...`);
    const docIds = MESES.map(({ anio, mes }) => `${grupo.id}_${modulo.id}_${anio}-${String(mes + 1).padStart(2, '0')}`);
    for (const id of docIds) {
      if (COMMIT) { await db.collection('asistencia_mensual').doc(id).delete().catch(() => {}); }
      console.log(`   ${COMMIT ? '🗑️' : '➡️ [simulado]'} asistencia_mensual/${id}`);
    }
    const inicio = new Date(MESES[0].anio, MESES[0].mes, 1);
    const fin = new Date(MESES[MESES.length - 1].anio, MESES[MESES.length - 1].mes + 1, 1);
    const asSnap = await db.collection('asistencia').where('grupoId', '==', grupo.id).get();
    let borr = 0;
    for (const d of asSnap.docs) {
      const data = d.data(); const dt = new Date((data.fecha?.seconds || 0) * 1000);
      if (data.moduloId === modulo.id && dt >= inicio && dt < fin) { if (COMMIT) await d.ref.delete(); borr++; }
    }
    console.log(`   ${COMMIT ? '🗑️' : '➡️ [simulado]'} ${borr} registro(s) de 'asistencia' en el rango`);
  }

  // Niveles deterministas (mismo orden/seed que las notas) → faltan más los flojos
  const rng = makeRng(SEED);
  const niveles = asignarNiveles(alumnos.length, rng);
  const nivelDe = {}; alumnos.forEach((a, i) => nivelDe[a.id] = niveles[i]);

  const resumen = {}; alumnos.forEach(a => resumen[a.id] = { lectivos: 0, I: 0, J: 0 });
  const batchOps = [];

  for (const { anio, mes } of MESES) {
    const dias = diasLectivosDelMes(anio, mes);
    const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const faltasMes = {};
    for (const a of alumnos) {
      faltasMes[a.id] = {};
      const pFalta = PFALTA[nivelDe[a.id]], pJustif = PJUSTIF[nivelDe[a.id]];
      for (const dia of dias) {
        resumen[a.id].lectivos++;
        if (rng() < pFalta) {
          const tipo = rng() < pJustif ? 'J' : 'I';
          faltasMes[a.id][dia] = tipo;
          resumen[a.id][tipo]++;
        }
      }
    }

    const docIdMensual = `${grupo.id}_${modulo.id}_${anio}-${String(mes + 1).padStart(2, '0')}`;
    batchOps.push({
      tipo: 'asistencia_mensual',
      ref: db.collection('asistencia_mensual').doc(docIdMensual),
      data: { grupoId: grupo.id, moduloId: modulo.id, anio, mes: mes + 1, faltas: faltasMes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }
    });

    let regsMes = 0;
    for (const dia of dias) {
      for (const franja of FRANJAS_DASP) {
        const registros = alumnos.map(a => {
          const f = faltasMes[a.id][dia];
          let estado = 'presente';
          if (f === 'I') estado = 'ausente_injustificada';
          else if (f === 'J') estado = 'ausente_justificada';
          return { alumnoId: a.id, alumnoNombre: `${a.apellidos}, ${a.nombre}`, estado };
        });
        batchOps.push({
          tipo: 'asistencia',
          ref: db.collection('asistencia').doc(),
          data: {
            fecha: admin.firestore.Timestamp.fromDate(new Date(anio, mes, dia, 8, 30, 0)),
            moduloId: modulo.id, moduloAbreviatura: modulo.abreviatura, grupoId: grupo.id,
            profesorId: modulo.profesorId || 'sin-asignar', franjaHoraria: franja, registros,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });
        regsMes++;
      }
    }
    console.log(`   📅 ${nombreMes}: ${dias.length} días lectivos · ${regsMes} registros de franja`);
  }

  const nMensual = batchOps.filter(o => o.tipo === 'asistencia_mensual').length;
  const nFranja = batchOps.filter(o => o.tipo === 'asistencia').length;
  console.log(`\n📦 A escribir: ${nMensual} documento(s) mensuales + ${nFranja} registro(s) de franja.`);

  if (COMMIT) {
    let i = 0;
    while (i < batchOps.length) {
      const batch = db.batch();
      const trozo = batchOps.slice(i, i + 450);
      for (const op of trozo) batch.set(op.ref, op.data, { merge: true });
      await batch.commit();
      i += trozo.length;
      console.log(`   💾 Lote ${Math.ceil(i / 450)} (${i}/${batchOps.length})`);
    }
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Resumen ${COMMIT ? '(escrito)' : '(simulado)'} — % asistencia por alumno:\n`);
  let enRiesgo = 0, sumaPct = 0;
  for (const a of alumnos) {
    const r = resumen[a.id];
    const presencias = r.lectivos - r.I - r.J;
    const pct = r.lectivos > 0 ? Math.round((presencias / r.lectivos) * 10000) / 100 : 100;
    sumaPct += pct;
    const flag = pct < 85 ? '  ⚠️ EN RIESGO' : '';
    if (pct < 85) enRiesgo++;
    console.log(`   ${(a.apellidos + ', ' + a.nombre).padEnd(30)} ${String(pct).padStart(6)}%  ·  ${r.I + r.J} faltas (I:${r.I} J:${r.J}) [${nivelDe[a.id]}]${flag}`);
  }
  const med = alumnos.length ? Math.round((sumaPct / alumnos.length) * 100) / 100 : 0;
  console.log(`\n   📊 Media de la clase: ${med}%`);
  console.log(`   ⚠️  En riesgo de baja (<85%): ${enRiesgo} de ${alumnos.length}`);

  if (!COMMIT) console.log(`\n👉 Si te cuadra, ejecútalo de nuevo con --commit (y --limpiar si repites).`);
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
