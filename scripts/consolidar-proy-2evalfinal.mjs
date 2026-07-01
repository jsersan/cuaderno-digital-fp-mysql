// ============================================================
//  consolidar-proy-2evalfinal.mjs
//  Consolida las calificaciones del módulo de Proyecto (PROY) de DAW2
//  en la 2ª Evaluación Final, con la lógica real del módulo:
//
//   - Los alumnos APROBADOS en la 1ª Evaluación Final ARRASTRAN su nota
//     tal cual a la 2ª Evaluación Final (no se reevalúan).
//   - Los alumnos SUSPENSOS en la 1ª Eval Final se evalúan con la nota de
//     su RECUPERACIÓN (acotada a la nota máxima de recuperación, normalmente 6).
//       · Si aún no tienen nota de recuperación, se deja su calificación de
//         2ª Eval Final como NO presentada/pendiente (notaFinal = nota de
//         recuperación si existe; si no, se marca necesitaRecuperacion).
//
//  Lee:  calificaciones (1ª Evaluación Final) + recuperaciones (2ª Eval Final)
//  Escribe: calificaciones (2ª Evaluación Final), una por alumno.
//
//  Uso:
//    node scripts/consolidar-proy-2evalfinal.mjs          (simulación)
//    node scripts/consolidar-proy-2evalfinal.mjs --apply  (aplicar)
// ============================================================

import { db, resolverModuloProy, resolverGrupoDaw2, CURSO_ACADEMICO } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const EVAL_1F = '1ª Evaluación Final';
const EVAL_2F = '2ª Evaluación Final';
const NOTA_MINIMA = 5;

function clamp(n) { return Math.max(0, Math.min(10, Math.round((n ?? 0) * 10) / 10)); }

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // 1) Calificaciones de la 1ª Evaluación Final
  const calSnap = await db.collection('calificaciones')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();
  const cals1F = calSnap.docs.map(d => ({ _id: d.id, _ref: d.ref, ...d.data() }))
    .filter(c => c.evaluacion === EVAL_1F);

  if (cals1F.length === 0) {
    console.log(`⚠️  No hay calificaciones en "${EVAL_1F}". Ejecuta antes calificar-proy-1evalfinal.mjs --apply`);
    return;
  }

  // 2) Notas de recuperación (2ª Eval Final) por alumno
  const recSnap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();
  const recs = recSnap.docs.map(d => d.data()).filter(r => r.evaluacion === EVAL_2F);

  // Mapa alumnoId -> { notaRecup, notaMax }
  const recupPorAlumno = {};
  recs.forEach(r => {
    (r.alumnosConvocados || []).forEach(a => {
      recupPorAlumno[a.alumnoId] = {
        notaRecup: a.notaRecuperacion,                 // puede ser undefined si aún no se ha calificado
        notaMax: r.notaMaximaRecuperacion ?? 6,
        estado: a.estado
      };
    });
  });

  // 3) Calcular la calificación de 2ª Eval Final por alumno
  console.log('\n=== Consolidación 2ª Evaluación Final ===');
  const resultados = [];
  for (const c of cals1F) {
    const aprobado1F = (c.notaFinal ?? 0) >= NOTA_MINIMA;
    let notaFinal2F;
    let origen;

    if (aprobado1F) {
      // Arrastra la nota de la 1ª Eval Final
      notaFinal2F = clamp(c.notaFinal);
      origen = 'arrastre 1ª EF';
    } else {
      // Suspenso: usar nota de recuperación (acotada al máximo de recuperación)
      const rec = recupPorAlumno[c.alumnoId];
      if (rec && rec.notaRecup != null) {
        notaFinal2F = clamp(Math.min(rec.notaRecup, rec.notaMax));
        origen = `recuperación (máx ${rec.notaMax})`;
      } else {
        // Sin nota de recuperación todavía: mantener la nota original (suspensa)
        notaFinal2F = clamp(c.notaFinal);
        origen = 'pendiente de recuperación';
      }
    }

    const aprobado2F = notaFinal2F >= NOTA_MINIMA;
    resultados.push({
      alumnoId: c.alumnoId,
      base: c,
      notaFinal2F,
      aprobado2F,
      origen
    });

    console.log(`  ${c.alumnoId}: 1ªEF=${c.notaFinal} → 2ªEF=${notaFinal2F} [${origen}] ${aprobado2F ? 'APTO' : 'NO APTO'}`);
  }

  const aprobados = resultados.filter(r => r.aprobado2F).length;
  console.log(`\nAprobados 2ª EF: ${aprobados} · Suspensos: ${resultados.length - aprobados}`);

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para guardar la 2ª Eval Final.');
    return;
  }

  // 4) Crear/actualizar la calificación de 2ª Eval Final por alumno
  const now = new Date();
  let creadas = 0, actualizadas = 0;
  for (const r of resultados) {
    const cal = {
      alumnoId: r.alumnoId,
      moduloId: modulo.id,
      grupoId: grupo.id,
      profesorId,
      cursoAcademico: CURSO_ACADEMICO,
      evaluacion: EVAL_2F,
      notaExamenes: 0,
      notaTareas: r.base.notaTareas ?? 0,
      notaActitud: r.base.notaActitud ?? 0,
      notaAsistencia: 0,
      notaCalculada: r.notaFinal2F,
      notaFinal: r.notaFinal2F,
      aprobado: r.aprobado2F,
      notasPorRA: [],
      necesitaRecuperacion: false,   // la 2ª Eval Final es la última convocatoria
      observaciones: r.origen,
      bloqueada: false,
      publicada: false,
      updatedAt: now
    };

    const existentes = await db.collection('calificaciones')
      .where('alumnoId', '==', r.alumnoId)
      .where('moduloId', '==', modulo.id)
      .get();
    const previa = existentes.docs.find(x => x.data().evaluacion === EVAL_2F);

    if (previa) { await previa.ref.update(cal); actualizadas++; }
    else { await db.collection('calificaciones').add({ ...cal, createdAt: now }); creadas++; }
  }

  console.log(`\n✓ Calificaciones 2ª Eval Final: ${creadas} creadas, ${actualizadas} actualizadas.`);
  console.log('  En la pantalla de Calificaciones selecciona "2ª Evaluación Final".');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
