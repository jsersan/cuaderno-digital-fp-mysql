// ============================================================
//  crear-recuperacion-proy-2evalfinal.mjs
//  Crea la recuperación del módulo de Proyecto (PROY) de DAW2 en la
//  2ª Evaluación Final, convocando a los alumnos que NO aprobaron en la
//  1ª Evaluación Final.
//
//  Lee la colección 'calificaciones' (evaluacion = '1ª Evaluación Final')
//  para saber quién suspendió, y crea un documento en 'recuperaciones'.
//
//  Uso:
//    node scripts/crear-recuperacion-proy-2evalfinal.mjs          (simulación)
//    node scripts/crear-recuperacion-proy-2evalfinal.mjs --apply  (aplicar)
//    node scripts/crear-recuperacion-proy-2evalfinal.mjs --apply --reset
//        (borra recuperaciones previas de PROY/DAW2 antes de crear)
// ============================================================

import { db, Timestamp, ts, resolverModuloProy, resolverGrupoDaw2 } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');

const EVAL_ORIGEN = '1ª Evaluación Final';
const EVAL_RECUP = '2ª Evaluación Final';
const FECHA_RECUP = '2026-06-22';      // dentro del periodo 2ª Eval Final (1–30 jun)
const NOTA_MINIMA = 5;
const NOTA_MAX_RECUP = 6;              // nota máxima alcanzable en recuperación

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Recuperación en: "${EVAL_RECUP}" (origen: "${EVAL_ORIGEN}")`);
  console.log('-----------------------------------------------------------');

  // Calificaciones de la 1ª Eval Final
  const calSnap = await db.collection('calificaciones')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();
  const cals = calSnap.docs.map(d => d.data()).filter(c => c.evaluacion === EVAL_ORIGEN);

  if (cals.length === 0) {
    console.log(`⚠️  No hay calificaciones en "${EVAL_ORIGEN}". Ejecuta antes calificar-proy-1evalfinal.mjs --apply`);
    return;
  }

  const suspensos = cals.filter(c => (c.notaFinal ?? 0) < NOTA_MINIMA || c.necesitaRecuperacion === true);
  console.log(`Calificaciones en "${EVAL_ORIGEN}": ${cals.length} · suspensos: ${suspensos.length}`);

  if (suspensos.length === 0) {
    console.log('No hay alumnos suspensos. No hace falta recuperación.');
    return;
  }

  // Nombres de los alumnos suspensos (para el array de convocados)
  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const nombrePorId = {};
  alSnap.docs.forEach(d => {
    const a = d.data();
    nombrePorId[d.id] = `${a.apellidos}, ${a.nombre}`;
  });

  const alumnosConvocados = suspensos.map(c => ({
    alumnoId: c.alumnoId,
    alumnoNombre: nombrePorId[c.alumnoId] || c.alumnoId,
    notaOriginal: c.notaFinal ?? 0,
    estado: 'convocado'
  }));

  console.log('\nAlumnos convocados a recuperación:');
  alumnosConvocados.forEach(a => console.log(`  ${a.alumnoNombre} (nota original: ${a.notaOriginal})`));

  if (RESET) {
    const prev = await db.collection('recuperaciones')
      .where('moduloId', '==', modulo.id)
      .where('grupoId', '==', grupo.id)
      .get();
    console.log(`\n[RESET] Recuperaciones previas de PROY/DAW2: ${prev.size}`);
    if (APPLY && !prev.empty) {
      const b = db.batch();
      prev.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      console.log(`[RESET] Eliminadas ${prev.size} recuperaciones previas.`);
    }
  }

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para crear la recuperación.');
    return;
  }

  const now = new Date();
  const recuperacion = {
    titulo: 'Recuperación Proyecto (2ª Evaluación Final)',
    descripcion: 'Recuperación del módulo de Proyecto para el alumnado no apto en la 1ª Evaluación Final.',
    moduloId: modulo.id,
    grupoId: grupo.id,
    profesorId,
    evaluacion: EVAL_RECUP,
    tipoRecuperacion: 'trabajo',
    resultadosAprendizajeIds: [],
    criteriosEvaluacionIds: [],
    fecha: ts(FECHA_RECUP),
    fechaLimiteEntrega: ts(FECHA_RECUP),
    puntuacionMaxima: 10,
    notaMaximaRecuperacion: NOTA_MAX_RECUP,
    notaMinimaAprobado: NOTA_MINIMA,
    alumnosConvocados,
    publicada: true,
    resultadosPublicados: false,
    createdAt: now,
    updatedAt: now
  };

  const recRef = await db.collection('recuperaciones').add(recuperacion);
  console.log(`\n✓ Recuperación creada [${recRef.id}] en "${EVAL_RECUP}" con ${alumnosConvocados.length} convocados.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
