// ============================================================
//  calificar-proy-1evalfinal.mjs
//  Genera calificaciones de prueba REALISTAS para el módulo de Proyecto
//  (PROY) de DAW2 en la 1ª Evaluación Final.
//
//  Qué hace:
//   1) Rellena las entregas (array 'entregas') de cada tarea del módulo
//      con una nota por alumno (estado 'corregida').
//   2) Crea/actualiza el documento de 'calificaciones' por alumno con la
//      nota de tareas, actitud y la nota final calculada (ponderada por el
//      porcentajeNotaFinal de cada tarea). La mayoría aprueba; 2-3 suspenden.
//
//  El módulo de Proyecto no tiene exámenes, así que notaExamenes = 0 y la
//  nota final se basa en las tareas (+ actitud).
//
//  Uso:
//    node scripts/calificar-proy-1evalfinal.mjs          (simulación)
//    node scripts/calificar-proy-1evalfinal.mjs --apply  (aplicar)
// ============================================================

import { db, Timestamp, resolverModuloProy, resolverGrupoDaw2, CURSO_ACADEMICO } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const EVAL = '1ª Evaluación Final';
const NOTA_MINIMA = 5;

// Notas base por alumno (sobre 10) — realistas: mayoría aprueba, 2 suspenden.
// Se aplican como "nivel" del alumno; cada tarea varía ±0.5 alrededor de este nivel.
// El orden no importa: se asignan por orden alfabético de apellidos.
const NIVELES = [6.5, 7.0, 8.5, 4.0, 9.0, 5.5, 7.5, 3.5, 8.0, 6.0, 7.0, 5.0, 9.5, 6.5];
//                                  ↑suspende            ↑suspende

function clamp(n) { return Math.max(0, Math.min(10, Math.round(n * 10) / 10)); }

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Evaluación: "${EVAL}"`);
  console.log('-----------------------------------------------------------');

  // Alumnos del grupo (orden alfabético por apellidos)
  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));
  console.log(`Alumnos en el grupo: ${alumnos.length}`);

  // Tareas del módulo en esa evaluación
  const tSnap = await db.collection('tareas')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();
  const tareas = tSnap.docs.filter(d => d.data().evaluacion === EVAL);
  console.log(`Tareas en "${EVAL}": ${tareas.length}`);
  if (tareas.length === 0) {
    console.log('⚠️  No hay tareas en esa evaluación. Ejecuta antes reasignar-tareas-proy-1evalfinal.mjs --apply');
  }

  // Nivel por alumno
  const nivelDe = {};
  alumnos.forEach((a, i) => { nivelDe[a.id] = NIVELES[i] ?? 6.0; });

  // Vista previa de notas finales por alumno (ponderadas por % de cada tarea)
  console.log('\n=== Vista previa de notas finales (ponderadas) ===');
  const resumen = [];
  for (const a of alumnos) {
    const nivel = nivelDe[a.id];
    let sumaPond = 0, sumaPesos = 0;
    tareas.forEach((d, idx) => {
      const t = d.data();
      const peso = t.porcentajeNotaFinal || (100 / tareas.length);
      // variación determinista por tarea para que no sean todas idénticas
      const variacion = ((idx % 3) - 1) * 0.5; // -0.5, 0, +0.5
      const nota = clamp(nivel + variacion);
      sumaPond += nota * peso;
      sumaPesos += peso;
    });
    const notaTareas = sumaPesos > 0 ? clamp(sumaPond / sumaPesos) : 0;
    const actitud = clamp(Math.min(10, nivel + 1));   // actitud algo mejor que la media
    // Nota final del módulo de Proyecto: 90% tareas + 10% actitud (sin exámenes)
    const notaFinal = clamp(notaTareas * 0.9 + actitud * 0.1);
    const aprobado = notaFinal >= NOTA_MINIMA;
    resumen.push({ a, notaTareas, actitud, notaFinal, aprobado });
    console.log(`  ${a.apellidos}, ${a.nombre}: tareas=${notaTareas} actitud=${actitud} final=${notaFinal} ${aprobado ? 'APTO' : 'NO APTO'}`);
  }
  const suspensos = resumen.filter(r => !r.aprobado).length;
  console.log(`\nAprobados: ${resumen.length - suspensos} · Suspensos: ${suspensos}`);

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para guardar calificaciones.');
    return;
  }

  // 1) Rellenar entregas de cada tarea
  const now = new Date();
  for (const d of tareas) {
    const t = d.data();
    const entregas = alumnos.map((a, ai) => {
      const nivel = nivelDe[a.id];
      const idx = tareas.indexOf(d);
      const variacion = ((idx % 3) - 1) * 0.5;
      const nota = clamp(nivel + variacion);
      return {
        alumnoId: a.id,
        alumnoNombre: `${a.apellidos}, ${a.nombre}`,
        fechaEntrega: t.fechaEntrega || Timestamp.now(),
        estado: 'corregida',
        nota,
        feedback: '',
        corregidoPor: profesorId,
        fechaCorreccion: Timestamp.now(),
        archivos: []
      };
    });
    await d.ref.update({ entregas, updatedAt: now });
  }
  console.log(`✓ Entregas rellenadas en ${tareas.length} tareas.`);

  // 2) Crear/actualizar documento de calificaciones por alumno
  let creadas = 0, actualizadas = 0;
  for (const r of resumen) {
    const cal = {
      alumnoId: r.a.id,
      moduloId: modulo.id,
      grupoId: grupo.id,
      profesorId,
      cursoAcademico: CURSO_ACADEMICO,
      evaluacion: EVAL,
      notaExamenes: 0,            // Proyecto no tiene exámenes
      notaTareas: r.notaTareas,
      notaActitud: r.actitud,
      notaAsistencia: 0,
      notaCalculada: r.notaFinal,
      notaFinal: r.notaFinal,
      aprobado: r.aprobado,
      notasPorRA: [],
      necesitaRecuperacion: !r.aprobado,
      bloqueada: false,
      publicada: false,
      updatedAt: now
    };

    // ¿Existe ya una calificación de este alumno+módulo+evaluación?
    const existentes = await db.collection('calificaciones')
      .where('alumnoId', '==', r.a.id)
      .where('moduloId', '==', modulo.id)
      .get();
    const previa = existentes.docs.find(x => x.data().evaluacion === EVAL);

    if (previa) {
      await previa.ref.update(cal);
      actualizadas++;
    } else {
      await db.collection('calificaciones').add({ ...cal, createdAt: now });
      creadas++;
    }
  }

  console.log(`✓ Calificaciones: ${creadas} creadas, ${actualizadas} actualizadas.`);
  console.log(`  Recuerda: en la pantalla de Calificaciones selecciona "${EVAL}".`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
