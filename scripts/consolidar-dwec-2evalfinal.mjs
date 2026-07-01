// ============================================================
//  consolidar-dwec-2evalfinal.mjs
//  Consolida las calificaciones de DWEC (DAW2) en la 2ª Evaluación Final:
//   - Los APROBADOS en la 1ª Evaluación Final ARRASTRAN su nota tal cual.
//   - Los SUSPENSOS se evalúan con la nota de su RECUPERACIÓN (acotada al
//     máximo de recuperación, normalmente 6). Si no tienen nota de
//     recuperación todavía, se mantiene su nota (suspensa).
//
//  Lee:  calificaciones (1ª Eval Final) + recuperaciones (2ª Eval Final)
//  Escribe: calificaciones (2ª Eval Final), una por alumno.
//
//  Uso:
//    node scripts/consolidar-dwec-2evalfinal.mjs          (simulación)
//    node scripts/consolidar-dwec-2evalfinal.mjs --apply  (aplicar)
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2, CURSO_ACADEMICO, clamp } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const EVAL_1F = '1ª Evaluación Final';
const EVAL_2F = '2ª Evaluación Final';
const NOTA_MINIMA = 5;

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // 1) Calificaciones de la 1ª Eval Final
  const calSnap = await db.collection('calificaciones')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const cals1F = calSnap.docs.map(d => ({ _ref: d.ref, ...d.data() })).filter(c => c.evaluacion === EVAL_1F);
  if (cals1F.length === 0) {
    console.log(`⚠️  No hay calificaciones en "${EVAL_1F}". Ejecuta antes calificar-dwec.mjs --eval "${EVAL_1F}" --apply`);
    return;
  }

  // 2) Recuperaciones de la 2ª Eval Final
  const recSnap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const recs = recSnap.docs.map(d => d.data()).filter(r => r.evaluacion === EVAL_2F);
  const recupPorAlumno = {};
  recs.forEach(r => (r.alumnosConvocados || []).forEach(a => {
    recupPorAlumno[a.alumnoId] = { notaRecup: a.notaRecuperacion, notaMax: r.notaMaximaRecuperacion ?? 6, estado: a.estado };
  }));

  // 3) Calcular 2ª Eval Final por alumno
  console.log('\n=== Consolidación 2ª Evaluación Final ===');
  const resultados = [];
  for (const c of cals1F) {
    const aprobado1F = (c.notaFinal ?? 0) >= NOTA_MINIMA;
    let notaFinal2F, origen;
    if (aprobado1F) {
      notaFinal2F = clamp(c.notaFinal); origen = 'arrastre 1ª EF';
    } else {
      const rec = recupPorAlumno[c.alumnoId];
      if (rec && rec.notaRecup != null) { notaFinal2F = clamp(Math.min(rec.notaRecup, rec.notaMax)); origen = `recuperación (máx ${rec.notaMax})`; }
      else { notaFinal2F = clamp(c.notaFinal); origen = 'pendiente de recuperación'; }
    }
    const aprobado2F = notaFinal2F >= NOTA_MINIMA;
    resultados.push({ base: c, notaFinal2F, aprobado2F, origen });
    console.log(`  ${c.alumnoId}: 1ªEF=${c.notaFinal} → 2ªEF=${notaFinal2F} [${origen}] ${aprobado2F ? 'APTO' : 'NO APTO'}`);
  }
  const aprobados = resultados.filter(r => r.aprobado2F).length;
  console.log(`\nAprobados 2ª EF: ${aprobados} · Suspensos: ${resultados.length - aprobados}`);

  if (!APPLY) { console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para guardar.'); return; }

  const now = new Date();
  let creadas = 0, actualizadas = 0;
  for (const r of resultados) {
    const cal = {
      alumnoId: r.base.alumnoId, moduloId: modulo.id, grupoId: grupo.id, profesorId,
      cursoAcademico: CURSO_ACADEMICO, evaluacion: EVAL_2F,
      notaExamenes: r.base.notaExamenes ?? 0, notaTareas: r.base.notaTareas ?? 0,
      notaActitud: r.base.notaActitud ?? 0, notaAsistencia: r.base.notaAsistencia ?? 0,
      notaCalculada: r.notaFinal2F, notaFinal: r.notaFinal2F, aprobado: r.aprobado2F,
      notasPorRA: [], necesitaRecuperacion: false, observaciones: r.origen,
      bloqueada: false, publicada: false, updatedAt: now
    };
    const existentes = await db.collection('calificaciones')
      .where('alumnoId', '==', r.base.alumnoId).where('moduloId', '==', modulo.id).get();
    const previa = existentes.docs.find(x => x.data().evaluacion === EVAL_2F);
    if (previa) { await previa.ref.update(cal); actualizadas++; }
    else { await db.collection('calificaciones').add({ ...cal, createdAt: now }); creadas++; }
  }
  console.log(`\n✓ Calificaciones 2ª Eval Final: ${creadas} creadas, ${actualizadas} actualizadas.`);
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
