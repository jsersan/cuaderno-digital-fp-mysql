#!/usr/bin/env node
/**
 * asignar-profesores-smr.mjs
 * --------------------------------------------------------------------------
 * Asigna cada módulo de 2º de SMR a su profesor real (por profesorId).
 * APIN se mantiene en Jose María (no se toca su asignación salvo confirmación).
 *
 * USO:
 *   node scripts/asignar-profesores-smr.mjs            # DRY-RUN
 *   node scripts/asignar-profesores-smr.mjs --commit   # escribe
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// Asignación módulo (abreviatura) → profesorId
const ASIGNACION = {
  SEGI:  { profesorId:'U39XLeLEOJavORcswvHQ42PLgx52', nombre:'Iñaki Olasagasti' },
  SERED: { profesorId:'ZIl15nXvwNdkACZ1OcHyfTnmujX2', nombre:'Joseba Garmendia' },
  SGBD:  { profesorId:'m0DulaADPXVPCd8k2hoQi2CCmCY2', nombre:'Ainhoa Elizalde' },
  EIE:   { profesorId:'URVOZcpn1tNRrrmnPeYeYlFEeI62', nombre:'Edurne Rezola' },
  HLC:   { profesorId:'M6oTGU1MKlb5Nyj9qlL0JPwHk2P2', nombre:'Maite Kortabarria' },
  // APIN se queda con Jose María: NO se incluye aquí a propósito.
};

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function run(){
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ASIGNAR PROFESORES A MÓDULOS SMR`);
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
  for(const u of updates) console.log(`   ${u.abrev.padEnd(7)} → ${u.nombre.padEnd(20)} (profesorId: ${u.profesorId})`);
  console.log('\n   APIN se mantiene en Jose María (no se toca).\n');

  if(!COMMIT){ console.log('🔍 DRY-RUN: no se ha escrito nada. Ejecuta con --commit.\n'); return; }

  const batch = db.batch();
  for(const u of updates) batch.update(u.ref, { profesorId:u.profesorId, updatedAt:Timestamp.now() });
  await batch.commit();
  console.log(`✅ ${updates.length} módulos reasignados. APIN sigue siendo tuyo.\n`);
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
