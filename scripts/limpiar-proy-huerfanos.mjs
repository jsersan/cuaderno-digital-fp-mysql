// ============================================================
//  limpiar-proy-huerfanos.mjs
//  Borra eventos_programacion y tareas HUÉRFANOS de los módulos de proyecto
//  duplicados/antiguos de SMR, sin tocar el cuaderno bueno (qjh + 6FizW6) ni
//  el resto de módulos (DASP, DBDR, APIN, PROY DAW...).
//
//  Huérfanos (según diagnóstico):
//    1) (qjh + EtI)  → datos viejos del PROI bueno en el grupo equivocado.
//    2) módulo lJ0d3 → PROI duplicado «Proyecto» (toda su data).
//    3) módulo FG3   → PROY duplicado «Proyecto» (toda su data).
//
//  Seguridad: dry-run por defecto, backup JSON antes de borrar, y una lista
//  de pares PROTEGIDOS que el script se NIEGA a tocar pase lo que pase.
//
//  Uso:
//    node scripts/limpiar-proy-huerfanos.mjs            # simula (no borra)
//    node scripts/limpiar-proy-huerfanos.mjs --apply    # borra de verdad
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

// ── Qué borrar ──────────────────────────────────────────────
// grupoId opcional: si está, solo borra ESE par (modulo+grupo); si no, todo el módulo.
const OBJETIVOS = [
  { moduloId: 'qjhDxHpiyGQcoTWHyNXJ', grupoId: 'EtIYPCvquwkb1BX4Fspm',
    motivo: 'PROI bueno en grupo EtI (ya movido a 6FizW6)' },
  { moduloId: 'lJ0d3IFKltKuCXdfNzNd',
    motivo: 'Módulo PROI duplicado «Proyecto»' },
  { moduloId: 'FG3sFdVErRh26V7YaIAE',
    motivo: 'Módulo PROY duplicado «Proyecto»' },
];

// ── Pares que JAMÁS se borran (cinturón y tirantes) ─────────
const PROTEGIDOS = new Set([
  'qjhDxHpiyGQcoTWHyNXJ|6FizW6wI8iHYzoSWCV8y', // PROI bueno (el cuaderno que ahora funciona)
  'D78x947gcFQnmcr66bz5|2O9LFMhQWHKVIZbIqmur', // PROY DAW bueno
]);
const MODULOS_PROTEGIDOS = new Set([
  '6e5boC0eBPYcMgGMT36r', // DASP
  'QHuGVLWrcpauTNXeYrH5', // DBDR
  'LWSdPfhSeQT24ZbB598I', // APIN
  'D78x947gcFQnmcr66bz5', // PROY DAW
  'qjhDxHpiyGQcoTWHyNXJ', // PROI bueno (solo se permite borrar su par con EtI, ver abajo)
]);

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };

async function recolectar(col, obj) {
  let q = db.collection(col).where('moduloId', '==', obj.moduloId);
  if (obj.grupoId) q = q.where('grupoId', '==', obj.grupoId);
  const snap = await q.get();
  // filtro de seguridad: nunca tocar pares protegidos
  return snap.docs.filter(d => {
    const g = d.data().grupoId;
    const par = `${obj.moduloId}|${g}`;
    if (PROTEGIDOS.has(par)) { console.log(C.r(`  ⛔ PROTEGIDO, se omite: ${par}`)); return false; }
    // si el módulo está protegido y NO hemos especificado grupo, no borrar (evita accidentes)
    if (!obj.grupoId && MODULOS_PROTEGIDOS.has(obj.moduloId)) {
      console.log(C.r(`  ⛔ módulo protegido sin grupo concreto, se omite: ${obj.moduloId}`)); return false;
    }
    return true;
  });
}

async function main() {
  console.log(C.a(`\n=== Limpieza de huérfanos de proyecto · ${APPLY ? 'APPLY (borra)' : 'DRY-RUN (no borra)'} ===`));
  console.log(`Proyecto: ${sa.project_id}\n`);

  const backup = { generado: new Date().toISOString(), borrados: { eventos_programacion: [], tareas: [] } };
  let totalEv = 0, totalTa = 0;
  const batch = db.batch();
  let enLote = 0;

  for (const obj of OBJETIVOS) {
    console.log(`• ${obj.moduloId}${obj.grupoId ? ' + ' + obj.grupoId : ' (todo el módulo)'}  — ${obj.motivo}`);
    for (const col of ['eventos_programacion', 'tareas']) {
      const docs = await recolectar(col, obj);
      console.log(`    ${col}: ${docs.length} a borrar`);
      for (const d of docs) {
        backup.borrados[col].push({ id: d.id, ...d.data() });
        if (APPLY) { batch.delete(d.ref); enLote++; }
      }
      if (col === 'eventos_programacion') totalEv += docs.length; else totalTa += docs.length;
    }
  }

  console.log(C.a(`\nResumen: ${totalEv} eventos + ${totalTa} tareas = ${totalEv + totalTa} documentos.`));

  // Backup
  if (totalEv + totalTa > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bpath = join(__dirname, `backup-huerfanos-${stamp}.json`);
    if (APPLY) { writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(C.g(`Backup guardado: ${bpath}`)); }
    else console.log(C.g(`(Backup se guardaría en: ${bpath})`));
  }

  if (!APPLY) {
    console.log(C.a('\nDRY-RUN: no se ha borrado nada. Repite con --apply para ejecutar.\n'));
    await admin.app().delete();
    return;
  }

  if (enLote > 0) { await batch.commit(); console.log(C.v(`\n✅ Borrados ${enLote} documentos huérfanos.\n`)); }
  else console.log(C.v('\nNada que borrar.\n'));

  await admin.app().delete();
}

main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
