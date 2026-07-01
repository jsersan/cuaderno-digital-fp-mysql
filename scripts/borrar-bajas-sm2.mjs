#!/usr/bin/env node
/**
 * ============================================================================
 *  BORRA los alumnos en estado "baja" del grupo SM2 bueno (datos de prueba).
 *
 *  Grupo objetivo (fijado del diagnóstico):
 *    SM2 bueno: 94Xc7HWat6IQ953lL6Gd  (2025-2026, 32 alumnos)
 *
 *  Borra SOLO los alumnos cuyo estado sea "baja" (no toca los "activo").
 *  Muestra la lista nominal en dry-run para que confirmes antes de aplicar.
 *
 *  USO:
 *    node borrar-bajas-sm2.mjs            # dry-run (no escribe)
 *    node borrar-bajas-sm2.mjs --apply    # ejecuta
 *
 *  OPCIONES:
 *    --grupo=ID   Otro grupo (por defecto el SM2 bueno).
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
const argVal = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };

const GRUPO_ID = argVal('grupo', '94Xc7HWat6IQ953lL6Gd');  // SM2 bueno

const norm = s => (s || '').toLowerCase().trim();

// ── Firebase ─────────────────────────────────────────────────────────────────
let serviceAccount;
for (const p of [resolve(__dirname, 'serviceAccount.json'), resolve(__dirname, 'scripts', 'serviceAccount.json')]) {
  try { serviceAccount = JSON.parse(readFileSync(p, 'utf-8')); break; } catch {}
}
if (!serviceAccount) { console.error('❌ No se encontró serviceAccount.json'); process.exit(1); }
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const log = (tag, msg) => console.log(`${APPLY ? '✅' : '🔍'} [${tag}] ${msg}`);

async function main() {
  console.log(`\n${'─'.repeat(76)}`);
  console.log(APPLY ? '🚀  MODO --apply: se BORRARÁN alumnos en Firestore'
                    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply)');
  console.log(`${'─'.repeat(76)}`);
  console.log('⚠️  Asegúrate de haber hecho COPIA DE SEGURIDAD. Los borrados son irreversibles.\n');

  // Verificar grupo
  const gDoc = await db.collection('grupos').doc(GRUPO_ID).get();
  if (!gDoc.exists) { console.error(`❌ No existe el grupo ${GRUPO_ID}. Aborto.`); process.exit(1); }
  const g = gDoc.data();
  console.log(`   Grupo: "${g.nombre}" (${GRUPO_ID}) · ${g.cursoAcademico}\n`);

  // Alumnos del grupo
  const snap = await db.collection('alumnos').where('grupoId', '==', GRUPO_ID).get();
  const todos = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

  // Filtrar los que están en baja (tolerante: 'baja', distinto de 'activo')
  const bajas = todos.filter(a => norm(a.estado) === 'baja');
  const activos = todos.filter(a => norm(a.estado) !== 'baja');

  console.log(`   Total en el grupo: ${todos.length}  ·  Activos (se conservan): ${activos.length}  ·  Baja (a borrar): ${bajas.length}\n`);

  if (bajas.length === 0) {
    console.log('✅  No hay alumnos en baja. Nada que borrar.\n');
    process.exit(0);
  }

  console.log('── Alumnos en BAJA que se borrarán ──');
  bajas
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''))
    .forEach((a, i) => console.log(`   ${String(i + 1).padStart(2)}. ${a.apellidos}, ${a.nombre}  ·  ${a.email || ''}`));

  // Salvaguarda: si por error hubiera muchísimos, parar
  if (bajas.length > activos.length + bajas.length) { /* imposible, placeholder */ }

  if (APPLY) {
    let i = 0;
    while (i < bajas.length) {
      const batch = db.batch();
      for (const a of bajas.slice(i, i + 450)) batch.delete(a.ref);
      await batch.commit();
      i += 450;
    }
    console.log(`\n✅  ${bajas.length} alumno(s) en baja borrado(s). Recarga la app (Ctrl+Shift+R).\n`);
  } else {
    console.log(`\nℹ️   Revisa la lista. Si son los correctos, ejecuta con --apply:`);
    console.log(`    node borrar-bajas-sm2.mjs --apply\n`);
  }
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
