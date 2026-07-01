#!/usr/bin/env node
/**
 * ============================================================================
 *  BORRADO de los 3 grupos SM2 sobrantes.
 *
 *  IDs fijados (del diagnóstico actual):
 *    BORRAR  LLHwsOI0T8YREuISsya5  SM2 · 2026-2027 · 0 alumnos  (vacío)
 *    BORRAR  oXgLrzv8yzmdPvxI0BUh  SM2 · 2025-2026 · 0 alumnos  (vacío)
 *    BORRAR  A6MuqAUOUrpbDy0WGLli  SM2 · 2026-2027 · 20 alumnos (+ sus alumnos)
 *
 *    CONSERVAR 94Xc7HWat6IQ953lL6Gd  SM2 · 2025-2026 · 32 alumnos (el bueno)
 *    CONSERVAR los 2AW3 (no se tocan)
 *
 *  Acciones por cada grupo a borrar:
 *    1. Borrar sus alumnos (grupoId = id)
 *    2. Borrar su prog/tareas/exámenes por si hubiera (grupoId = id)
 *    3. Borrar el grupo
 *
 *  USO:
 *    node borrar-sm2-sobrantes.mjs            # dry-run (no escribe)
 *    node borrar-sm2-sobrantes.mjs --apply    # ejecuta
 *
 *  ⚠️  HAZ COPIA DE SEGURIDAD ANTES. Los borrados son IRREVERSIBLES.
 * ============================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// ── Grupos a borrar (id → nº alumnos esperado, para verificación) ────────────
const A_BORRAR = [
  { id: 'LLHwsOI0T8YREuISsya5', curso: '2026-2027', maxAlumnos: 0 },
  { id: 'oXgLrzv8yzmdPvxI0BUh', curso: '2025-2026', maxAlumnos: 0 },
  { id: 'A6MuqAUOUrpbDy0WGLli', curso: '2026-2027', maxAlumnos: 25 } // ~20 reales, margen
];

// Grupos que NUNCA deben tocarse (salvaguarda)
const PROTEGIDOS = ['94Xc7HWat6IQ953lL6Gd', 'AJdeLlMHMguP1VwxQ0Nz', 'JO4shgROeGSZmqFM1Ban'];

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
  if (snap.empty) { return 0; }
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

  // Salvaguarda: ningún protegido en la lista de borrado
  for (const g of A_BORRAR) {
    if (PROTEGIDOS.includes(g.id)) {
      console.error(`❌ El id ${g.id} está en la lista de borrado Y en protegidos. Aborto.`);
      process.exit(1);
    }
  }

  let totalAlumnos = 0, totalContenido = 0, gruposBorrados = 0;

  for (const objetivo of A_BORRAR) {
    const ref = db.collection('grupos').doc(objetivo.id);
    const doc = await ref.get();
    if (!doc.exists) { log('GRUPO', `${objetivo.id} ya no existe — se omite`); continue; }

    const g = doc.data();
    console.log(`\n── Grupo "${g.nombre}" (${objetivo.id}) · ${g.cursoAcademico} ──`);

    // Verificación 1: debe llamarse SM2
    if (norm(g.nombre) !== 'SM2') {
      console.error(`   ❌ NO se llama SM2 (es "${g.nombre}"). Se OMITE por seguridad.`);
      continue;
    }
    // Verificación 2: nº de alumnos dentro del margen esperado
    const alSnap = await db.collection('alumnos').where('grupoId', '==', objetivo.id).get();
    if (alSnap.size > objetivo.maxAlumnos) {
      console.error(`   ❌ Tiene ${alSnap.size} alumnos (esperado ≤ ${objetivo.maxAlumnos}). Se OMITE por seguridad.`);
      continue;
    }
    log('GRUPO', `verificado: SM2 con ${alSnap.size} alumno(s)`);

    // 1) Borrar alumnos
    totalAlumnos += await borrarPorCampo('alumnos', 'grupoId', objetivo.id);
    // 2) Borrar contenido por si lo hubiera
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      totalContenido += await borrarPorCampo(col, 'grupoId', objetivo.id);
    }
    // 3) Borrar el grupo
    log('GRUPO', `borrar grupo ${objetivo.id}`);
    if (APPLY) await ref.delete();
    gruposBorrados++;
  }

  console.log(`\n${'═'.repeat(76)}`);
  console.log('  RESUMEN');
  console.log('═'.repeat(76));
  console.log(`  Grupos SM2 ${APPLY ? 'borrados' : 'a borrar'}:  ${gruposBorrados} de ${A_BORRAR.length}`);
  console.log(`  Alumnos ${APPLY ? 'borrados' : 'a borrar'}:      ${totalAlumnos}`);
  console.log(`  Contenido ${APPLY ? 'borrado' : 'a borrar'}:     ${totalContenido}`);
  console.log('─'.repeat(76));
  console.log('  Se conservan: SM2 94Xc7H (32 al.), 2AW3 AJdeLl (14 al.), 2AW3 JO4shg (12 al.)');
  console.log('═'.repeat(76) + '\n');

  if (APPLY) console.log('✅  Hecho. Recarga la app (Ctrl+Shift+R).\n');
  else console.log('ℹ️   Revisa el plan y, si te cuadra, ejecuta con --apply.\n    node borrar-sm2-sobrantes.mjs --apply\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
