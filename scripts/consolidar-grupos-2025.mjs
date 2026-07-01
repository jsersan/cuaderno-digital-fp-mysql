#!/usr/bin/env node
/**
 * ============================================================================
 *  CONSOLIDACIÓN de grupos duplicados (curso 2025-2026).
 *
 *  Plan (IDs fijados tras diagnóstico, todos de 2025-2026):
 *    SM2  conservar  : 94Xc7HWat6IQ953lL6Gd   (19+ activos, ciclo z8q1CE)
 *    SM2  borrar      : n2kXojmDJfJP8ug8opJo   (12 baja, tiene DIGA+SOST)
 *    2AW3 conservar  : AJdeLlMHMguP1VwxQ0Nz   (14 activos, DIGA+SOST)
 *    2AW3 borrar      : PbE3zl5zOGNrH0fDHJV7   (vacío, módulo DIG)
 *    DAW1 borrar      : unD1pmyWstEoWI6XCbzi   (10 activos → se borran)
 *
 *  Acciones:
 *    1. DIGA+SOST (prog/tareas/exámenes con grupoId=SM2_BORRAR) → 2AW3_CONSERVAR
 *    2. Alumnos de SM2_BORRAR → SM2_CONSERVAR
 *    3. Borrar grupo SM2_BORRAR
 *    4. Módulo DIG (+ su prog/tareas/exámenes) → BORRAR
 *    5. Borrar grupo 2AW3_BORRAR
 *    6. Borrar alumnos de DAW1 y el grupo DAW1
 *    7. Sanear modulosIds/alumnosIds de los grupos que se conservan
 *
 *  USO:
 *    node consolidar-grupos-2025.mjs            # dry-run (no escribe)
 *    node consolidar-grupos-2025.mjs --apply    # ejecuta
 *
 *  ⚠️  HAZ UNA COPIA DE SEGURIDAD ANTES (sidebar → Copias de seguridad).
 *      Los borrados son IRREVERSIBLES.
 * ============================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// ── IDs fijados (del diagnóstico) ────────────────────────────────────────────
const SM2_CONSERVAR  = '94Xc7HWat6IQ953lL6Gd';
const SM2_BORRAR     = 'n2kXojmDJfJP8ug8opJo';
const AW3_CONSERVAR  = 'AJdeLlMHMguP1VwxQ0Nz';
const AW3_BORRAR     = 'PbE3zl5zOGNrH0fDHJV7';
const DAW1_BORRAR    = 'unD1pmyWstEoWI6XCbzi';

const ABREVS_MOVER = ['DIGA', 'SOST'];  // módulos a reanclar al 2AW3 conservado
const ABREV_DIG    = 'DIG';             // módulo a eliminar

const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── Firebase ─────────────────────────────────────────────────────────────────
let serviceAccount;
for (const p of [resolve(__dirname, 'serviceAccount.json'), resolve(__dirname, 'scripts', 'serviceAccount.json')]) {
  try { serviceAccount = JSON.parse(readFileSync(p, 'utf-8')); break; } catch {}
}
if (!serviceAccount) { console.error('❌ No se encontró serviceAccount.json'); process.exit(1); }
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const log = (tag, msg) => console.log(`${APPLY ? '✅' : '🔍'} [${tag}] ${msg}`);

// Reasignar grupoId en una colección, filtrando por grupo origen (y opcional módulo)
async function reasignarPorGrupo(coleccion, origenId, destinoId, moduloId = null) {
  let q = db.collection(coleccion).where('grupoId', '==', origenId);
  if (moduloId) q = q.where('moduloId', '==', moduloId);
  const snap = await q.get();
  if (snap.empty) return 0;
  log(coleccion.toUpperCase(), `${snap.size} doc(s) grupoId ${origenId.slice(0,6)}… → ${destinoId.slice(0,6)}…`);
  if (APPLY) {
    let i = 0;
    while (i < snap.docs.length) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 450)) batch.update(d.ref, { grupoId: destinoId, updatedAt: Timestamp.now() });
      await batch.commit(); i += 450;
    }
  }
  return snap.size;
}

// Borrar documentos de una colección por campo
async function borrarPorCampo(coleccion, campo, valor) {
  const snap = await db.collection(coleccion).where(campo, '==', valor).get();
  if (snap.empty) return 0;
  log(coleccion.toUpperCase(), `borrar ${snap.size} doc(s) con ${campo}=${String(valor).slice(0,6)}…`);
  if (APPLY) {
    let i = 0;
    while (i < snap.docs.length) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 450)) batch.delete(d.ref);
      await batch.commit(); i += 450;
    }
  }
  return snap.size;
}

async function main() {
  console.log(`\n${'─'.repeat(76)}`);
  console.log(APPLY ? '🚀  MODO --apply: se ESCRIBIRÁN y BORRARÁN datos en Firestore'
                    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply)');
  console.log(`${'─'.repeat(76)}`);
  console.log('⚠️  Asegúrate de haber hecho COPIA DE SEGURIDAD. Los borrados son irreversibles.\n');

  // Verificar que los grupos existen y son los esperados
  const gruposSnap = await db.collection('grupos').get();
  const grupos = Object.fromEntries(gruposSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  for (const [id, etq] of [[SM2_CONSERVAR,'SM2 conservar'],[SM2_BORRAR,'SM2 borrar'],[AW3_CONSERVAR,'2AW3 conservar'],[AW3_BORRAR,'2AW3 borrar'],[DAW1_BORRAR,'DAW1 borrar']]) {
    const g = grupos[id];
    if (!g) { console.error(`❌ No existe el grupo ${etq} (${id}). Aborto por seguridad.`); process.exit(1); }
    console.log(`   ${etq.padEnd(16)} "${g.nombre}" ${id}  · ${g.cursoAcademico}`);
  }
  console.log('');

  const modsSnap = await db.collection('modulos').get();
  const modulos = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ── FASE 1: DIGA + SOST de SM2_BORRAR → 2AW3_CONSERVAR ──────────────────────
  console.log('── FASE 1: reanclar DIGA + SOST (prog/tareas/exámenes) al 2AW3 conservado ──');
  const modsMover = modulos.filter(m => ABREVS_MOVER.includes(norm(m.abreviatura)));
  let f1 = 0;
  for (const m of modsMover) {
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      f1 += await reasignarPorGrupo(col, SM2_BORRAR, AW3_CONSERVAR, m.id);
    }
  }
  if (f1 === 0) log('FASE1', 'nada que mover (puede que ya estuviera todo en 2AW3)');

  // ── FASE 2: alumnos de SM2_BORRAR → SM2_CONSERVAR ───────────────────────────
  console.log('\n── FASE 2: mover alumnos de SM2(borrar) → SM2(conservar) ──');
  const f2 = await reasignarPorGrupo('alumnos', SM2_BORRAR, SM2_CONSERVAR);
  if (f2 === 0) log('FASE2', 'sin alumnos que mover');

  // ── FASE 3: borrar grupo SM2_BORRAR ─────────────────────────────────────────
  console.log('\n── FASE 3: borrar grupo SM2(borrar) ──');
  log('GRUPO', `borrar SM2 ${SM2_BORRAR}`);
  if (APPLY) await db.collection('grupos').doc(SM2_BORRAR).delete();

  // ── FASE 4: borrar módulo DIG + su contenido ────────────────────────────────
  console.log('\n── FASE 4: borrar módulo DIG y su contenido ──');
  const dig = modulos.find(m => norm(m.abreviatura) === norm(ABREV_DIG));
  let f4 = 0;
  if (dig) {
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      f4 += await borrarPorCampo(col, 'moduloId', dig.id);
    }
    log('MODULO', `borrar DIG ${dig.id}`);
    if (APPLY) await db.collection('modulos').doc(dig.id).delete();
  } else {
    log('FASE4', 'no se encontró módulo DIG (quizá ya borrado)');
  }

  // ── FASE 5: borrar grupo 2AW3_BORRAR ────────────────────────────────────────
  console.log('\n── FASE 5: borrar grupo 2AW3(vacío) ──');
  log('GRUPO', `borrar 2AW3 ${AW3_BORRAR}`);
  if (APPLY) await db.collection('grupos').doc(AW3_BORRAR).delete();

  // ── FASE 6: borrar alumnos de DAW1 + grupo DAW1 ─────────────────────────────
  console.log('\n── FASE 6: borrar alumnos de DAW1 y el grupo DAW1 ──');
  const f6 = await borrarPorCampo('alumnos', 'grupoId', DAW1_BORRAR);
  log('GRUPO', `borrar DAW1 ${DAW1_BORRAR}`);
  if (APPLY) await db.collection('grupos').doc(DAW1_BORRAR).delete();

  // ── FASE 7: sanear modulosIds / alumnosIds de los grupos conservados ────────
  console.log('\n── FASE 7: sanear arrays de los grupos conservados ──');
  if (APPLY) {
    // Recalcular modulosIds del 2AW3 conservado a partir de tareas/eventos (módulos que apuntan a él)
    const mods2aw3 = new Set();
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      const s = await db.collection(col).where('grupoId', '==', AW3_CONSERVAR).get();
      s.docs.forEach(d => { const mid = d.data().moduloId; if (mid) mods2aw3.add(mid); });
    }
    await db.collection('grupos').doc(AW3_CONSERVAR).update({ modulosIds: [...mods2aw3], updatedAt: Timestamp.now() });
    log('GRUPO', `2AW3 modulosIds = [${[...mods2aw3].length} módulo(s)]`);
  } else {
    log('FASE7', 'se recalcularán modulosIds del 2AW3 conservado');
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(76)}`);
  console.log('  RESUMEN');
  console.log('═'.repeat(76));
  console.log(`  F1 · docs DIGA/SOST reanclados a 2AW3: ${f1}`);
  console.log(`  F2 · alumnos movidos SM2→SM2:          ${f2}`);
  console.log(`  F3 · grupo SM2(borrar):                ${APPLY ? 'BORRADO' : 'se borraría'}`);
  console.log(`  F4 · módulo DIG + contenido:           ${f4} docs ${dig ? '+ módulo' : ''}`);
  console.log(`  F5 · grupo 2AW3(vacío):                ${APPLY ? 'BORRADO' : 'se borraría'}`);
  console.log(`  F6 · alumnos DAW1 borrados:            ${f6}  + grupo DAW1`);
  console.log('═'.repeat(76));
  console.log('\n  Estado final esperado (2025-2026):');
  console.log('    • SM2  (94Xc7H)  → SM2 real con todos sus alumnos');
  console.log('    • 2AW3 (AJdeLl)  → con DIGA + SOST');
  console.log('    • (sin DAW1, sin duplicados, sin DIG)');
  console.log('═'.repeat(76) + '\n');

  if (APPLY) console.log('✅  Hecho. Recarga la app (Ctrl+Shift+R).\n');
  else console.log('ℹ️   Revisa el plan y, si te cuadra, ejecuta con --apply.\n    node consolidar-grupos-2025.mjs --apply\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
