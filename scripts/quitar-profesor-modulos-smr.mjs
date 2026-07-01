#!/usr/bin/env node
/**
 * quitar-profesor-modulos-smr.mjs
 * --------------------------------------------------------------------------
 * Quita el profesorId a los módulos SMR auxiliares (SEGI, SERED, SGBD, EIE, HLC)
 * para que NO aparezcan como cuadernos en el dashboard del profesor.
 *
 * NO toca APIN ni DWEC (esos sí son del profesor).
 * Los módulos siguen existiendo y seguirán saliendo en el HORARIO porque ahí
 * se filtran por cicloId, no por profesorId.
 *
 * USO:
 *   node scripts/quitar-profesor-modulos-smr.mjs            # DRY-RUN
 *   node scripts/quitar-profesor-modulos-smr.mjs --commit   # escribe
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// Módulos a los que se les quita el profesorId (auxiliares de SMR)
const ABREVS = ['SERED','SEGI','SGBD','EIE','HLC'];
// Estos NO se tocan nunca (son del profesor)
const PROTEGIDOS = ['APIN','DWEC'];

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}
const norm = s => (s||'').toString().trim().toLowerCase();

async function run(){
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  QUITAR profesorId a módulos SMR auxiliares`);
  console.log(`  Modo: ${COMMIT?'COMMIT (escribe)':'DRY-RUN (no escribe)'}`);
  console.log(`${'='.repeat(56)}\n`);
  initFirebase();

  const snap = await db.collection('modulos').get();
  const objetivo = [];
  snap.forEach(d=>{
    const m = d.data();
    const ab = (m.abreviatura||'').toUpperCase();
    if (PROTEGIDOS.includes(ab)) return; // nunca tocar APIN/DWEC
    if (ABREVS.map(x=>x.toUpperCase()).includes(ab)) {
      objetivo.push({ id:d.id, ref:d.ref, abrev:ab, profesorId:m.profesorId||'' });
    }
  });

  if(!objetivo.length){ console.log('No se encontró ninguno de:', ABREVS.join(', '), '\n'); return; }

  console.log('Módulos a actualizar (profesorId → ""):');
  for(const o of objetivo) console.log(`   ${o.abrev.padEnd(7)} (id:${o.id})  profesorId actual: ${o.profesorId||'(vacío)'}`);
  console.log('');

  if(!COMMIT){
    console.log('🔍 DRY-RUN: no se ha escrito nada. Ejecuta con --commit para aplicar.\n');
    return;
  }

  const batch = db.batch();
  for(const o of objetivo) batch.update(o.ref, { profesorId:'', updatedAt:Timestamp.now() });
  await batch.commit();
  console.log(`✅ Actualizados ${objetivo.length} módulos. Recarga el dashboard: solo verás APIN y DWEC.\n`);
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
