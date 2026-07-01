// ============================================================
//  limpiar-calificaciones-huerfanas-dwec.mjs
//  Borra de la colección 'calificaciones' los documentos de DWEC/DAW2 cuyo
//  alumnoId YA NO pertenece al grupo (alumnos borrados/recreados). Son los
//  que aparecen como IDs sueltos en las actas (p. ej. "an3wpRKUUk93GecmuLr3").
//
//  SOLO afecta a calificaciones del módulo DWEC y grupo DAW2.
//
//  Uso:
//    node scripts/limpiar-calificaciones-huerfanas-dwec.mjs           (simulación)
//    node scripts/limpiar-calificaciones-huerfanas-dwec.mjs --apply   (aplicar)
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // IDs de alumnos válidos del grupo
  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const idsValidos = new Set(alSnap.docs.map(d => d.id));
  console.log(`Alumnos válidos en el grupo: ${idsValidos.size}`);

  // Calificaciones de DWEC/DAW2
  const calSnap = await db.collection('calificaciones').where('moduloId', '==', modulo.id).get();
  const delGrupo = calSnap.docs.filter(d => d.data().grupoId === grupo.id);
  console.log(`Calificaciones de DWEC/DAW2: ${delGrupo.length}`);

  // Huérfanas: su alumnoId no está entre los válidos
  const huerfanas = delGrupo.filter(d => !idsValidos.has(d.data().alumnoId));
  console.log(`\nHuérfanas detectadas: ${huerfanas.length}`);
  huerfanas.forEach(d => {
    const c = d.data();
    console.log(`  · ${c.evaluacion || '?'} · alumnoId=${c.alumnoId} · nota=${c.notaFinal ?? '-'}`);
  });

  if (huerfanas.length === 0) { console.log('\nNada que limpiar. ✓'); return; }

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha borrado nada. Añade --apply para eliminarlas.');
    return;
  }

  let borradas = 0;
  for (const d of huerfanas) { await d.ref.delete(); borradas++; }
  console.log(`\n✓ Borradas ${borradas} calificaciones huérfanas.`);
  console.log('  Las actas (Informes y panel) mostrarán ya solo los 14 alumnos del grupo.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
