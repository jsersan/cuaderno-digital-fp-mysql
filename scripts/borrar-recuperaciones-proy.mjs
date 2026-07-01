// ============================================================
//  borrar-recuperaciones-proy.mjs
//  Elimina ÚNICAMENTE las recuperaciones del módulo PROY del grupo DAW2.
//
//  Uso:
//    node scripts/borrar-recuperaciones-proy.mjs          (modo simulación)
//    node scripts/borrar-recuperaciones-proy.mjs --apply  (borrado real)
// ============================================================

import { db, resolverModuloProy, resolverGrupoDaw2 } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // La colección 'recuperaciones' guarda moduloId y grupoId.
  // Filtramos por ambos para borrar solo las de PROY/DAW2.
  const snap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();

  if (snap.empty) {
    console.log('No hay recuperaciones para PROY/DAW2. Nada que borrar.');
    return;
  }

  console.log(`Se encontraron ${snap.size} recuperaciones:`);
  snap.docs.forEach(d => {
    const r = d.data();
    console.log(`  - "${r.titulo}" (${r.evaluacion || '—'})  [${d.id}]`);
  });

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha borrado nada. Ejecuta con --apply para borrar.');
    return;
  }

  // Borrado en lote
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  console.log(`\n✓ Eliminadas ${snap.size} recuperaciones de PROY/DAW2.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
