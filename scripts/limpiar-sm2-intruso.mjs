#!/usr/bin/env node
/**
 * ============================================================================
 *  LIMPIEZA del SM2 intruso (curso 2025-2026).
 *
 *  Tras la consolidación, un re-seed recreó un grupo "SM2" (hJAhzSZ7...) con
 *  12 alumnos y volvió a colgar ahí DIGA y SOST, duplicando su contenido.
 *  Las versiones BUENAS de DIGA y SOST viven en el 2AW3 (AJdeLl...).
 *
 *  IDs fijados (del diagnóstico):
 *    SM2 INTRUSO (borrar)  : hJAhzSZ7wOessCDo1g9i   (12 alumnos, DIGA+SOST)
 *    2AW3 BUENO (conservar): AJdeLlMHMguP1VwxQ0Nz   (14 alumnos, 5 módulos)
 *    SM2 REAL (no tocar)   : 94Xc7HWat6IQ953lL6Gd   (32 alumnos)
 *
 *  Acciones:
 *    1. Borrar prog/tareas/exámenes con grupoId = SM2 INTRUSO (copias redundantes)
 *    2. Borrar los 12 alumnos con grupoId = SM2 INTRUSO
 *    3. Borrar el grupo SM2 INTRUSO
 *    4. Recalcular modulosIds del 2AW3 BUENO
 *
 *  USO:
 *    node limpiar-sm2-intruso.mjs            # dry-run (no escribe)
 *    node limpiar-sm2-intruso.mjs --apply    # ejecuta
 *
 *  ⚠️  HAZ COPIA DE SEGURIDAD ANTES (sidebar → Copias de seguridad).
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

// ── IDs fijados ──────────────────────────────────────────────────────────────
const SM2_INTRUSO  = 'hJAhzSZ7wOessCDo1g9i';   // borrar (grupo + alumnos + contenido)
const AW3_BUENO    = 'AJdeLlMHMguP1VwxQ0Nz';   // conservar
const SM2_REAL     = '94Xc7HWat6IQ953lL6Gd';   // no tocar (solo verificación)

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

async function borrarPorCampo(coleccion, campo, valor) {
  const snap = await db.collection(coleccion).where(campo, '==', valor).get();
  if (snap.empty) { log(coleccion.toUpperCase(), `0 doc(s) con ${campo}=${String(valor).slice(0,6)}…`); return 0; }
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
  console.log(APPLY ? '🚀  MODO --apply: se BORRARÁN datos en Firestore'
                    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply)');
  console.log(`${'─'.repeat(76)}`);
  console.log('⚠️  Asegúrate de haber hecho COPIA DE SEGURIDAD. Los borrados son irreversibles.\n');

  // Verificación de seguridad: el grupo intruso debe existir y llamarse SM2.
  const gIntruso = await db.collection('grupos').doc(SM2_INTRUSO).get();
  if (!gIntruso.exists) { console.error(`❌ No existe el SM2 intruso (${SM2_INTRUSO}). Quizá ya se limpió. Aborto.`); process.exit(1); }
  if (norm(gIntruso.data().nombre) !== 'SM2') {
    console.error(`❌ El grupo ${SM2_INTRUSO} NO se llama SM2 (es "${gIntruso.data().nombre}"). Aborto por seguridad.`);
    process.exit(1);
  }
  const gBueno = await db.collection('grupos').doc(AW3_BUENO).get();
  if (!gBueno.exists) { console.error(`❌ No existe el 2AW3 bueno (${AW3_BUENO}). Aborto por seguridad.`); process.exit(1); }

  // Aviso: cuántos alumnos hay en el intruso, para que el usuario confirme la cifra (12)
  const alIntrusoSnap = await db.collection('alumnos').where('grupoId', '==', SM2_INTRUSO).get();
  console.log(`   SM2 intruso ${SM2_INTRUSO}: "${gIntruso.data().nombre}" · ${alIntrusoSnap.size} alumno(s) a borrar`);
  console.log(`   2AW3 bueno  ${AW3_BUENO}: "${gBueno.data().nombre}" (se conserva)\n`);
  if (alIntrusoSnap.size > 15) {
    console.error(`⚠️  El SM2 intruso tiene ${alIntrusoSnap.size} alumnos (esperábamos ~12). Demasiados.`);
    console.error(`   Revisa antes de aplicar — posible grupo equivocado. Aborto por seguridad.`);
    process.exit(1);
  }

  // ── FASE 1: borrar contenido redundante de DIGA/SOST en el SM2 intruso ──────
  console.log('── FASE 1: borrar prog/tareas/exámenes que cuelgan del SM2 intruso ──');
  let f1 = 0;
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    f1 += await borrarPorCampo(col, 'grupoId', SM2_INTRUSO);
  }

  // ── FASE 2: borrar los alumnos del SM2 intruso ──────────────────────────────
  console.log('\n── FASE 2: borrar los alumnos del SM2 intruso ──');
  const f2 = await borrarPorCampo('alumnos', 'grupoId', SM2_INTRUSO);

  // ── FASE 3: borrar el grupo SM2 intruso ─────────────────────────────────────
  console.log('\n── FASE 3: borrar el grupo SM2 intruso ──');
  log('GRUPO', `borrar SM2 intruso ${SM2_INTRUSO}`);
  if (APPLY) await db.collection('grupos').doc(SM2_INTRUSO).delete();

  // ── FASE 4: recalcular modulosIds del 2AW3 bueno ────────────────────────────
  console.log('\n── FASE 4: recalcular modulosIds del 2AW3 bueno ──');
  if (APPLY) {
    const mods = new Set();
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      const s = await db.collection(col).where('grupoId', '==', AW3_BUENO).get();
      s.docs.forEach(d => { const mid = d.data().moduloId; if (mid) mods.add(mid); });
    }
    await db.collection('grupos').doc(AW3_BUENO).update({ modulosIds: [...mods], updatedAt: Timestamp.now() });
    log('GRUPO', `2AW3 modulosIds = [${[...mods].length} módulo(s)]`);
  } else {
    log('FASE4', 'se recalcularán los modulosIds del 2AW3 bueno');
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(76)}`);
  console.log('  RESUMEN');
  console.log('═'.repeat(76));
  console.log(`  F1 · prog/tareas/exámenes del SM2 intruso borrados: ${f1}`);
  console.log(`  F2 · alumnos del SM2 intruso borrados:              ${f2}`);
  console.log(`  F3 · grupo SM2 intruso:                             ${APPLY ? 'BORRADO' : 'se borraría'}`);
  console.log(`  F4 · modulosIds del 2AW3:                           ${APPLY ? 'recalculado' : 'se recalcularía'}`);
  console.log('═'.repeat(76));
  console.log('\n  Estado final esperado (2025-2026):');
  console.log('    • SM2  (94Xc7H)  → intacto, 32 alumnos');
  console.log('    • 2AW3 (AJdeLl)  → DIGA + SOST solo aquí, 14 alumnos');
  console.log('    • (sin SM2 intruso, sin duplicados)');
  console.log('═'.repeat(76) + '\n');

  if (APPLY) console.log('✅  Hecho. Recarga la app (Ctrl+Shift+R).\n');
  else console.log('ℹ️   Revisa el plan y, si te cuadra, ejecuta con --apply.\n    node limpiar-sm2-intruso.mjs --apply\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
