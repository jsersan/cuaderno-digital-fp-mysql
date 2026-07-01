#!/usr/bin/env node
/**
 * renombrar-grupo-daw2.mjs
 * Renombra el grupo "DAW2" a "2AW3" (cambia el campo nombre del grupo).
 * Tras esto, el badge del dashboard, la cabecera y el pie del PDF mostrarán "2AW3".
 *
 * USO:
 *   node scripts/renombrar-grupo-daw2.mjs            # DRY-RUN
 *   node scripts/renombrar-grupo-daw2.mjs --commit    # RENOMBRA
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const norm = s => (s || '').toLowerCase().trim();

const NOMBRE_VIEJO = 'DAW2';
const NOMBRE_NUEVO = '2AW3';

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RENOMBRAR GRUPO "${NOMBRE_VIEJO}" → "${NOMBRE_NUEVO}"`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT' : '🔍 DRY-RUN'}`);
  console.log(`${'═'.repeat(60)}\n`);

  const snap = await db.collection('grupos').get();
  const objetivo = [];
  snap.forEach(d => {
    if (norm(d.data().nombre) === norm(NOMBRE_VIEJO)) objetivo.push({ id: d.id, ...d.data() });
  });

  if (objetivo.length === 0) {
    console.log(`No se encontró ningún grupo llamado "${NOMBRE_VIEJO}".`);
    return;
  }

  for (const g of objetivo) {
    console.log(`   ${g.id}  ·  curso ${g.cursoAcademico || '(sin)'}  ·  "${g.nombre}" → "${NOMBRE_NUEVO}"`);
    if (COMMIT) {
      await db.collection('grupos').doc(g.id).update({ nombre: NOMBRE_NUEVO, updatedAt: Timestamp.now() });
    }
  }

  console.log(`\n${COMMIT ? `✅ ${objetivo.length} grupo(s) renombrado(s).` : `🔍 DRY-RUN: ${objetivo.length} grupo(s) se renombrarían.`}`);
  console.log('   El pie del PDF mostrará automáticamente "DWEC (2AW3)".\n');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
