#!/usr/bin/env node
/**
 * ============================================================================
 *  Corrige la abreviatura del módulo "Desarrollo Web en Entorno Cliente"
 *  de  DEWC  ->  DWEC  (abreviatura oficial, código 0613)
 * ============================================================================
 *
 *  Por qué: la propuesta de horario y la nomenclatura del resto de módulos
 *  usan DWEC. Tu módulo se creó como DEWC, así que lo unificamos.
 *
 *  REQUISITOS (los mismos que el script de creación):
 *    - npm install firebase-admin
 *    - scripts/serviceAccount.json  con tu clave de servicio
 *
 *  USO:
 *    node scripts/corregir-abreviatura-dwec.mjs            (simulación)
 *    node scripts/corregir-abreviatura-dwec.mjs --commit   (escribe)
 * ============================================================================
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = join(__dirname, 'serviceAccount.json');

const ABREV_VIEJA = 'DEWC';
const ABREV_NUEVA = 'DWEC';

const COMMIT = process.argv.includes('--commit');
const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function main() {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch {
    console.error(`\n❌ No se pudo leer la clave en ${SERVICE_ACCOUNT_PATH}\n`);
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  console.log(`\n🔌 Conectado al proyecto: ${serviceAccount.project_id}`);
  console.log(COMMIT ? '✍️  MODO ESCRITURA (--commit).' : '🧪 MODO SIMULACIÓN (dry-run). Usa --commit para guardar.');

  // Buscar el/los módulo(s) con la abreviatura vieja
  const snap = await db.collection('modulos').get();
  const objetivos = snap.docs.filter(d => norm(d.data().abreviatura) === norm(ABREV_VIEJA));

  if (objetivos.length === 0) {
    console.log(`\n✓ No hay ningún módulo con abreviatura "${ABREV_VIEJA}". Quizá ya está corregido.`);
    process.exit(0);
  }

  console.log(`\n🔎 Encontrado(s) ${objetivos.length} módulo(s) con "${ABREV_VIEJA}":`);
  for (const d of objetivos) {
    const m = d.data();
    console.log(`   - ${m.nombre} (id: ${d.id})`);
    if (COMMIT) {
      await d.ref.update({
        abreviatura: ABREV_NUEVA,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`     ✅ Abreviatura cambiada a "${ABREV_NUEVA}"`);
    } else {
      console.log(`     ➡️  [simulado] Cambiaría "${ABREV_VIEJA}" → "${ABREV_NUEVA}"`);
    }
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Resumen: ${objetivos.length} ${COMMIT ? 'corregido(s)' : 'a corregir'}.`);
  if (!COMMIT) console.log(`\n👉 Si es correcto, ejecútalo de nuevo con --commit.`);
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
