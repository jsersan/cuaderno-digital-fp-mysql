#!/usr/bin/env node
/**
 * diagnostico-centros.mjs  (SOLO LEE)
 * --------------------------------------------------------------------------
 * Muestra el centroId de cada usuario. La pantalla de Profesores filtra por
 * where('centroId','==',tuCentroId), así que un profesor con centroId
 * distinto (o vacío) NO aparece, aunque imparta módulos.
 *
 * USO:  node scripts/diagnostico-centros.mjs
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JOSE_MARIA = '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function run(){
  initFirebase();

  // centroId de referencia: el de Jose María
  const me = await db.collection('usuarios').doc(JOSE_MARIA).get();
  const miCentro = me.exists ? (me.data().centroId || '(sin centroId)') : '(no encontrado)';
  console.log(`\n=== centroId de referencia (Jose María): ${miCentro} ===\n`);

  console.log('=== USUARIOS: centroId vs referencia ===\n');
  const snap = await db.collection('usuarios').get();
  snap.forEach(d=>{
    const u = d.data();
    const c = u.centroId || '(sin centroId)';
    const ok = c === miCentro ? '✓ coincide' : '✗ DISTINTO';
    const nombre = `${u.nombre||''} ${u.apellidos||''}`.trim();
    console.log(`   ${ok}  ${nombre.padEnd(28)} centroId: ${c}  (uid:${d.id})`);
  });

  console.log('\n=== FIN ===\n');
  console.log('Los marcados ✗ DISTINTO no aparecen en la pantalla de Profesores.\n');
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
