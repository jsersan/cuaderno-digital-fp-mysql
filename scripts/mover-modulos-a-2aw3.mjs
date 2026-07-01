#!/usr/bin/env node
/**
 * ============================================================================
 *  Mueve los módulos DIGA y SOST del grupo origen (SM2) al grupo destino (2AW3).
 *
 *  Reasigna grupoId en TODAS las colecciones implicadas para que la
 *  programación, tareas y exámenes sigan visibles tras el cambio:
 *    - modulos              (campo grupoId si existe)
 *    - eventos_programacion  (temas)
 *    - tareas
 *    - examenes
 *  Y actualiza modulosIds de ambos grupos (quita del origen, añade al destino).
 *
 *  USO:
 *    node mover-modulos-a-2aw3.mjs            # dry-run (solo muestra)
 *    node mover-modulos-a-2aw3.mjs --apply    # escribe en Firestore
 *
 *  OPCIONES:
 *    --modulos=DIGA,SOST     Abreviaturas a mover (por defecto DIGA,SOST).
 *    --origen=SM2            Grupo origen (por defecto SM2).
 *    --destino=2AW3          Grupo destino (por defecto 2AW3).
 * ============================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const APPLY = process.argv.includes('--apply');
const argVal = (name, def) => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const ABREVS  = argVal('modulos', 'DIGA,SOST').split(',').map(s => s.trim().toUpperCase());
const ORIGEN  = argVal('origen', 'SM2');
const DESTINO = argVal('destino', '2AW3');

const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── Firebase ─────────────────────────────────────────────────────────────────
let serviceAccount;
for (const p of [resolve(__dirname, 'serviceAccount.json'), resolve(__dirname, 'scripts', 'serviceAccount.json')]) {
  try { serviceAccount = JSON.parse(readFileSync(p, 'utf-8')); break; } catch {}
}
if (!serviceAccount) {
  console.error('❌ No se encontró serviceAccount.json (ni en . ni en ./scripts).');
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const log = (tag, msg) => console.log(`${APPLY ? '✅' : '🔍'} [${tag}] ${msg}`);

async function buscarGrupo(nombre) {
  const snap = await db.collection('grupos').get();
  const g = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(x => norm(x.nombre) === norm(nombre));
  return g || null;
}

// Reasigna grupoId en una colección para un módulo concreto
async function reasignarColeccion(coleccion, moduloId, origenId, destinoId) {
  const snap = await db.collection(coleccion)
    .where('moduloId', '==', moduloId)
    .where('grupoId', '==', origenId)
    .get();
  if (snap.empty) { log(coleccion.toUpperCase(), `0 documentos a mover`); return 0; }
  log(coleccion.toUpperCase(), `${snap.size} documento(s) → grupoId ${destinoId}`);
  if (APPLY) {
    // Trocear en lotes de 450 (límite Firestore 500)
    let i = 0;
    const docs = snap.docs;
    while (i < docs.length) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 450)) {
        batch.update(d.ref, { grupoId: destinoId, updatedAt: Timestamp.now() });
      }
      await batch.commit();
      i += 450;
    }
  }
  return snap.size;
}

async function main() {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(APPLY ? '🚀  MODO --apply: se escribirán cambios en Firestore'
                    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply)');
  console.log(`${'─'.repeat(72)}\n`);

  // 1) Resolver grupos origen y destino
  const grupoOrigen  = await buscarGrupo(ORIGEN);
  const grupoDestino = await buscarGrupo(DESTINO);
  if (!grupoOrigen)  { console.error(`❌ No existe el grupo origen "${ORIGEN}".`);  process.exit(1); }
  if (!grupoDestino) { console.error(`❌ No existe el grupo destino "${DESTINO}".`); process.exit(1); }
  log('GRUPO', `Origen:  ${grupoOrigen.nombre} (${grupoOrigen.id})`);
  log('GRUPO', `Destino: ${grupoDestino.nombre} (${grupoDestino.id})`);

  // Aviso de alumnos
  const nAlOrigen  = (grupoOrigen.alumnosIds || []).length;
  const nAlDestino = (grupoDestino.alumnosIds || []).length;
  console.log(`\n⚠️  ${grupoOrigen.nombre} tiene ${nAlOrigen} alumno(s); ${grupoDestino.nombre} tiene ${nAlDestino}.`);
  console.log(`   Tras mover, los módulos quedarán vinculados a los alumnos de ${grupoDestino.nombre}.\n`);

  // 2) Resolver módulos a mover
  const modsSnap = await db.collection('modulos').get();
  const modulos = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(m => ABREVS.includes(norm(m.abreviatura)));
  if (modulos.length === 0) {
    console.error(`❌ No se encontraron módulos con abreviatura ${ABREVS.join(', ')}.`);
    process.exit(1);
  }
  log('MÓDULOS', `A mover: ${modulos.map(m => m.abreviatura).join(', ')}`);

  let totalDocs = 0;
  const modulosMovidosIds = [];

  for (const m of modulos) {
    console.log(`\n── ${m.abreviatura} — ${m.nombre} (${m.id}) ──`);
    modulosMovidosIds.push(m.id);

    // 2a) Campo grupoId en el propio módulo (si lo usa)
    if (m.grupoId === grupoOrigen.id) {
      log('MODULO.grupoId', `${grupoOrigen.id} → ${grupoDestino.id}`);
      if (APPLY) await db.collection('modulos').doc(m.id).update({ grupoId: grupoDestino.id, updatedAt: Timestamp.now() });
    } else {
      log('MODULO.grupoId', `sin cambio (valor actual: ${m.grupoId ?? '—'})`);
    }

    // 2b) Reasignar en las colecciones dependientes
    for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
      totalDocs += await reasignarColeccion(col, m.id, grupoOrigen.id, grupoDestino.id);
    }
  }

  // 3) Actualizar modulosIds de ambos grupos
  const origenMods  = new Set(grupoOrigen.modulosIds || []);
  const destinoMods = new Set(grupoDestino.modulosIds || []);
  modulosMovidosIds.forEach(id => { origenMods.delete(id); destinoMods.add(id); });

  log('GRUPO.modulosIds', `${grupoOrigen.nombre}: quita ${modulosMovidosIds.length} · ${grupoDestino.nombre}: añade ${modulosMovidosIds.length}`);
  if (APPLY) {
    await db.collection('grupos').doc(grupoOrigen.id).update({ modulosIds: [...origenMods], updatedAt: Timestamp.now() });
    await db.collection('grupos').doc(grupoDestino.id).update({ modulosIds: [...destinoMods], updatedAt: Timestamp.now() });
  }

  // 4) Resumen
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  RESUMEN`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Módulos movidos: ${modulos.map(m => m.abreviatura).join(', ')}`);
  console.log(`  ${grupoOrigen.nombre} → ${grupoDestino.nombre}`);
  console.log(`  Documentos reasignados (eventos+tareas+examenes): ${totalDocs}`);
  console.log(`${'═'.repeat(72)}\n`);

  if (APPLY) {
    console.log('✅  Cambios escritos en Firestore. Recarga la app (Ctrl+Shift+R).\n');
  } else {
    console.log('ℹ️   Ejecuta con --apply para aplicar los cambios:\n');
    console.log('    node mover-modulos-a-2aw3.mjs --apply\n');
  }
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
