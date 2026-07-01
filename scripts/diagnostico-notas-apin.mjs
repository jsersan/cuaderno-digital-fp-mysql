#!/usr/bin/env node
/**
 * diagnostico-notas-apin.mjs  (SOLO LEE)
 * --------------------------------------------------------------------------
 * Muestra la estructura real de exámenes, recuperaciones y calificaciones
 * de APIN/SM1 para poder simular notas sin inventar campos.
 *
 * USO:  node scripts/diagnostico-notas-apin.mjs
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

// Imprime las claves de nivel superior de un objeto y el tipo de cada valor
function shape(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    let t = Array.isArray(v) ? `array[${v.length}]` : (v && typeof v === 'object' && v.toDate ? 'Timestamp' : typeof v);
    out.push(`${prefix}${k}: ${t}`);
  }
  return out;
}

async function run() {
  initFirebase();

  // Localizar módulo APIN y grupo SM1
  let modulo = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!modulo && (m.abreviatura === 'APIN' || (m.nombre||'').toLowerCase().includes('ofim'))) modulo = { id: d.id, ...m };
  });
  let grupo = null;
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data(); if (!grupo && g.nombre === 'SM1') grupo = { id: d.id, ...g };
  });
  console.log('\n=== ESTRUCTURA NOTAS APIN/SM1 ===');
  console.log('Módulo APIN:', modulo?.id, '| Grupo SM1:', grupo?.id);

  const M = modulo.id, G = grupo.id;

  // 1) EXÁMENES
  const exSnap = await db.collection('examenes').where('moduloId','==',M).where('grupoId','==',G).get();
  console.log(`\n--- EXÁMENES: ${exSnap.size} ---`);
  if (!exSnap.empty) {
    const d0 = exSnap.docs[0];
    console.log('Campos de un examen ("'+ (d0.data().titulo||'').slice(0,40) +'"):');
    shape(d0.data()).forEach(l => console.log('   '+l));
    const cal = d0.data().calificaciones || [];
    console.log('   calificaciones[] length:', cal.length);
    if (cal.length) { console.log('   forma de calificaciones[0]:'); shape(cal[0]).forEach(l=>console.log('      '+l)); }
  }

  // 2) RECUPERACIONES
  const recSnap = await db.collection('recuperaciones').where('moduloId','==',M).where('grupoId','==',G).get();
  console.log(`\n--- RECUPERACIONES: ${recSnap.size} ---`);
  if (!recSnap.empty) {
    const r0 = recSnap.docs[0];
    console.log('Campos de una recuperación ("'+ (r0.data().titulo||'').slice(0,40) +'"):');
    shape(r0.data()).forEach(l => console.log('   '+l));
    const conv = r0.data().alumnosConvocados || [];
    console.log('   alumnosConvocados[] length:', conv.length);
    if (conv.length) { console.log('   forma de alumnosConvocados[0]:'); shape(conv[0]).forEach(l=>console.log('      '+l)); }
  } else {
    console.log('   (sin recuperaciones; las crearemos)');
  }

  // 3) CALIFICACIONES (colección dedicada, si existe)
  let calSnap;
  try {
    calSnap = await db.collection('calificaciones').where('moduloId','==',M).where('grupoId','==',G).get();
    console.log(`\n--- CALIFICACIONES (colección): ${calSnap.size} ---`);
    if (!calSnap.empty) { shape(calSnap.docs[0].data()).forEach(l=>console.log('   '+l)); }
    else console.log('   (vacía o las notas van embebidas en examenes/tareas)');
  } catch(e) {
    console.log('\n--- CALIFICACIONES: colección no consultable ---', e.message);
  }

  // 4) TAREAS: ver forma de entregas[]
  const tSnap = await db.collection('tareas').where('moduloId','==',M).where('grupoId','==',G).limit(1).get();
  console.log(`\n--- TAREAS (muestra): ${tSnap.size} ---`);
  if (!tSnap.empty) {
    const ent = tSnap.docs[0].data().entregas || [];
    console.log('   entregas[] length:', ent.length);
    if (ent.length) { console.log('   forma de entregas[0]:'); shape(ent[0]).forEach(l=>console.log('      '+l)); }
    else console.log('   (sin entregas; podríamos simularlas también)');
  }

  // 5) Una muestra de alumno para ver el id usado en notas
  const aSnap = await db.collection('alumnos').where('grupoId','==',G).limit(1).get();
  if (!aSnap.empty) {
    const a = aSnap.docs[0];
    console.log('\n--- ALUMNO (muestra) ---');
    console.log('   docId:', a.id);
    shape(a.data()).forEach(l => console.log('   '+l));
  }

  console.log('\n=== FIN ===\n');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
