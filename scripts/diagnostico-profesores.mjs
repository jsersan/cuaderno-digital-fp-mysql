#!/usr/bin/env node
/**
 * diagnostico-profesores.mjs  (SOLO LEE)
 * --------------------------------------------------------------------------
 * Lista los profesores (usuarios) con su ID, y los módulos con su profesorId
 * actual. Sirve para mapear "qué profesor da qué módulo".
 *
 * USO:  node scripts/diagnostico-profesores.mjs
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
  console.log('\n=== PROFESORES (usuarios) ===\n');

  // Buscar usuarios; los profesores suelen tener rol profesor/admin/tutor
  const usuarios = [];
  const snap = await db.collection('usuarios').get();
  snap.forEach(d=>{
    const u = d.data();
    usuarios.push({ id:d.id, nombre:`${u.nombre||''} ${u.apellidos||''}`.trim(), email:u.email||'', rol:u.rol||'' });
  });
  console.log(`Total usuarios: ${usuarios.length}\n`);
  usuarios.forEach(u=>console.log(`   ${u.id}  ·  ${u.nombre.padEnd(28)} ${u.rol.padEnd(12)} ${u.email}`));

  console.log('\n=== MÓDULOS y su profesorId actual ===\n');
  const mods = [];
  (await db.collection('modulos').get()).forEach(d=>{
    const m = d.data();
    mods.push({ id:d.id, abrev:m.abreviatura||'?', nombre:m.nombre||'', profesorId:m.profesorId||'', cicloId:m.cicloId||'' });
  });
  mods.forEach(m=>{
    const prof = usuarios.find(u=>u.id===m.profesorId);
    console.log(`   ${m.abrev.padEnd(7)} prof: ${(prof?prof.nombre:m.profesorId||'(sin profesor)').padEnd(28)} (profesorId: ${m.profesorId||'-'})`);
  });

  console.log('\n=== FIN ===\n');
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
