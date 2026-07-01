// ============================================================
//  reasignar-tareas-proy-1evalfinal.mjs
//  El módulo de Proyecto en DAW solo se evalúa en la 1ª Evaluación Final
//  (y recuperación en la 2ª Evaluación Final). Las tareas se crearon en
//  1ª Eval / 2ª Eval / 2ª Eval Final; este script las reasigna TODAS a
//  '1ª Evaluación Final', manteniendo sus fechas tal cual.
//
//  Uso:
//    node scripts/reasignar-tareas-proy-1evalfinal.mjs          (simulación)
//    node scripts/reasignar-tareas-proy-1evalfinal.mjs --apply  (aplicar)
// ============================================================

import { db, resolverModuloProy, resolverGrupoDaw2 } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const EVAL_DESTINO = '1ª Evaluación Final';  // valor del enum TipoEvaluacion

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Evaluación destino: "${EVAL_DESTINO}"`);
  console.log('-----------------------------------------------------------');

  const snap = await db.collection('tareas')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();

  if (snap.empty) {
    console.log('No hay tareas de PROY/DAW2. Nada que reasignar.');
    return;
  }

  const aCambiar = snap.docs.filter(d => d.data().evaluacion !== EVAL_DESTINO);
  console.log(`Tareas encontradas: ${snap.size} · a reasignar: ${aCambiar.length}`);
  snap.docs.forEach(d => {
    const t = d.data();
    const marca = t.evaluacion === EVAL_DESTINO ? '   (ya OK)' : ` → "${EVAL_DESTINO}"`;
    console.log(`  "${t.titulo}"  [${t.evaluacion}]${marca}`);
  });

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para reasignar.');
    return;
  }

  if (aCambiar.length === 0) {
    console.log('\nTodas las tareas ya están en la 1ª Evaluación Final.');
    return;
  }

  const batch = db.batch();
  aCambiar.forEach(d => batch.update(d.ref, { evaluacion: EVAL_DESTINO, updatedAt: new Date() }));
  await batch.commit();

  console.log(`\n✓ Reasignadas ${aCambiar.length} tareas a "${EVAL_DESTINO}".`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
