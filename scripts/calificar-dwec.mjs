// ============================================================
//  calificar-dwec.mjs
//  Genera calificaciones de prueba REALISTAS para el módulo DWEC (DAW2)
//  en la evaluación que se indique. ~27% de suspensos (4 de 14).
//
//  Ponderación de la nota final (igual que el panel de Calificaciones):
//    Examen 60% · Tareas 20% · Actitud 10% · Asistencia 10%
//    · Si el alumno supera el 10% de faltas, pierde el punto de asistencia.
//
//  Qué hace:
//   1) Rellena las entregas (array 'entregas') de cada tarea de la evaluación
//      con una nota por alumno (estado 'corregida'), coherente con su nivel.
//   2) Rellena las calificaciones (array 'calificaciones') de cada examen de
//      la evaluación con la nota por alumno.
//   3) Crea/actualiza el documento de 'calificaciones' por alumno con el
//      desglose (notaTareas, notaExamenes, notaActitud, notaAsistencia) y la
//      nota final ponderada.
//
//  La asistencia (notaAsistencia y faltas) se toma de lo que haya en
//  'asistencia_mensual'; conviene ejecutar antes generar-asistencia-dwec.mjs.
//
//  Uso:
//    node scripts/calificar-dwec.mjs --eval "1ª Evaluación"            (simulación)
//    node scripts/calificar-dwec.mjs --eval "1ª Evaluación" --apply    (aplicar)
//    node scripts/calificar-dwec.mjs --eval "2ª Evaluación" --apply
// ============================================================

import { db, Timestamp, resolverModuloDwec, resolverGrupoDaw2, CURSO_ACADEMICO, clamp, nivelesPorAlumno } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const NOTA_MINIMA = 5;

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
const EVAL = arg('--eval') || '1ª Evaluación';

// Lee de asistencia_mensual el % de faltas por alumno para decidir el punto de asistencia
async function faltasPorAlumno(moduloId, grupoId) {
  const out = {}; let totalDiasLectivos = 0;
  try {
    const snap = await db.collection('asistencia_mensual')
      .where('grupoId', '==', grupoId).where('moduloId', '==', moduloId).get();
    snap.forEach(d => {
      const data = d.data();
      const faltas = data.faltas || {};
      const anio = data.anio, mes = (data.mes || 1) - 1;
      if (anio != null && mes != null) {
        const numDias = new Date(anio, mes + 1, 0).getDate();
        for (let dia = 1; dia <= numDias; dia++) {
          const dow = new Date(anio, mes, dia).getDay();
          if (dow !== 0 && dow !== 6) totalDiasLectivos++;
        }
      }
      for (const [alumnoId, dias] of Object.entries(faltas)) {
        if (!out[alumnoId]) out[alumnoId] = { i: 0, j: 0 };
        const vals = Object.values(dias);
        out[alumnoId].i += vals.filter(v => v === 'I').length;
        out[alumnoId].j += vals.filter(v => v === 'J').length;
      }
    });
  } catch { /* sin datos */ }
  return { out, totalDiasLectivos };
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Evaluación: "${EVAL}"`);
  console.log('-----------------------------------------------------------');

  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));
  console.log(`Alumnos en el grupo: ${alumnos.length}`);

  const nivelDe = nivelesPorAlumno(alumnos);

  // Tareas y exámenes de la evaluación
  const tSnap = await db.collection('tareas').where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const tareas = tSnap.docs.filter(d => d.data().evaluacion === EVAL);
  const eSnap = await db.collection('examenes').where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const examenes = eSnap.docs.filter(d => d.data().evaluacion === EVAL);
  console.log(`Tareas en "${EVAL}": ${tareas.length} · Exámenes: ${examenes.length}`);

  // Asistencia: % de faltas por alumno
  const { out: faltas, totalDiasLectivos } = await faltasPorAlumno(modulo.id, grupo.id);

  // Nota por alumno para una tarea/examen concreto (varía ±0.5 según el índice)
  const notaItem = (nivel, idx) => clamp(nivel + (((idx % 3) - 1) * 0.5));

  console.log('\n=== Vista previa ===');
  const resumen = [];
  for (const a of alumnos) {
    const nivel = nivelDe[a.id];

    // Media de tareas
    let st = 0, ct = 0;
    tareas.forEach((d, idx) => { st += notaItem(nivel, idx); ct++; });
    const notaTareas = ct ? clamp(st / ct) : 0;

    // Media de exámenes
    let se = 0, ce = 0;
    examenes.forEach((d, idx) => { se += notaItem(nivel, idx); ce++; });
    const notaExamenes = ce ? clamp(se / ce) : clamp(nivel); // si no hay exámenes, usa el nivel

    // Actitud: algo mejor que el nivel
    const notaActitud = clamp(Math.min(10, nivel + 1));

    // Asistencia: 10 salvo que supere el 10% de faltas → pierde el punto (0)
    const f = faltas[a.id] || { i: 0, j: 0 };
    const totalFaltas = f.i + f.j;
    const pctFaltas = totalDiasLectivos > 0 ? (totalFaltas / totalDiasLectivos) * 100 : 0;
    const pierdePunto = pctFaltas > 10;
    const notaAsistencia = pierdePunto ? 0 : 10;

    // Nota final ponderada: examen 60 / tareas 20 / actitud 10 / asistencia 10
    // (actitud y asistencia van sobre 10; se escalan a su peso)
    const notaFinal = clamp(
      notaExamenes * 0.6 +
      notaTareas * 0.2 +
      notaActitud * 0.1 +
      notaAsistencia * 0.1
    );
    const aprobado = notaFinal >= NOTA_MINIMA;

    resumen.push({ a, notaTareas, notaExamenes, notaActitud, notaAsistencia, totalFaltas, pierdePunto, notaFinal, aprobado });
    console.log(`  ${a.apellidos}, ${a.nombre}: ex=${notaExamenes} tar=${notaTareas} act=${notaActitud} asist=${notaAsistencia}${pierdePunto ? '(-1)' : ''} final=${notaFinal} ${aprobado ? 'APTO' : 'NO APTO'}`);
  }
  const suspensos = resumen.filter(r => !r.aprobado).length;
  console.log(`\nAprobados: ${resumen.length - suspensos} · Suspensos: ${suspensos} (${Math.round(suspensos / resumen.length * 100)}%)`);

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para guardar.');
    return;
  }

  const now = new Date();

  // 1) Entregas de cada tarea
  for (const d of tareas) {
    const t = d.data();
    const idx = tareas.indexOf(d);
    const entregas = alumnos.map(a => {
      const nota = notaItem(nivelDe[a.id], idx);
      return {
        alumnoId: a.id, alumnoNombre: `${a.apellidos}, ${a.nombre}`,
        fechaEntrega: t.fechaEntrega || Timestamp.now(), estado: 'corregida',
        nota, feedback: '', corregidoPor: profesorId, fechaCorreccion: Timestamp.now(), archivos: []
      };
    });
    await d.ref.update({ entregas, updatedAt: now });
  }
  console.log(`✓ Entregas rellenadas en ${tareas.length} tareas.`);

  // 2) Calificaciones de cada examen
  for (const d of examenes) {
    const ex = d.data();
    const idx = examenes.indexOf(d);
    const notaMin = ex.notaMinimaAprobado ?? 5;
    const calificaciones = alumnos.map(a => {
      const nota = notaItem(nivelDe[a.id], idx);
      return {
        alumnoId: a.id, alumnoNombre: `${a.apellidos}, ${a.nombre}`,
        nota, observaciones: '', noPresente: false,
        necesitaRecuperacion: nota < notaMin
      };
    });
    await d.ref.update({ calificaciones, updatedAt: now });
  }
  console.log(`✓ Calificaciones rellenadas en ${examenes.length} exámenes.`);

  // 3) Documento de calificaciones por alumno
  let creadas = 0, actualizadas = 0;
  for (const r of resumen) {
    const cal = {
      alumnoId: r.a.id, moduloId: modulo.id, grupoId: grupo.id, profesorId,
      cursoAcademico: CURSO_ACADEMICO, evaluacion: EVAL,
      notaExamenes: r.notaExamenes, notaTareas: r.notaTareas,
      notaActitud: r.notaActitud, notaAsistencia: r.notaAsistencia,
      faltas: r.totalFaltas, pierdePuntoAsistencia: r.pierdePunto,
      notaCalculada: r.notaFinal, notaFinal: r.notaFinal, aprobado: r.aprobado,
      notasPorRA: [], necesitaRecuperacion: !r.aprobado,
      bloqueada: false, publicada: false, updatedAt: now
    };
    const existentes = await db.collection('calificaciones')
      .where('alumnoId', '==', r.a.id).where('moduloId', '==', modulo.id).get();
    const previa = existentes.docs.find(x => x.data().evaluacion === EVAL);
    if (previa) { await previa.ref.update(cal); actualizadas++; }
    else { await db.collection('calificaciones').add({ ...cal, createdAt: now }); creadas++; }
  }
  console.log(`✓ Calificaciones por alumno: ${creadas} creadas, ${actualizadas} actualizadas.`);
  console.log(`  En la pantalla de Calificaciones selecciona "${EVAL}".`);
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
