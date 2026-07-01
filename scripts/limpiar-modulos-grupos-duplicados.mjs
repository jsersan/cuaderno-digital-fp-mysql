// ============================================================
//  limpiar-modulos-grupos-duplicados.mjs
//  Elimina los DOCS vacíos de módulos de proyecto duplicados y grupos
//  auxiliares de SMR que despistan a los seeds. Verifica que cada doc está
//  REALMENTE vacío antes de borrarlo; si no, lo salta.
//
//  Borra (si están vacíos):
//    Módulos: lJ0d3 (PROI «Proyecto»), FG3 (PROY «Proyecto»)
//    Grupos : EtI, PuFIWchb, MESWcu  (SM2 auxiliares, sin alumnos)
//
//  Seguridad: dry-run por defecto · backup JSON · lista de PROTEGIDOS ·
//  verificación de vacío por documento · guard extra para EtI.
//
//  Uso:
//    node scripts/limpiar-modulos-grupos-duplicados.mjs           # simula
//    node scripts/limpiar-modulos-grupos-duplicados.mjs --apply   # borra
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };

// ── Qué eliminar ─────────────────────────────────────────────
const MODULOS = [
  { id: 'lJ0d3IFKltKuCXdfNzNd', nombre: 'PROI «Proyecto» (duplicado)' },
  { id: 'FG3sFdVErRh26V7YaIAE', nombre: 'PROY «Proyecto» (duplicado)' },
];
const GRUPOS = [
  { id: 'PuFIWchb1TJ7SGEpxvUG', nombre: 'SM2 aux (enlazaba lJ0d3)' },
  { id: 'MESWcuGHQO6yP7rxwFKh', nombre: 'SM2 aux (enlazaba FG3)' },
  { id: 'EtIYPCvquwkb1BX4Fspm', nombre: 'SM2 aux (enlazaba qjh; la app usa 6FizW6)' },
];

// ── Nunca tocar ──────────────────────────────────────────────
const PROTEGIDOS = new Set([
  'qjhDxHpiyGQcoTWHyNXJ',          // PROI bueno
  '6FizW6wI8iHYzoSWCV8y',          // SM2 activo (lo lee la app)
  'D78x947gcFQnmcr66bz5',          // PROY DAW
  '2O9LFMhQWHKVIZbIqmur',          // 2AW3 bueno
  '6e5boC0eBPYcMgGMT36r',          // DASP
  'QHuGVLWrcpauTNXeYrH5',          // DBDR
  'LWSdPfhSeQT24ZbB598I',          // APIN
  '94Xc7HWat6IQ953lL6Gd',          // SM2 con datos de APIN
  'B4PNtFT3737bsGJnjhof',          // SM2 con datos de APIN
]);

const QJH = 'qjhDxHpiyGQcoTWHyNXJ';
const SM2_BUENO = '6FizW6wI8iHYzoSWCV8y';

async function cuenta(col, campo, val) {
  return (await db.collection(col).where(campo, '==', val).get()).size;
}

async function main() {
  console.log(C.a(`\n=== Eliminar módulos/grupos duplicados · ${APPLY ? 'APPLY (borra)' : 'DRY-RUN (no borra)'} ===`));
  console.log(`Proyecto: ${sa.project_id}\n`);

  const backup = { generado: new Date().toISOString(), modulos: [], grupos: [] };
  const aBorrar = { modulos: [], grupos: [] };

  // Guard extra: el cuaderno bueno (qjh+6FizW6) debe tener datos; si no, abortamos por seguridad.
  const buenoEv = (await db.collection('eventos_programacion').where('moduloId','==',QJH).where('grupoId','==',SM2_BUENO).get()).size;
  const buenoTa = (await db.collection('tareas').where('moduloId','==',QJH).where('grupoId','==',SM2_BUENO).get()).size;
  console.log(C.g(`Comprobación previa · cuaderno bueno qjh+6FizW6: ${buenoEv} eventos, ${buenoTa} tareas`));
  if (buenoEv === 0 && buenoTa === 0) {
    console.log(C.r('\n⛔ El cuaderno bueno parece vacío. Abortando por seguridad (¿seguro que lanzaste el seed en 6FizW6?).\n'));
    await admin.app().delete();
    return;
  }

  // ── MÓDULOS ──
  console.log(C.a('\nMÓDULOS:'));
  for (const m of MODULOS) {
    if (PROTEGIDOS.has(m.id)) { console.log(C.r(`  ⛔ PROTEGIDO, se omite: ${m.id}`)); continue; }
    const ev = await cuenta('eventos_programacion', 'moduloId', m.id);
    const ta = await cuenta('tareas', 'moduloId', m.id);
    const doc = await db.collection('modulos').doc(m.id).get();
    if (!doc.exists) { console.log(C.g(`  · ${m.id} ya no existe.`)); continue; }
    if (ev > 0 || ta > 0) { console.log(C.r(`  ⛔ ${m.nombre}: tiene datos (${ev} ev, ${ta} ta) → NO se borra. Pasa antes limpiar-proy-huerfanos.`)); continue; }
    console.log(C.v(`  ✓ ${m.nombre} (${m.id}) vacío → se borrará.`));
    backup.modulos.push({ id: m.id, ...doc.data() });
    aBorrar.modulos.push(m.id);
  }

  // ── GRUPOS ──
  console.log(C.a('\nGRUPOS:'));
  for (const g of GRUPOS) {
    if (PROTEGIDOS.has(g.id)) { console.log(C.r(`  ⛔ PROTEGIDO, se omite: ${g.id}`)); continue; }
    const doc = await db.collection('grupos').doc(g.id).get();
    if (!doc.exists) { console.log(C.g(`  · ${g.id} ya no existe.`)); continue; }
    const data = doc.data();
    const nAl = (data.alumnosIds || []).length;
    const ev = await cuenta('eventos_programacion', 'grupoId', g.id);
    const ta = await cuenta('tareas', 'grupoId', g.id);
    if (nAl > 0 || ev > 0 || ta > 0) { console.log(C.r(`  ⛔ ${g.nombre}: no está vacío (${nAl} alumnos, ${ev} ev, ${ta} ta) → NO se borra.`)); continue; }
    console.log(C.v(`  ✓ ${g.nombre} (${g.id}) vacío → se borrará.`));
    backup.grupos.push({ id: g.id, ...data });
    aBorrar.grupos.push(g.id);
  }

  console.log(C.a(`\nResumen: ${aBorrar.modulos.length} módulos + ${aBorrar.grupos.length} grupos a eliminar.`));

  if (aBorrar.modulos.length + aBorrar.grupos.length === 0) {
    console.log(C.v('\nNada que borrar.\n')); await admin.app().delete(); return;
  }

  if (!APPLY) {
    console.log(C.a('\nDRY-RUN: no se ha borrado nada. Repite con --apply para ejecutar.\n'));
    await admin.app().delete(); return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bpath = join(__dirname, `backup-modulos-grupos-${stamp}.json`);
  writeFileSync(bpath, JSON.stringify(backup, null, 2));
  console.log(C.g(`Backup guardado: ${bpath}`));

  const batch = db.batch();
  for (const id of aBorrar.modulos) batch.delete(db.collection('modulos').doc(id));
  for (const id of aBorrar.grupos) batch.delete(db.collection('grupos').doc(id));
  await batch.commit();
  console.log(C.v(`\n✅ Eliminados ${aBorrar.modulos.length} módulos y ${aBorrar.grupos.length} grupos.\n`));

  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
