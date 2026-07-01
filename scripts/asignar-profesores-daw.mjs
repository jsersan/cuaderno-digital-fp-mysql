#!/usr/bin/env node
/**
 * asignar-profesores-daw.mjs
 * --------------------------------------------------------------------------
 * Asigna profesores existentes a los módulos del ciclo DAW que están
 * "sin-asignar". DWEC ya es de Jose María (no se toca salvo PROY).
 *
 * Reparto (criterio por afinidad, profesores ya existentes):
 *   DWES → Joseba Garmendia
 *   DIW  → Ainhoa Elizalde
 *   DESP → Iñaki Olasagasti
 *   ING  → Edurne Rezola
 *   IPE2 → Maite Kortabarria
 *   PROY → Jose María (tutor)
 *   DWEC → (ya es de Jose María, no se incluye)
 *
 * NOTA: DAW1 y DAW2 comparten cicloId, así que estas asignaciones afectan
 * a ambos grupos (los módulos son del ciclo, no del grupo).
 *
 * USO:
 *   node scripts/asignar-profesores-daw.mjs            # DRY-RUN
 *   node scripts/asignar-profesores-daw.mjs --commit   # escribe
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

const JOSE_MARIA = '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';

// Asignación módulo (abreviatura) → profesorId
const ASIGNACION = {
  DWES: { profesorId:'ZIl15nXvwNdkACZ1OcHyfTnmujX2', nombre:'Joseba Garmendia' },
  DIW:  { profesorId:'m0DulaADPXVPCd8k2hoQi2CCmCY2', nombre:'Ainhoa Elizalde' },
  DESP: { profesorId:'U39XLeLEOJavORcswvHQ42PLgx52', nombre:'Iñaki Olasagasti' },
  ING:  { profesorId:'URVOZcpn1tNRrrmnPeYeYlFEeI62', nombre:'Edurne Rezola' },
  IPE2: { profesorId:'M6oTGU1MKlb5Nyj9qlL0JPwHk2P2', nombre:'Maite Kortabarria' },
  PROY: { profesorId:JOSE_MARIA, nombre:'Jose María Serrano' },
  // DWEC ya es de Jose María, no se toca.
};

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function run(){
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ASIGNAR PROFESORES A MÓDULOS DAW`);
  console.log(`  Modo: ${COMMIT?'COMMIT (escribe)':'DRY-RUN (no escribe)'}`);
  console.log(`${'='.repeat(56)}\n`);
  initFirebase();

  const snap = await db.collection('modulos').get();
  const updates = [];
  snap.forEach(d=>{
    const m = d.data();
    const ab = (m.abreviatura||'').toUpperCase();
    if (ASIGNACION[ab]) {
      updates.push({ ref:d.ref, abrev:ab, antes:m.profesorId||'(sin)', ...ASIGNACION[ab] });
    }
  });

  if(!updates.length){ console.log('No se encontró ninguno de:', Object.keys(ASIGNACION).join(', '), '\n'); return; }

  console.log('Asignaciones a aplicar:');
  for(const u of updates) console.log(`   ${u.abrev.padEnd(7)} → ${u.nombre.padEnd(20)} (antes: ${u.antes})`);
  console.log('\n   DWEC se mantiene en Jose María (no se toca).');
  console.log('   OJO: DAW1 y DAW2 comparten ciclo; afecta a ambos grupos.\n');

  if(!COMMIT){ console.log('🔍 DRY-RUN: no se ha escrito nada. Ejecuta con --commit.\n'); return; }

  const batch = db.batch();
  for(const u of updates) batch.update(u.ref, { profesorId:u.profesorId, updatedAt:Timestamp.now() });
  await batch.commit();
  console.log(`✅ ${updates.length} módulos DAW asignados.\n`);
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
