// ============================================================
//  crear-examenes-ud-dwec.mjs
//  Para el módulo DWEC (DAW2): crea UN EXAMEN por cada Unidad Didáctica
//  (eventos de programación de tipo 'tema'), EXCEPTO la UD de presentación
//  (UD0 / "Presentación..."). Cada examen:
//    - queda vinculado a su UD (unidadId) y hereda su evaluación y fecha,
//    - se califica con notas coherentes con el nivel de cada alumno
//      (~27% de suspensos según los niveles del helper),
//    - genera su RECUPERACIÓN con los alumnos suspensos convocados.
//
//  Así habrá exámenes y recuperaciones en todas las evaluaciones que tengan
//  UDs, y en el PDF del cuaderno saldrán agrupados por unidad didáctica.
//
//  Uso:
//    node scripts/crear-examenes-ud-dwec.mjs           (simulación)
//    node scripts/crear-examenes-ud-dwec.mjs --apply   (aplicar)
//
//  Nota: si vuelves a ejecutarlo, NO duplica: detecta el examen de cada UD
//  por unidadId y lo actualiza en vez de crear otro.
// ============================================================

import { db, Timestamp, resolverModuloDwec, resolverGrupoDaw2, CURSO_ACADEMICO, clamp, nivelesPorAlumno } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const NOTA_MAX = 10;
const NOTA_MIN = 5;
const NOTA_MAX_RECUP = 6;

// ¿Es la UD de presentación? (se salta)
function esPresentacion(titulo) {
  const t = (titulo || '').toLowerCase();
  return t.includes('presentaci') || /\bud\s*0\b/.test(t) || t.startsWith('ud0');
}

function fechaDe(ev) {
  // fecha del examen = fecha de inicio de la UD (o fin si existe), o ahora
  const f = ev.fechaInicio || ev.fechaFin;
  return f && f.toDate ? f.toDate() : new Date();
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // Alumnos
  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));
  const nivelDe = nivelesPorAlumno(alumnos);

  // Unidades didácticas (eventos 'tema'), ordenadas por fecha
  const evSnap = await db.collection('eventos_programacion')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  let unidades = evSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.tipo === 'tema');
  unidades.sort((a, b) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0));

  // Quitar la de presentación
  const conPresentacion = unidades.length;
  unidades = unidades.filter(u => !esPresentacion(u.titulo));
  console.log(`Unidades didácticas: ${conPresentacion} (se examinan ${unidades.length}, se salta la de presentación)`);
  if (unidades.length === 0) {
    console.log('⚠️  No hay UDs examinables. Crea las Unidades Didácticas en Programación primero.');
    return;
  }

  // Exámenes ya existentes (para no duplicar): mapa unidadId -> doc
  const exSnap = await db.collection('examenes')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const examenPorUnidad = {};
  exSnap.docs.forEach(d => { const u = d.data().unidadId; if (u) examenPorUnidad[u] = d; });

  // Recuperaciones existentes: mapa examenId -> doc
  const recSnap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const recPorExamen = {};
  recSnap.docs.forEach(d => { const e = d.data().examenOriginalId; if (e) recPorExamen[e] = d; });

  const notaItem = (nivel, idx) => clamp(nivel + (((idx % 3) - 1) * 0.5));
  const now = new Date();

  console.log('\n=== Plan de exámenes por UD ===');
  let creados = 0, actualizados = 0, recuperacionesCreadas = 0;

  for (let i = 0; i < unidades.length; i++) {
    const ud = unidades[i];
    const fecha = fechaDe(ud);
    const titulo = `Examen ${ud.titulo}`;

    // Calificaciones de este examen
    const calificaciones = alumnos.map(a => {
      const nota = notaItem(nivelDe[a.id], i);
      return {
        alumnoId: a.id, alumnoNombre: `${a.apellidos}, ${a.nombre}`,
        nota, observaciones: '', noPresente: false,
        necesitaRecuperacion: nota < NOTA_MIN
      };
    });
    const suspensos = calificaciones.filter(c => c.nota < NOTA_MIN);

    console.log(`  ${ud.evaluacion} · ${ud.titulo}: examen "${titulo}" (${fecha.toLocaleDateString('es-ES')}) · ${suspensos.length} suspensos`);

    if (!APPLY) continue;

    // 1) Crear o actualizar el examen vinculado a la UD
    const examenData = {
      titulo, descripcion: `Examen de la unidad: ${ud.titulo}`,
      moduloId: modulo.id, grupoId: grupo.id, profesorId,
      cursoAcademico: CURSO_ACADEMICO, evaluacion: ud.evaluacion,
      unidadId: ud.id, tipo: 'parcial',
      fecha: Timestamp.fromDate(fecha), horaInicio: '08:30', horaFin: '10:20',
      aula: grupo.aula || '', duracionMinutos: 110,
      puntuacionMaxima: NOTA_MAX, notaMinimaAprobado: NOTA_MIN, porcentajeNotaFinal: 0,
      permiteRecuperacion: true, publicado: true, resultadosPublicados: false,
      tienePonderacion: false, calificaciones,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [], updatedAt: now
    };

    let examenId;
    const previo = examenPorUnidad[ud.id];
    if (previo) { await previo.ref.update(examenData); examenId = previo.id; actualizados++; }
    else { const ref = await db.collection('examenes').add({ ...examenData, createdAt: now }); examenId = ref.id; creados++; }

    // 2) Crear/actualizar la recuperación con los suspensos convocados
    const convocados = suspensos.map(c => ({
      alumnoId: c.alumnoId, alumnoNombre: c.alumnoNombre,
      notaOriginal: c.nota, notaRecuperacion: null, estado: 'convocado'
    }));

    const recData = {
      titulo: `Recuperación: ${titulo}`,
      moduloId: modulo.id, grupoId: grupo.id, profesorId,
      cursoAcademico: CURSO_ACADEMICO, evaluacion: ud.evaluacion,
      unidadId: ud.id, examenOriginalId: examenId,
      tipoRecuperacion: 'examen',
      fecha: Timestamp.fromDate(new Date(fecha.getTime() + 7 * 86400000)), // +1 semana
      puntuacionMaxima: NOTA_MAX, notaMaximaRecuperacion: NOTA_MAX_RECUP, notaMinimaAprobado: NOTA_MIN,
      alumnosConvocados: convocados, publicada: true, resultadosPublicados: false,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [], updatedAt: now
    };

    if (convocados.length > 0) {
      const previaRec = recPorExamen[examenId];
      if (previaRec) { await previaRec.ref.update(recData); }
      else { await db.collection('recuperaciones').add({ ...recData, createdAt: now }); recuperacionesCreadas++; }
      // Vincular el examen con su recuperación
      // (si la recuperación es nueva no tenemos su id aquí sin releer; se vincula por examenOriginalId)
    }
  }

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para crear exámenes y recuperaciones.');
    return;
  }

  console.log(`\n✓ Exámenes: ${creados} creados, ${actualizados} actualizados.`);
  console.log(`✓ Recuperaciones nuevas: ${recuperacionesCreadas}.`);
  console.log('  Después, ejecuta calificar-recuperacion-dwec.mjs --eval "<evaluación>" --apply para poner notas a las recuperaciones,');
  console.log('  y calificar-dwec.mjs --eval "<evaluación>" --apply para recalcular las notas finales con estos exámenes.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
