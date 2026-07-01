#!/usr/bin/env node
/**
 * diagnostico-ciclos.mjs  (SOLO LEE)
 * --------------------------------------------------------------------------
 * Muestra el cicloId de cada GRUPO y de cada MÓDULO, para ver qué módulos
 * cruzan con cada grupo (la pantalla de Profesores cruza por cicloId).
 *
 * USO:  node scripts/diagnostico-ciclos.mjs
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function run(){
  initFirebase();

  console.log('\n=== GRUPOS y su cicloId ===\n');
  const grupos = [];
  (await db.collection('grupos').get()).forEach(d=>{
    const g = d.data();
    grupos.push({ id:d.id, nombre:g.nombre||'?', cicloId:g.cicloId||'(sin cicloId)', tutorId:g.tutorId||'(sin tutor)' });
  });
  grupos.forEach(g=>console.log(`   ${(g.nombre||'?').padEnd(8)} cicloId: ${(g.cicloId||'').padEnd(24)} tutorId: ${g.tutorId}  (grupoId:${g.id})`));

  console.log('\n=== MÓDULOS: abreviatura, cicloId, profesorId ===\n');
  const mods = [];
  (await db.collection('modulos').get()).forEach(d=>{
    const m = d.data();
    mods.push({ id:d.id, abrev:m.abreviatura||'?', cicloId:m.cicloId||'(sin cicloId)', profesorId:m.profesorId||'(sin prof)' });
  });
  mods.forEach(m=>console.log(`   ${(m.abrev||'?').padEnd(7)} cicloId: ${(m.cicloId||'').padEnd(24)} profesorId: ${m.profesorId}`));

  console.log('\n=== CRUCE: qué módulos comparten cicloId con cada grupo ===\n');
  for(const g of grupos){
    const match = mods.filter(m=>m.cicloId===g.cicloId).map(m=>m.abrev);
    console.log(`   ${(g.nombre||'?').padEnd(8)} (cicloId ${g.cicloId}) → módulos que cruzan: ${match.length?match.join(', '):'NINGUNO'}`);
  }

  console.log('\n=== FIN ===\n');
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
