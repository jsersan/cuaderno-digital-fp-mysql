// ============================================================
//  diagnostico-asistencia-dwec.mjs
//  SOLO LECTURA. Muestra qué registros de asistencia existen para DWEC/DAW2
//  en las dos colecciones que usa la app:
//    - 'asistencia'          (pasar lista por franjas horarias)
//    - 'asistencia_mensual'  (faltas por día I/J)
//  y reproduce el cálculo de 'totalClases' por alumno para entender el
//  descuadre de porcentajes (130 vs 392, etc.).
//
//  Uso:
//    node scripts/diagnostico-asistencia-dwec.mjs
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

function diasLectivos(anio, mes) {
  let n = 0; const dim = new Date(anio, mes, 0).getDate();
  for (let d = 1; d <= dim; d++) { const dow = new Date(anio, mes - 1, d).getDay(); if (dow !== 0 && dow !== 6) n++; }
  return n;
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('===========================================================');

  const alSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'));

  // 1) Colección 'asistencia' (franjas)
  const asisSnap = await db.collection('asistencia').where('moduloId', '==', modulo.id).get();
  const asisGrupo = asisSnap.docs.map(d => d.data()).filter(r => r.grupoId === grupo.id);
  console.log(`\n[asistencia] documentos de DWEC/DAW2: ${asisGrupo.length}`);
  // Agrupar por fecha+franja para ver cuántas "sesiones" distintas hay
  const sesiones = new Set();
  asisGrupo.forEach(r => {
    const f = r.fecha?.seconds ? new Date(r.fecha.seconds * 1000).toISOString().slice(0, 10) : '?';
    sesiones.add(`${f}__${r.franjaHoraria || '?'}`);
  });
  console.log(`[asistencia] sesiones distintas (fecha+franja): ${sesiones.size}`);

  // 2) Colección 'asistencia_mensual'
  const menSnap = await db.collection('asistencia_mensual').where('grupoId', '==', grupo.id).get();
  const menGrupo = menSnap.docs.map(d => d.data()).filter(r => r.moduloId === modulo.id);
  let diasMensual = 0;
  console.log(`\n[asistencia_mensual] documentos de DWEC/DAW2: ${menGrupo.length}`);
  menGrupo.forEach(m => {
    const dl = (m.anio && m.mes) ? diasLectivos(m.anio, m.mes) : 0;
    diasMensual += dl;
    const nAlumnosConFalta = Object.keys(m.faltas || {}).length;
    console.log(`   · ${m.anio}-${String(m.mes).padStart(2, '0')}: ${dl} días lectivos · ${nAlumnosConFalta} alumnos con faltas`);
  });
  console.log(`[asistencia_mensual] total días lectivos sumados: ${diasMensual}`);

  // 3) Total que ve la app por alumno = (registros de franja en los que aparece) + (días lectivos mensuales)
  console.log('\n[total por alumno según la app] = nº registros de franja + días lectivos mensuales');
  for (const a of alumnos) {
    const enFranjas = asisGrupo.filter(r => (r.registros || []).some(x => x.alumnoId === a.id)).length;
    const total = enFranjas + diasMensual;
    console.log(`   ${a.apellidos}, ${a.nombre}: franjas=${enFranjas} + mensual=${diasMensual} = ${total}`);
  }

  console.log('\nSi ves totales distintos entre alumnos, es porque unos aparecen en registros de "pasar lista" (colección asistencia) y otros no.');
  console.log('La opción B limpia la colección "asistencia" para DWEC/DAW2 y deja solo "asistencia_mensual", uniformando el total.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
