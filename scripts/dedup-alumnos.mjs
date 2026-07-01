// scripts/dedup-alumnos.mjs
// -----------------------------------------------------------------------------
// Elimina alumnos DUPLICADOS, conservando uno por email.
// SIEMPRE guarda una copia de seguridad JSON de toda la colección antes de borrar.
//
// Uso:
//   node --check scripts/dedup-alumnos.mjs       → validar sintaxis
//   node scripts/dedup-alumnos.mjs               → DRY-RUN (no borra; sí hace backup)
//   node scripts/dedup-alumnos.mjs --commit      → aplicar (borra duplicados)
//   (opcional) primer argumento = ruta del serviceAccount.json
//
// Criterio: se agrupan por email (normalizado). De cada grupo de duplicados se
// CONSERVA uno (el que esté enlazado en algún grupo.alumnosIds; si empatan, el más
// antiguo por createdAt; si no hay, el de id menor) y se BORRA el resto. Los ids
// borrados se quitan también de grupos.alumnosIds. Los alumnos SIN email no se tocan.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');

// --- Localizar serviceAccount.json ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const argPath = process.argv.slice(2).find(a => !a.startsWith('--'));
const candidatos = [
  argPath && (isAbsolute(argPath) ? argPath : resolve(process.cwd(), argPath)),
  resolve(__dirname, 'serviceAccount.json'),
  resolve(process.cwd(), 'serviceAccount.json'),
  resolve(process.cwd(), 'scripts/serviceAccount.json'),
].filter(Boolean);
const saPath = candidatos.find(p => existsSync(p));
if (!saPath) {
  console.error('✗ No encuentro serviceAccount.json. Rutas probadas:\n  ' + candidatos.join('\n  '));
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const norm = (s) => (s ?? '').toString().trim().toLowerCase();
const emailDe = (a) => norm(a.email || a.emaila || a.correo || a.mail);
const segundos = (ts) => ts?.seconds ?? ts?._seconds ?? Infinity;

async function main() {
  console.log(COMMIT ? '== MODO COMMIT: se borrarán duplicados ==' : '== DRY-RUN: no se borra nada (sí se hace backup). Usa --commit para aplicar ==');
  console.log(`Proyecto: ${serviceAccount.project_id}`);

  const snap = await db.collection('alumnos').get();
  const alumnos = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`Alumnos totales: ${alumnos.length}`);

  // Grupos: para preferir conservar el alumno que esté enlazado en alumnosIds
  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const enAlgunGrupo = new Set();
  for (const g of grupos) for (const id of (g.alumnosIds || [])) enAlgunGrupo.add(id);

  // Agrupar por email
  const porEmail = new Map();
  const sinEmail = [];
  for (const a of alumnos) {
    const e = emailDe(a);
    if (!e) { sinEmail.push(a); continue; }
    if (!porEmail.has(e)) porEmail.set(e, []);
    porEmail.get(e).push(a);
  }

  // Elegir el que se conserva en cada conjunto de duplicados
  const conservar = [], borrar = [];
  for (const arr of porEmail.values()) {
    if (arr.length <= 1) continue;
    arr.sort((x, y) => {
      const gx = enAlgunGrupo.has(x.id) ? 1 : 0, gy = enAlgunGrupo.has(y.id) ? 1 : 0;
      if (gx !== gy) return gy - gx;                       // 1º: el que está en un grupo
      const tx = segundos(x.createdAt), ty = segundos(y.createdAt);
      if (tx !== ty) return tx - ty;                       // 2º: el más antiguo
      return x.id < y.id ? -1 : 1;                          // 3º: id menor (determinista)
    });
    conservar.push(arr[0]);
    for (const a of arr.slice(1)) borrar.push(a);
  }

  const conjuntosDup = [...porEmail.values()].filter(a => a.length > 1).length;
  console.log(`Emails con duplicados: ${conjuntosDup}`);
  console.log(`Se conservarán (uno por email): ${conservar.length}`);
  console.log(`A eliminar (duplicados): ${borrar.length}`);
  if (sinEmail.length) console.log(`⚠ ${sinEmail.length} alumno(s) SIN email: no se deduplican (revísalos a mano si los hubiera).`);

  borrar.slice(0, 12).forEach(a => console.log(`  - borrar ${a.id}: ${a.apellidos || ''}, ${a.nombre || ''} <${emailDe(a)}>  (taldea: ${a.grupoNombre || a.grupoId || '?'})`));
  if (borrar.length > 12) console.log(`  … y ${borrar.length - 12} más`);

  if (borrar.length === 0) { console.log('\nNo hay duplicados por email. Nada que borrar.'); return; }

  // Copia de seguridad SIEMPRE (también en dry-run): toda la colección alumnos
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = resolve(process.cwd(), `alumnos-backup-${stamp}.json`);
  writeFileSync(backupFile, JSON.stringify(alumnos.map(({ ref, ...a }) => a), null, 2), 'utf8');
  console.log(`\nCopia de seguridad de TODA la colección alumnos: ${backupFile}`);

  if (!COMMIT) {
    console.log('DRY-RUN: no se ha borrado nada. Revisa el listado y, si es correcto, repite con --commit.');
    return;
  }

  const delIds = new Set(borrar.map(a => a.id));

  // 1) Quitar los ids borrados de grupos.alumnosIds
  let gruposLimpiados = 0;
  for (const g of grupos) {
    const ids = g.alumnosIds || [];
    const limpio = ids.filter(id => !delIds.has(id));
    if (limpio.length !== ids.length) { await g.ref.update({ alumnosIds: limpio }); gruposLimpiados++; }
  }

  // 2) Borrar los alumnos duplicados en lotes de 400
  let i = 0;
  while (i < borrar.length) {
    const batch = db.batch();
    for (const a of borrar.slice(i, i + 400)) batch.delete(a.ref);
    await batch.commit();
    i += 400;
  }

  console.log(`\n✓ Eliminados ${borrar.length} alumnos duplicados. Grupos actualizados: ${gruposLimpiados}.`);
  console.log(`  Copia de seguridad: ${backupFile}`);
  console.log('  Verifica notas y asistencia: si algún alumno conservado hubiera perdido datos, restaura desde el backup y lo afinamos.');
}

main().catch(e => {
  if (e && (e.code === 16 || /UNAUTHENTICATED/.test(e.message || ''))) {
    console.error('\n✗ Credenciales rechazadas (UNAUTHENTICATED). Usa una clave válida del proyecto correcto.');
  } else { console.error(e); }
  process.exit(1);
});
