// ============================================================
//  generar-asistencia-dwec.mjs
//  Genera faltas REALISTAS por alumno para DWEC (DAW2) en la colección
//  'asistencia_mensual', con un porcentaje de faltas parecido entre alumnos
//  pero con relación lógica respecto al nivel (los de nivel bajo faltan algo
//  más). La mayoría ronda el 95-100% de asistencia; unos pocos bajan del 90%.
//
//  Estructura de cada doc 'asistencia_mensual':
//    { grupoId, moduloId, anio, mes (1-12), faltas: { alumnoId: { "12": "I", ... } } }
//    Valores de falta: 'I' (injustificada) o 'J' (justificada).
//
//  Uso:
//    node scripts/generar-asistencia-dwec.mjs                 (simulación)
//    node scripts/generar-asistencia-dwec.mjs --apply         (aplicar)
//    node scripts/generar-asistencia-dwec.mjs --meses 2025-09,2025-10,2025-11 --apply
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }

// Meses a generar (por defecto, el primer trimestre del curso)
const MESES = (arg('--meses') || '2025-09,2025-10,2025-11').split(',').map(s => {
  const [a, m] = s.split('-').map(Number); return { anio: a, mes: m };
});

// Días lectivos (lun-vie) de un mes
function diasLectivos(anio, mes) {
  const dias = [];
  const n = new Date(anio, mes, 0).getDate(); // mes en base 1 → último día
  for (let d = 1; d <= n; d++) {
    const dow = new Date(anio, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) dias.push(d);
  }
  return dias;
}

// Nº de faltas objetivo por alumno, en PORCENTAJE del periodo, para que el
// resultado sea reproducible independientemente de los días lectivos.
//   - 2 alumnos con >20% de faltas (pierden la evaluación)
//   - 1 alumno entre 10% y 20% (pierde el punto de asistencia)
//   - el resto, pocas faltas (<8%)
// Se asignan por índice alfabético (mismos índices que los suspensos del
// helper para que haya relación lógica: quien falta mucho, peor nota).
//   idx 13 → 25% · idx 7 → 22% · idx 3 → 14% · resto bajo.
function pctFaltasObjetivo(idx) {
  if (idx === 13) return 0.25;  // >20% → pierde evaluación
  if (idx === 7)  return 0.22;  // >20% → pierde evaluación
  if (idx === 3)  return 0.14;  // 10-20% → pierde el punto de asistencia
  // resto: entre 1% y 7% según el índice (determinista)
  return 0.01 + (idx % 7) * 0.01;
}

// Reparte un total de faltas en injustificadas/justificadas (≈60% injust.)
function repartirIJ(total) {
  const inj = Math.round(total * 0.6);
  return { inj, jus: Math.max(0, total - inj) };
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Meses: ${MESES.map(m => `${m.anio}-${String(m.mes).padStart(2, '0')}`).join(', ')}`);
  console.log('-----------------------------------------------------------');

  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));

  // Repartir las faltas del trimestre entre los meses y días disponibles
  const todosLosDias = MESES.flatMap(m => diasLectivos(m.anio, m.mes).map(d => ({ ...m, dia: d })));
  const totalDiasLectivos = todosLosDias.length;

  // Estructura: faltasPorMes[`anio-mes`][alumnoId][dia] = 'I'|'J'
  const faltasPorMes = {};
  MESES.forEach(m => { faltasPorMes[`${m.anio}-${m.mes}`] = {}; });

  console.log('=== Vista previa de faltas por alumno (trimestre) ===');
  alumnos.forEach((a, idxAlumno) => {
    const pct = pctFaltasObjetivo(idxAlumno);
    const totalFaltas = Math.round(pct * totalDiasLectivos);
    const obj = repartirIJ(totalFaltas);
    // elegir días distintos (baraja determinista por id)
    const dias = [...todosLosDias];
    let seed = a.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    dias.sort(() => rnd() - 0.5);

    const elegidos = dias.slice(0, obj.inj + obj.jus);
    elegidos.forEach((dd, k) => {
      const tipo = k < obj.inj ? 'I' : 'J';
      const key = `${dd.anio}-${dd.mes}`;
      if (!faltasPorMes[key][a.id]) faltasPorMes[key][a.id] = {};
      faltasPorMes[key][a.id][dd.dia] = tipo;
    });

    const pctAsist = totalDiasLectivos > 0 ? Math.round((1 - totalFaltas / totalDiasLectivos) * 1000) / 10 : 100;
    const flag = pct > 0.20 ? '  ⚠️ >20% (pierde evaluación)' : pct >= 0.10 ? '  ⚠ 10-20% (pierde punto asist.)' : '';
    console.log(`  ${a.apellidos}, ${a.nombre}: ${obj.inj}I + ${obj.jus}J = ${totalFaltas} faltas → ${pctAsist}% asist.${flag}`);
  });
  console.log(`\nDías lectivos del periodo: ${totalDiasLectivos}`);

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para guardar.');
    return;
  }

  const now = new Date();
  let creados = 0, actualizados = 0;
  for (const m of MESES) {
    const key = `${m.anio}-${m.mes}`;
    const faltas = faltasPorMes[key];
    // ¿Existe ya el doc de ese mes/grupo/módulo?
    const snap = await db.collection('asistencia_mensual')
      .where('grupoId', '==', grupo.id).where('moduloId', '==', modulo.id).get();
    const previa = snap.docs.find(d => d.data().anio === m.anio && d.data().mes === m.mes);
    const doc = {
      grupoId: grupo.id, moduloId: modulo.id, anio: m.anio, mes: m.mes,
      faltas, updatedAt: now
    };
    if (previa) { await previa.ref.update(doc); actualizados++; }
    else { await db.collection('asistencia_mensual').add({ ...doc, createdAt: now }); creados++; }
  }
  console.log(`\n✓ Asistencia mensual: ${creados} meses creados, ${actualizados} actualizados.`);
  console.log('  Ahora ejecuta calificar-dwec.mjs para que la nota de asistencia se calcule con estas faltas.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
