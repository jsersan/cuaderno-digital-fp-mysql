#!/usr/bin/env node
/**
 * diagnostico-sost.mjs
 *
 * Script de diagnóstico: busca TODOS los eventos, tareas y exámenes
 * del módulo SOST sin filtrar por grupoId, para identificar
 * qué grupoId tienen realmente los documentos en Firestore.
 *
 * Uso:
 *   node diagnostico-sost.mjs
 *
 * Requiere:
 *   npm install firebase-admin
 *   El fichero firebase-key.json en el mismo directorio.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MODULO_ABREV = 'SOST';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = join(__dirname, 'firebase-key.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
} catch {
  console.error(`❌ No se encontró ${KEY_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date((ts._seconds ?? ts.seconds) * 1000);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Diagnóstico del módulo ${MODULO_ABREV}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ── 1. Buscar TODOS los módulos con abreviatura SOST ──
  const modulosSnap = await db.collection('modulos')
    .where('abreviatura', '==', MODULO_ABREV)
    .get();

  if (modulosSnap.empty) {
    console.error(`❌ No se encontró ningún módulo con abreviatura "${MODULO_ABREV}".`);
    process.exit(1);
  }

  console.log(`📘 Módulos encontrados con abreviatura "${MODULO_ABREV}": ${modulosSnap.size}`);
  for (const doc of modulosSnap.docs) {
    const d = doc.data();
    console.log(`   ID: ${doc.id}  |  nombre: ${d.nombre}  |  cicloId: ${d.cicloId}  |  activo: ${d.activo}`);
  }

  // ── 2. Para CADA módulo encontrado, buscar datos ──
  for (const moduloDoc of modulosSnap.docs) {
    const modulo = { id: moduloDoc.id, ...moduloDoc.data() };
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Módulo: ${modulo.nombre} (ID: ${modulo.id})`);
    console.log(`  cicloId: ${modulo.cicloId}`);
    console.log(`${'─'.repeat(60)}`);

    // 2a. Listar TODOS los grupos de este ciclo
    const gruposSnap = await db.collection('grupos')
      .where('cicloId', '==', modulo.cicloId)
      .get();
    console.log(`\n📂 Grupos del ciclo ${modulo.cicloId}: ${gruposSnap.size}`);
    for (const g of gruposSnap.docs) {
      const gd = g.data();
      console.log(`   ID: ${g.id}  |  nombre: ${gd.nombre}  |  cursoAcademico: ${gd.cursoAcademico}`);
    }

    // 2b. Eventos de programación — SOLO filtrar por moduloId
    const eventosSnap = await db.collection('eventos_programacion')
      .where('moduloId', '==', modulo.id)
      .get();
    console.log(`\n📅 Eventos de programación (moduloId=${modulo.id}): ${eventosSnap.size}`);
    const evPorGrupo = {};
    for (const doc of eventosSnap.docs) {
      const d = doc.data();
      const gid = d.grupoId || '(sin grupoId)';
      if (!evPorGrupo[gid]) evPorGrupo[gid] = [];
      evPorGrupo[gid].push({ id: doc.id, ...d });
    }
    for (const [gid, evs] of Object.entries(evPorGrupo)) {
      console.log(`   grupoId: ${gid}  →  ${evs.length} evento(s)`);
      for (const e of evs) {
        console.log(`      [${(e.tipo || '?').padEnd(9)}] ${e.titulo}  (${e.evaluacion || '?'})  ${fmt(e.fechaInicio)}  cursoAcad: ${e.cursoAcademico || '?'}`);
      }
    }

    // 2c. Tareas — SOLO filtrar por moduloId
    const tareasSnap = await db.collection('tareas')
      .where('moduloId', '==', modulo.id)
      .get();
    console.log(`\n📝 Tareas (moduloId=${modulo.id}): ${tareasSnap.size}`);
    const tarPorGrupo = {};
    for (const doc of tareasSnap.docs) {
      const d = doc.data();
      const gid = d.grupoId || '(sin grupoId)';
      if (!tarPorGrupo[gid]) tarPorGrupo[gid] = [];
      tarPorGrupo[gid].push({ id: doc.id, ...d });
    }
    for (const [gid, tars] of Object.entries(tarPorGrupo)) {
      console.log(`   grupoId: ${gid}  →  ${tars.length} tarea(s)`);
      for (const t of tars) {
        console.log(`      ${t.titulo}  (${t.evaluacion || '?'})  entrega: ${fmt(t.fechaEntrega)}  archivada: ${t.archivada || false}`);
      }
    }

    // 2d. Exámenes — SOLO filtrar por moduloId
    const examenesSnap = await db.collection('examenes')
      .where('moduloId', '==', modulo.id)
      .get();
    console.log(`\n📋 Exámenes (moduloId=${modulo.id}): ${examenesSnap.size}`);
    const exPorGrupo = {};
    for (const doc of examenesSnap.docs) {
      const d = doc.data();
      const gid = d.grupoId || '(sin grupoId)';
      if (!exPorGrupo[gid]) exPorGrupo[gid] = [];
      exPorGrupo[gid].push({ id: doc.id, ...d });
    }
    for (const [gid, exs] of Object.entries(exPorGrupo)) {
      console.log(`   grupoId: ${gid}  →  ${exs.length} examen(es)`);
      for (const e of exs) {
        console.log(`      ${e.titulo}  (${e.tipo || '?'}, ${e.evaluacion || '?'})  ${fmt(e.fecha)}`);
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Diagnóstico completado.`);
  console.log(`  Compara los grupoId de los datos con los grupos listados arriba.`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message || err);
  process.exit(1);
});
