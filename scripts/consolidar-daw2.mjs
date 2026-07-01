#!/usr/bin/env node
/**
 * consolidar-daw2.mjs
 * ========================================================================
 * Limpia el lío de duplicados de DAW2 2025-2026 dejando UN solo grupo bueno.
 *
 *  GRUPO BUENO (se conserva): AJdeLlMHMguP1VwxQ0Nz
 *    - datos históricos con notas: DWEC, PROY, DCLI · 14 alumnos · horario · orla
 *  GRUPO DUPLICADO (se elimina): 5Hrvtz6LdrqLz6RqKrD9
 *    - reconstrucción DEWC redundante (se descarta)
 *    - asistencia (260 + mensual) → se MUEVE al grupo bueno, reapuntando
 *      el módulo DEWC→DWEC y los alumnoId por email
 *    - 12 alumnos duplicados (se borran; ya están en el grupo bueno)
 *  MÓDULO DUPLICADO (se elimina): DEWC 90zDwdBRXEyXZjHLuAdd
 *
 * USO:
 *   node scripts/consolidar-daw2.mjs            # DRY-RUN
 *   node scripts/consolidar-daw2.mjs --commit    # EJECUTA
 * ========================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();

// IDs confirmados por el diagnóstico
const GRUPO_BUENO = 'AJdeLlMHMguP1VwxQ0Nz';
const GRUPO_DUP   = '5Hrvtz6LdrqLz6RqKrD9';
const MOD_DWEC    = 'UvJgp4031Tli2vle3jeH'; // original (destino de la asistencia)
const MOD_DEWC    = '90zDwdBRXEyXZjHLuAdd'; // duplicado (a borrar)

let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function borrarDocs(query, etiqueta) {
  const snap = await query.get();
  if (snap.empty) { console.log(`   ${etiqueta}: 0`); return 0; }
  let b = db.batch(), n = 0;
  for (const d of snap.docs) { b.delete(d.ref); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
  if (n % 400 !== 0) await b.commit();
  console.log(`   ${etiqueta}: ${snap.size} borrados`);
  return snap.size;
}

async function run() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  CONSOLIDAR DAW2 2025-2026`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT (ejecuta)' : '🔍 DRY-RUN (no escribe)'}`);
  console.log(`${'═'.repeat(64)}`);
  initFirebase();

  // Mapa email → alumnoId del grupo BUENO (para reapuntar la asistencia)
  const emailToIdBueno = {};
  const alBuenoSnap = await db.collection('alumnos').where('grupoId', '==', GRUPO_BUENO).get();
  alBuenoSnap.forEach(d => { const e = norm(d.data().email); if (e) emailToIdBueno[e] = d.id; });
  // Mapa alumnoId(dup) → email (del grupo duplicado)
  const idDupToEmail = {};
  const alDupSnap = await db.collection('alumnos').where('grupoId', '==', GRUPO_DUP).get();
  alDupSnap.forEach(d => { idDupToEmail[d.id] = norm(d.data().email); });
  console.log(`\n✓ Alumnos grupo bueno: ${alBuenoSnap.size} · grupo duplicado: ${alDupSnap.size}`);

  // ── PASO 1 · Mover asistencia del grupo duplicado al bueno ──
  console.log('\n── PASO 1 · Mover asistencia 5Hrvtz6 → AJdeLlMH ──');
  for (const col of ['asistencia', 'asistencia_mensual']) {
    const snap = await db.collection(col).where('grupoId', '==', GRUPO_DUP).get();
    console.log(`   ${col}: ${snap.size} documentos a mover`);
    if (COMMIT && !snap.empty) {
      let b = db.batch(), n = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const update = { grupoId: GRUPO_BUENO, updatedAt: nowTs() };
        // Reapuntar módulo DEWC→DWEC si aplica
        if (data.moduloId === MOD_DEWC) update.moduloId = MOD_DWEC;
        // Reapuntar alumnoId por email si aplica
        if (data.alumnoId && idDupToEmail[data.alumnoId]) {
          const nuevoId = emailToIdBueno[idDupToEmail[data.alumnoId]];
          if (nuevoId) update.alumnoId = nuevoId;
        }
        b.update(d.ref, update);
        if (++n % 400 === 0) { await b.commit(); b = db.batch(); }
      }
      if (n % 400 !== 0) await b.commit();
      console.log(`      ✓ ${snap.size} movidos y reapuntados`);
    }
  }

  // ── PASO 2 · Borrar la reconstrucción DEWC redundante del grupo duplicado ──
  console.log('\n── PASO 2 · Borrar programación DEWC redundante (grupo duplicado) ──');
  if (COMMIT) {
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      await borrarDocs(db.collection(col).where('grupoId', '==', GRUPO_DUP), col);
    }
  } else {
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      const s = await db.collection(col).where('grupoId', '==', GRUPO_DUP).get();
      console.log(`   ${col}: ${s.size} se borrarían`);
    }
  }

  // ── PASO 3 · Borrar los 12 alumnos duplicados del grupo duplicado ──
  console.log('\n── PASO 3 · Borrar alumnos duplicados (grupo duplicado) ──');
  if (COMMIT) {
    await borrarDocs(db.collection('alumnos').where('grupoId', '==', GRUPO_DUP), 'alumnos');
  } else {
    console.log(`   alumnos: ${alDupSnap.size} se borrarían`);
  }

  // ── PASO 4 · Borrar cualquier resto del grupo duplicado y el grupo ──
  console.log('\n── PASO 4 · Borrar grupo duplicado 5Hrvtz6 ──');
  if (COMMIT) {
    // por si quedara algo suelto en otras colecciones
    for (const col of ['recuperaciones', 'calificaciones', 'observaciones', 'orlas']) {
      await borrarDocs(db.collection(col).where('grupoId', '==', GRUPO_DUP), col);
    }
    await db.collection('grupos').doc(GRUPO_DUP).delete();
    console.log('   ✓ grupo 5Hrvtz6 borrado');
  } else {
    console.log('   [DRY] se borraría el grupo 5Hrvtz6 y restos sueltos');
  }

  // ── PASO 5 · Borrar el módulo DEWC duplicado ──
  console.log('\n── PASO 5 · Borrar módulo DEWC duplicado (90zDwd) ──');
  if (COMMIT) {
    // Comprobar que no queda nada apuntando a DEWC antes de borrar el módulo
    let restos = 0;
    for (const col of ['eventos_programacion', 'tareas', 'examenes', 'asistencia', 'asistencia_mensual', 'calificaciones', 'recuperaciones']) {
      const s = await db.collection(col).where('moduloId', '==', MOD_DEWC).get();
      restos += s.size;
      if (s.size) console.log(`   ⚠️  aún quedan ${s.size} docs en ${col} con módulo DEWC`);
    }
    if (restos === 0) {
      await db.collection('modulos').doc(MOD_DEWC).delete();
      console.log('   ✓ módulo DEWC (90zDwd) borrado');
    } else {
      console.log(`   ⚠️  NO se borra el módulo DEWC: aún quedan ${restos} docs apuntándolo. Revisa.`);
    }
  } else {
    let restos = 0;
    for (const col of ['eventos_programacion', 'tareas', 'examenes', 'asistencia', 'asistencia_mensual', 'calificaciones', 'recuperaciones']) {
      restos += (await db.collection(col).where('moduloId', '==', MOD_DEWC).get()).size;
    }
    console.log(`   [DRY] tras mover/borrar quedarían ${restos} docs con módulo DEWC (deberían ser 0 salvo la asistencia, que se reapunta a DWEC)`);
  }

  console.log(`\n${'═'.repeat(64)}`);
  if (!COMMIT) {
    console.log('  🔍 DRY-RUN: no se ha escrito nada. Revisa los recuentos y ejecuta --commit.');
  } else {
    console.log('  ✅ CONSOLIDADO. Queda un solo DAW2 2025-2026 (AJdeLlMH) con:');
    console.log('     DWEC (con notas y recuperaciones) + PROY + DCLI + asistencia + 14 alumnos.');
    console.log('     Recarga el Dashboard y abre el cuaderno DWEC/DAW2.');
  }
  console.log(`${'═'.repeat(64)}\n`);
}
run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
