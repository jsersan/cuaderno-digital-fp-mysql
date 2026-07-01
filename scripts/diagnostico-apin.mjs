#!/usr/bin/env node
/**
 * diagnostico-apin.mjs
 * --------------------------------------------------------------------------
 * Solo LEE (no escribe nada). Informa del estado de SM1 / APIN:
 *   - IDs de módulo APIN y grupo SM1
 *   - Nº de alumnos del grupo SM1 y cuántos tienen matrícula en APIN
 *   - Nº de registros de asistencia (mensual y por franja) para APIN/SM1
 *
 * USO:  node scripts/diagnostico-apin.mjs
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

async function run() {
  initFirebase();
  console.log('\n=== DIAGNÓSTICO APIN / SM1 ===\n');

  // Módulo APIN
  let modulo = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!modulo && (m.abreviatura === 'APIN' || m.codigo === 'APIN' ||
        (m.nombre || '').toLowerCase().includes('ofim'))) modulo = { id: d.id, ...m };
  });
  console.log('MÓDULO APIN:', modulo ? `${modulo.abreviatura || modulo.nombre} (id: ${modulo.id})` : '❌ NO ENCONTRADO');

  // Grupo SM1
  let grupo = null;
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (!grupo && g.nombre === 'SM1') grupo = { id: d.id, ...g };
  });
  console.log('GRUPO SM1:', grupo ? `${grupo.nombre} (id: ${grupo.id})` : '❌ NO ENCONTRADO');
  if (grupo) console.log('  · alumnosIds en el grupo:', (grupo.alumnosIds || []).length);

  if (!modulo || !grupo) { console.log('\nFalta módulo o grupo, no sigo.\n'); return; }

  // Alumnos del grupo
  const alumnosSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  console.log(`\nALUMNOS con grupoId=SM1: ${alumnosSnap.size}`);

  let conMatricula = 0, sinMatricula = 0;
  const ejemplos = [];
  alumnosSnap.forEach(d => {
    const a = d.data();
    const mats = a.matriculas || [];
    const tiene = mats.some(m => m.moduloId === modulo.id);
    if (tiene) conMatricula++; else sinMatricula++;
    if (ejemplos.length < 3) ejemplos.push({
      nombre: `${a.apellidos}, ${a.nombre}`,
      nMatriculas: mats.length,
      modulosMatriculados: mats.map(m => m.moduloNombre || m.moduloId).join(', ') || '(ninguna)'
    });
  });
  console.log(`  · con matrícula en APIN: ${conMatricula}`);
  console.log(`  · SIN matrícula en APIN: ${sinMatricula}`);
  console.log('  · ejemplos:');
  ejemplos.forEach(e => console.log(`      - ${e.nombre} | matrículas: ${e.nMatriculas} [${e.modulosMatriculados}]`));

  // Asistencia mensual
  const amSnap = await db.collection('asistencia_mensual')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  console.log(`\nASISTENCIA_MENSUAL (APIN/SM1): ${amSnap.size} documentos`);

  // Asistencia por franja
  const asSnap = await db.collection('asistencia')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  console.log(`ASISTENCIA (franjas) (APIN/SM1): ${asSnap.size} documentos`);

  console.log('\n=== FIN DIAGNÓSTICO ===\n');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
