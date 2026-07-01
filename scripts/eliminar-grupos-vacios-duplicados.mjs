// scripts/eliminar-grupos-vacios-duplicados.mjs
// -----------------------------------------------------------------------------
// Borra grupos DUPLICADOS que están VACÍOS (sin alumnos), conservando el que sí
// tiene alumnos. Antes de borrar, traspasa los modulosIds del grupo vacío al que
// se conserva, para no perder el enlace de los módulos (DBDR, PROI, APIN…).
//
// "Duplicado" = mismo nombre + mismo cicloId + mismo cursoAcademico.
//
// Uso:
//   node --check scripts/eliminar-grupos-vacios-duplicados.mjs   → validar sintaxis
//   node scripts/eliminar-grupos-vacios-duplicados.mjs           → DRY-RUN (no borra; hace backup)
//   node scripts/eliminar-grupos-vacios-duplicados.mjs --commit  → aplicar
//   (opcional) primer argumento = ruta del serviceAccount.json
//
// Seguridad: solo borra un grupo cuando, en su mismo bloque de duplicados, hay
// otro grupo CON alumnos que se conserva. Si todos están vacíos o todos tienen
// alumnos, no toca nada y lo informa.
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

const norm = (s) => (s ?? '').toString().trim().toUpperCase();

async function main() {
  console.log(COMMIT ? '== MODO COMMIT: se borrarán grupos vacíos duplicados ==' : '== DRY-RUN: no se borra nada (sí backup). Usa --commit para aplicar ==');
  console.log(`Proyecto: ${serviceAccount.project_id}`);

  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const alumnos = (await db.collection('alumnos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Grupos: ${grupos.length} · Alumnos: ${alumnos.length}`);

  // Nº de alumnos vinculados a un grupo (por grupoId del alumno, por grupoIds[], o por alumnosIds del grupo)
  const cuentaAlumnos = (g) => {
    let n = 0;
    for (const a of alumnos) {
      if (a.grupoId === g.id) n++;
      else if (Array.isArray(a.grupoIds) && a.grupoIds.includes(g.id)) n++;
    }
    return Math.max(n, (g.alumnosIds || []).length);
  };

  // Agrupar por (nombre, cicloId, cursoAcademico)
  const buckets = new Map();
  for (const g of grupos) {
    const k = `${norm(g.nombre)}|${g.cicloId || ''}|${g.cursoAcademico || ''}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push({ g, n: cuentaAlumnos(g) });
  }

  const aBorrar = [];           // { empty, survivor }
  const updatesSurvivor = new Map(); // survivorId -> Set(modulosIds)

  for (const [k, items] of buckets) {
    if (items.length <= 1) continue; // no hay duplicado
    const conAlumnos = items.filter(x => x.n > 0);
    const vacios = items.filter(x => x.n === 0);
    const [nombre, ciclo, curso] = k.split('|');
    console.log(`\nDuplicado "${nombre}" (cicloId=${ciclo || '?'}, curso ${curso || '?'}): ${items.length} grupos`);
    for (const x of items) console.log(`   · ${x.g.id} → ${x.n} alumno(s)  modulosIds=[${(x.g.modulosIds || []).length}]`);

    if (conAlumnos.length === 0) { console.log('   ⚠ Todos vacíos: no se toca (ambiguo).'); continue; }
    if (vacios.length === 0) { console.log('   ⚠ Todos con alumnos: no se toca (revisar a mano).'); continue; }

    // Superviviente = el de más alumnos
    const survivor = conAlumnos.sort((a, b) => b.n - a.n)[0].g;
    if (!updatesSurvivor.has(survivor.id)) updatesSurvivor.set(survivor.id, new Set(survivor.modulosIds || []));
    const mods = updatesSurvivor.get(survivor.id);

    for (const v of vacios) {
      for (const mid of (v.g.modulosIds || [])) mods.add(mid);
      aBorrar.push({ empty: v.g, survivorId: survivor.id });
      console.log(`   ✓ Conservar ${survivor.id} (${survivor.n ?? ''} alumnos) · BORRAR vacío ${v.g.id}; sus módulos pasan al superviviente`);
    }
  }

  if (aBorrar.length === 0) { console.log('\nNo hay grupos vacíos duplicados que borrar.'); return; }

  // Backup de los grupos que se van a borrar (y del estado de los supervivientes)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = resolve(process.cwd(), `grupos-borrados-backup-${stamp}.json`);
  const survivorsBackup = [...updatesSurvivor.keys()].map(id => grupos.find(g => g.id === id)).map(({ ref, ...g }) => g);
  writeFileSync(backupFile, JSON.stringify({
    borrados: aBorrar.map(x => { const { ref, ...g } = x.empty; return g; }),
    supervivientes_antes: survivorsBackup
  }, null, 2), 'utf8');
  console.log(`\nCopia de seguridad: ${backupFile}`);
  console.log(`Resumen: ${aBorrar.length} grupo(s) vacío(s) a borrar.`);

  if (!COMMIT) { console.log('DRY-RUN: no se ha borrado nada. Si el listado es correcto, repite con --commit.'); return; }

  // 1) Actualizar modulosIds de los supervivientes
  for (const [survId, set] of updatesSurvivor) {
    const survRef = grupos.find(g => g.id === survId).ref;
    await survRef.update({ modulosIds: Array.from(set) });
  }
  // 2) Borrar los grupos vacíos
  let i = 0;
  while (i < aBorrar.length) {
    const batch = db.batch();
    for (const x of aBorrar.slice(i, i + 400)) batch.delete(x.empty.ref);
    await batch.commit();
    i += 400;
  }

  console.log(`\n✓ Borrados ${aBorrar.length} grupo(s) vacío(s). modulosIds traspasados a los supervivientes.`);
  console.log(`  Copia de seguridad: ${backupFile}`);
  console.log('  Revisa el panel: DBDR, PROI y APIN deben emparejarse ahora con el 2SM2 que tiene alumnos.');
}

main().catch(e => {
  if (e && (e.code === 16 || /UNAUTHENTICATED/.test(e.message || ''))) {
    console.error('\n✗ Credenciales rechazadas (UNAUTHENTICATED). Usa una clave válida del proyecto correcto.');
  } else { console.error(e); }
  process.exit(1);
});
