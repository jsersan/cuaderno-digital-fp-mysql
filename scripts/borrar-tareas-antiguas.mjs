#!/usr/bin/env node
/**
 * borrar-tareas-antiguas.mjs
 * --------------------------------------------------------------------------
 * Borra de la colección "tareas" las dos tareas de prueba antiguas:
 *   - "Practica 1- Algoritmos Básicos"
 *   - "Práctica 1"
 * (las creadas a mano, con descripción "Tarea básica" / "Algoritmos").
 *
 * También borra sus eventos de programación asociados (tipo actividad) si los
 * hubiera, buscándolos por el mismo título.
 *
 * USO:
 *   node scripts/borrar-tareas-antiguas.mjs              # simulación
 *   node scripts/borrar-tareas-antiguas.mjs --commit     # borra de verdad
 * --------------------------------------------------------------------------
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// Títulos exactos a eliminar
const TITULOS_BORRAR = [
  'Practica 1- Algoritmos Básicos',
  'Práctica 1',
];

let db;
function initFirebase() {
  const saPath = join(__dirname, 'serviceAccount.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
  } catch (e) {
    console.error(`\n❌ No se encontró ${saPath}\n`);
    process.exit(1);
  }
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
}

async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BORRAR TAREAS ANTIGUAS`);
  console.log(`  Modo: ${COMMIT ? 'COMMIT (borra)' : 'DRY-RUN (simulación)'}`);
  console.log(`${'='.repeat(60)}\n`);

  initFirebase();

  // Buscar en "tareas" y "eventos_programacion" por título exacto
  const colecciones = ['tareas', 'eventos_programacion'];
  let totalEncontrados = 0;
  const aBorrar = [];

  for (const col of colecciones) {
    const snap = await db.collection(col).get();
    snap.forEach(d => {
      const data = d.data();
      if (TITULOS_BORRAR.includes(data.titulo)) {
        aBorrar.push({ col, id: d.id, titulo: data.titulo, ref: d.ref });
        totalEncontrados++;
      }
    });
  }

  if (totalEncontrados === 0) {
    console.log('No se encontró ninguna tarea con esos títulos. Nada que borrar.\n');
    return;
  }

  console.log('Documentos que se borrarán:');
  for (const x of aBorrar) {
    console.log(`   · [${x.col}] "${x.titulo}" (id: ${x.id})`);
  }
  console.log('');

  if (!COMMIT) {
    console.log('🔍 DRY-RUN: no se ha borrado nada. Ejecuta con --commit para borrar.\n');
    return;
  }

  const batch = db.batch();
  for (const x of aBorrar) batch.delete(x.ref);
  await batch.commit();
  console.log(`✅ Borrados ${aBorrar.length} documentos.\n`);
}

run().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
