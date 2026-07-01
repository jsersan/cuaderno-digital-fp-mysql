#!/usr/bin/env node
/**
 * ============================================================================
 *  limpiar-grupo-basura.mjs
 *
 *  1) Diagnóstico: lista TODOS los grupos (id, nombre, ciclo, curso, curso
 *     académico, nº de alumnos en alumnosIds y nº de alumnos cuyo grupoId
 *     apunta al grupo). Sirve para localizar grupos basura (p.ej. "2AW-").
 *  2) Eliminación segura de un grupo: --eliminar=<id|nombre>.
 *     · Si el grupo NO tiene alumnos → lo borra.
 *     · Si tiene alumnos → ABORTA, salvo que indiques --mover=<grupoDestinoId>
 *       (reasigna los alumnos a ese grupo y luego borra) o --force (borra el
 *       grupo dejando los alumnos como están; no recomendado).
 *
 *  Seguridad: dry-run por defecto, backup JSON, --commit. Idempotente.
 *
 *  USO:
 *    node scripts/limpiar-grupo-basura.mjs                       (solo diagnóstico)
 *    node scripts/limpiar-grupo-basura.mjs --eliminar=2AW-        (simula borrado)
 *    node scripts/limpiar-grupo-basura.mjs --eliminar=2AW- --commit
 *    node scripts/limpiar-grupo-basura.mjs --eliminar=ID --mover=2AW3_ID --commit
 * ============================================================================
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const FORCE = process.argv.includes('--force');
const argVal = (n, d) => { const a = process.argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const ELIMINAR = argVal('--eliminar', '');
const MOVER = argVal('--mover', '');

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Grupos: diagnóstico${ELIMINAR ? ' + eliminación' : ''} · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`));
  console.log(`Proyecto: ${sa.project_id}`);

  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const alumnos = (await db.collection('alumnos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const countByGrupo = id => alumnos.filter(a => a.grupoId === id).length;

  console.log(C.a('\nGrupos en la base de datos:'));
  console.log('  ' + ['id', 'nombre', 'ciclo', 'curso', 'añoAcad', 'alumnosIds', 'alumnos(grupoId)'].join(' · '));
  for (const g of grupos) {
    console.log(`  ${g.id.slice(0,8)} · ${(g.nombre||'∅').padEnd(8)} · ${(g.cicloId||'∅').slice(0,8)} · c${g.curso ?? '?'} · ${g.cursoAcademico||'?'} · ids:${(g.alumnosIds||[]).length} · grupoId:${countByGrupo(g.id)}`);
  }

  if (!ELIMINAR) {
    console.log(C.g('\n(Solo diagnóstico. Para borrar un grupo basura: --eliminar=<id|nombre>)\n'));
    await admin.app().delete(); return;
  }

  // Resolver el grupo a eliminar por id exacto o por nombre (normalizado)
  let objetivo = grupos.find(g => g.id === ELIMINAR);
  if (!objetivo) {
    const cands = grupos.filter(g => norm(g.nombre) === norm(ELIMINAR));
    if (cands.length > 1) { console.error(C.r(`❌ Varios grupos con nombre "${ELIMINAR}": ${cands.map(g=>g.id).join(', ')}. Usa --eliminar=<id>.`)); await admin.app().delete(); return; }
    objetivo = cands[0];
  }
  if (!objetivo) { console.error(C.r(`❌ No encuentro grupo con id/nombre "${ELIMINAR}".`)); await admin.app().delete(); return; }

  const enGrupo = alumnos.filter(a => a.grupoId === objetivo.id);
  const nIds = (objetivo.alumnosIds || []).length;
  console.log(C.a(`\nGrupo objetivo: "${objetivo.nombre}" (${objetivo.id})  ciclo:${objetivo.cicloId||'∅'} curso:${objetivo.curso ?? '?'}`));
  console.log(`  alumnos cuyo grupoId apunta aquí: ${enGrupo.length}  ·  alumnosIds: ${nIds}`);

  if (enGrupo.length > 0 && !MOVER && !FORCE) {
    console.error(C.r(`\n❌ Este grupo tiene ${enGrupo.length} alumno(s). No lo borro a ciegas.`));
    console.error('   Opciones: --mover=<grupoDestinoId> para reasignarlos antes, o --force para borrar el grupo igualmente.');
    console.error('   Alumnos: ' + enGrupo.slice(0,8).map(a => `${a.apellidos||''} ${a.nombre||''}`.trim()).join(' · ') + (enGrupo.length>8?' …':''));
    await admin.app().delete(); return;
  }

  let destino = null;
  if (MOVER) {
    destino = grupos.find(g => g.id === MOVER || norm(g.nombre) === norm(MOVER));
    if (!destino) { console.error(C.r(`❌ Grupo destino "${MOVER}" no encontrado.`)); await admin.app().delete(); return; }
    console.log(C.a(`  Reasignar ${enGrupo.length} alumno(s) → "${destino.nombre}" (${destino.id})`));
  }

  console.log(C.a('\nPlan:'));
  if (destino) console.log(`  • Mover ${enGrupo.length} alumno(s) a ${destino.nombre} (grupoId)`);
  else if (enGrupo.length) console.log(C.r(`  • --force: dejar ${enGrupo.length} alumno(s) con grupoId huérfano`));
  console.log(`  • Borrar grupo "${objetivo.nombre}" (${objetivo.id})`);

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para aplicar.\n'));
    await admin.app().delete(); return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(__dirname, `backup-grupo-basura-${stamp}.json`),
    JSON.stringify({ grupoBorrado: { id: objetivo.id, data: { ...objetivo, ref: undefined } },
                     alumnosMovidos: enGrupo.map(a => ({ id: a.id, grupoIdAnterior: a.grupoId })), destino: destino?.id || null }, null, 2));
  console.log(C.g(`\nBackup: backup-grupo-basura-${stamp}.json`));

  const now = admin.firestore.FieldValue.serverTimestamp();
  if (destino && enGrupo.length) {
    let b = db.batch(), c = 0;
    for (const a of enGrupo) {
      b.update(a.ref, { grupoId: destino.id, updatedAt: now });
      // añadir a alumnosIds del destino
      if (++c % 400 === 0) { await b.commit(); b = db.batch(); }
    }
    await b.commit();
    const nuevos = Array.from(new Set([...((destino.alumnosIds)||[]), ...enGrupo.map(a => a.id)]));
    await destino.ref.update({ alumnosIds: nuevos, updatedAt: now });
    console.log(C.v(`✓ ${enGrupo.length} alumno(s) movidos a ${destino.nombre}`));
  }
  await objetivo.ref.delete();
  console.log(C.v(`✓ Grupo "${objetivo.nombre}" eliminado.\n`));
  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
