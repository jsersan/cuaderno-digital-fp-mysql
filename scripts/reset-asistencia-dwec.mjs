// ============================================================
//  reset-asistencia-dwec.mjs
//  OPCIÓN B: deja la asistencia de DWEC/DAW2 LIMPIA y UNIFORME.
//
//   1) BORRA los documentos de la colección 'asistencia' (pasar lista por
//      franjas) de DWEC/DAW2 — son los que descuadran el total (130 vs 392).
//   2) REGENERA 'asistencia_mensual' para los 6 meses ya existentes
//      (sep-2025 a feb-2026 = 130 días lectivos, igual que la app)
//      con un reparto de faltas que produce estos porcentajes reales:
//        · 2 alumnos con >20% de faltas (pierden la evaluación)
//        · 1 alumno entre 10% y 20% (pierde el punto de asistencia)
//        · el resto, pocas faltas (<8%)
//      El % se calcula sobre el total real de días lectivos del curso, así
//      que coincide con lo que muestra la app.
//
//  Uso:
//    node scripts/reset-asistencia-dwec.mjs            (simulación)
//    node scripts/reset-asistencia-dwec.mjs --apply    (aplicar)
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');

// Meses lectivos REALES que ya existen en la base de datos (sep-2025 a feb-2026).
// Total = 130 días lectivos, igual que muestra la app. Mes en base 1.
const MESES = [
  { anio: 2025, mes: 9 }, { anio: 2025, mes: 10 }, { anio: 2025, mes: 11 }, { anio: 2025, mes: 12 },
  { anio: 2026, mes: 1 }, { anio: 2026, mes: 2 }
];

function diasLectivosDeMes(anio, mes) {
  const dias = []; const dim = new Date(anio, mes, 0).getDate();
  for (let d = 1; d <= dim; d++) { const dow = new Date(anio, mes - 1, d).getDay(); if (dow !== 0 && dow !== 6) dias.push(d); }
  return dias;
}

// % de faltas objetivo por índice alfabético del alumno
function pctFaltasObjetivo(idx) {
  if (idx === 13) return 0.25;  // >20%
  if (idx === 7)  return 0.22;  // >20%
  if (idx === 3)  return 0.14;  // 10-20%
  return 0.01 + (idx % 7) * 0.01; // 1%-7%
}
function repartirIJ(total) { const inj = Math.round(total * 0.6); return { inj, jus: Math.max(0, total - inj) }; }

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));

  // Días lectivos por mes y total del curso
  const diasPorMes = MESES.map(m => ({ ...m, dias: diasLectivosDeMes(m.anio, m.mes) }));
  const totalDiasCurso = diasPorMes.reduce((s, m) => s + m.dias.length, 0);
  const todosLosDias = diasPorMes.flatMap(m => m.dias.map(d => ({ anio: m.anio, mes: m.mes, dia: d })));
  console.log(`Días lectivos del curso (sep-may): ${totalDiasCurso}`);

  // 1) Localizar documentos a borrar en 'asistencia' (franjas)
  const asisSnap = await db.collection('asistencia').where('moduloId', '==', modulo.id).get();
  const aBorrar = asisSnap.docs.filter(d => d.data().grupoId === grupo.id);
  console.log(`\n[asistencia] documentos de franjas a borrar: ${aBorrar.length}`);

  // 2) Calcular faltas por alumno para todo el curso
  console.log('\n=== Reparto de faltas (todo el curso) ===');
  const faltasPorMes = {};
  MESES.forEach(m => { faltasPorMes[`${m.anio}-${m.mes}`] = {}; });

  alumnos.forEach((a, idx) => {
    const pct = pctFaltasObjetivo(idx);
    const totalFaltas = Math.round(pct * totalDiasCurso);
    const obj = repartirIJ(totalFaltas);

    // Generador determinista por alumno (reproducible)
    let seed = a.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    // 1) Repartir el TOTAL de faltas entre los meses, proporcional a sus días
    //    lectivos, con redondeo que conserva la suma exacta.
    const reparto = diasPorMes.map(m => ({ ...m, exacto: totalFaltas * (m.dias.length / totalDiasCurso), faltas: 0 }));
    reparto.forEach(r => r.faltas = Math.floor(r.exacto));
    let asignadas = reparto.reduce((s, r) => s + r.faltas, 0);
    // Repartir el resto (por mayor parte decimal) hasta cuadrar el total
    let resto = totalFaltas - asignadas;
    reparto.sort((x, y) => (y.exacto - y.faltas) - (x.exacto - x.faltas));
    for (let i = 0; i < reparto.length && resto > 0; i++) { reparto[i].faltas++; resto--; }
    // Reordenar a orden cronológico
    reparto.sort((x, y) => MESES.findIndex(m => m.anio === x.anio && m.mes === x.mes) - MESES.findIndex(m => m.anio === y.anio && m.mes === y.mes));

    // 2) Dentro de cada mes, elegir días distintos al azar (determinista)
    //    y asignar el tipo I/J respetando la proporción global (~60% injust.).
    let puestas = 0;
    const totalI = obj.inj;
    reparto.forEach(r => {
      const diasMes = [...r.dias];
      diasMes.sort(() => rnd() - 0.5);
      const elegidos = diasMes.slice(0, r.faltas);
      const key = `${r.anio}-${r.mes}`;
      elegidos.forEach(dia => {
        const tipo = puestas < totalI ? 'I' : 'J';
        if (!faltasPorMes[key][a.id]) faltasPorMes[key][a.id] = {};
        faltasPorMes[key][a.id][dia] = tipo;
        puestas++;
      });
    });

    const pctAsist = Math.round((1 - totalFaltas / totalDiasCurso) * 1000) / 10;
    const flag = pct > 0.20 ? '  ⚠️ >20% (pierde evaluación)' : pct >= 0.10 ? '  ⚠ 10-20% (pierde punto)' : '';
    const distrib = reparto.filter(r => r.faltas > 0).map(r => `${r.mes}:${r.faltas}`).join(' ');
    console.log(`  ${a.apellidos}, ${a.nombre}: ${obj.inj}I+${obj.jus}J = ${totalFaltas}/${totalDiasCurso} → ${pctAsist}%${flag}  [${distrib}]`);
  });

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha borrado ni escrito nada. Añade --apply para aplicar.');
    return;
  }

  // 3) Borrar franjas (en lotes)
  let borrados = 0;
  for (const d of aBorrar) { await d.ref.delete(); borrados++; }
  console.log(`\n✓ Borrados ${borrados} documentos de 'asistencia' (franjas).`);

  // 4) Reescribir asistencia_mensual.
  //    IMPORTANTE: la app lee/escribe cada mes con un ID determinista
  //    `${grupoId}_${moduloId}_${anio}-${MM}` (ver AsistenciaMensualComponent.getDocId).
  //    Si usáramos .add() con ID aleatorio, el RESUMEN los vería (consulta por campos)
  //    pero la REJILLA mensual no (lee por getDoc(id) exacto) → mes vacío.
  //    Por eso escribimos con ese mismo ID.
  const docId = (anio, mes) => `${grupo.id}_${modulo.id}_${anio}-${String(mes).padStart(2, '0')}`;

  // Borrar cualquier doc previo del módulo+grupo (tanto con ID aleatorio como determinista)
  const menSnap = await db.collection('asistencia_mensual').where('grupoId', '==', grupo.id).get();
  const menPrevios = menSnap.docs.filter(d => d.data().moduloId === modulo.id);
  for (const d of menPrevios) { await d.ref.delete(); }
  console.log(`✓ Borrados ${menPrevios.length} documentos previos de 'asistencia_mensual'.`);

  const now = new Date();
  let creados = 0;
  for (const m of MESES) {
    const faltas = faltasPorMes[`${m.anio}-${m.mes}`];
    const id = docId(m.anio, m.mes);
    await db.collection('asistencia_mensual').doc(id).set({
      grupoId: grupo.id, moduloId: modulo.id, anio: m.anio, mes: m.mes,
      faltas, createdAt: now, updatedAt: now
    });
    creados++;
  }
  console.log(`✓ Creados ${creados} meses en 'asistencia_mensual' con el ID que usa la app.`);
  console.log('\nAhora la rejilla mensual y el resumen mostrarán los mismos datos. Recalcula notas con calificar-dwec.mjs si quieres reflejar el punto de asistencia.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
