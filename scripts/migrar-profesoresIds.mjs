#!/usr/bin/env node
/**
 * migrar-profesoresIds.mjs
 *
 * Migra la colección 'modulos' del campo singular profesorId
 * al nuevo campo profesoresIds (array) para soportar co-docencia.
 *
 * Para cada módulo que tenga profesorId pero no profesoresIds,
 * crea profesoresIds: [profesorId].
 *
 * Uso:
 *   node migrar-profesoresIds.mjs                  # dry-run
 *   node migrar-profesoresIds.mjs --apply           # ejecuta
 *
 * Requiere:
 *   npm install firebase-admin
 *   El fichero firebase-key.json en el mismo directorio.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const APPLY = process.argv.includes('--apply');

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = join(__dirname, 'firebase-key.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
} catch {
  console.error(`❌ No se encontró ${KEY_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Migrar profesorId → profesoresIds`);
  console.log(`  Modo: ${APPLY ? '🟢 APLICAR' : '🔵 DRY-RUN (usa --apply para ejecutar)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  const snap = await db.collection('modulos').get();
  console.log(`📘 Módulos totales: ${snap.size}\n`);

  let yaOk = 0, migrar = 0, sinProf = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const ab = data.abreviatura || d.id;

    // Ya tiene profesoresIds con contenido → no tocar
    if (data.profesoresIds && data.profesoresIds.length > 0) {
      console.log(`   ✅ ${ab.padEnd(8)} profesoresIds ya existe: [${data.profesoresIds.join(', ')}]`);
      yaOk++;
      continue;
    }

    // Tiene profesorId → migrar
    if (data.profesorId) {
      console.log(`   🔄 ${ab.padEnd(8)} profesorId: ${data.profesorId} → profesoresIds: [${data.profesorId}]`);
      migrar++;
      if (APPLY) {
        await db.collection('modulos').doc(d.id).update({
          profesoresIds: [data.profesorId],
          updatedAt: new Date()
        });
      }
      continue;
    }

    // Sin profesor asignado
    console.log(`   ⚪ ${ab.padEnd(8)} sin profesorId — se omite`);
    sinProf++;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Resumen:`);
  console.log(`    ${yaOk} ya tenían profesoresIds`);
  console.log(`    ${migrar} migrados (profesorId → profesoresIds)`);
  console.log(`    ${sinProf} sin profesor asignado`);
  console.log(`${'─'.repeat(60)}`);

  if (!APPLY) {
    console.log(`\n🔵 DRY-RUN. Nada modificado. Ejecuta con --apply.\n`);
  } else {
    console.log(`\n🟢 Migración completada.\n`);
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message || err);
  process.exit(1);
});
