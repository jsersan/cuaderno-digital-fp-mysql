// ============================================================
//  recolocar-fechas-ud-dwec.mjs
//  Recoloca las PRÁCTICAS (tareas) y los EXÁMENES de DWEC/DAW2 al ÚLTIMO
//  DÍA LECTIVO de la Unidad Didáctica a la que ya pertenecen (por su unidadId).
//
//  Para cada UD (evento de programación de tipo 'tema'), su "último día lectivo"
//  es el día lectivo (lun-vie) anterior al inicio de la siguiente UD; para la
//  última UD de la lista, su propio fechaFin (o su fechaInicio si no tiene).
//
//  Respeta el unidadId existente: NO reasigna unidades. Si una tarea/examen no
//  tiene unidadId, lo informa y lo salta (no se mueve).
//
//  Uso:
//    node scripts/recolocar-fechas-ud-dwec.mjs           (simulación)
//    node scripts/recolocar-fechas-ud-dwec.mjs --apply   (aplicar)
// ============================================================

import { db, Timestamp, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');

function toDate(x) {
  if (!x) return null;
  if (x.toDate) return x.toDate();
  if (x.seconds != null) return new Date(x.seconds * 1000);
  return new Date(x);
}

// Último día lectivo (lun-vie) <= fecha dada
function ultimoDiaLectivo(fecha) {
  const d = new Date(fecha);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // 1) Unidades didácticas (eventos 'tema'), ordenadas por fecha de inicio
  const evSnap = await db.collection('eventos_programacion')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const temas = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.tipo === 'tema')
    .sort((a, b) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0));
  console.log(`Unidades didácticas: ${temas.length}`);

  // 2) Último día lectivo de cada UD → mapa unidadId -> Date
  const ultimoDeUD = new Map();
  temas.forEach((t, idx) => {
    const inicio = toDate(t.fechaInicio);
    const siguiente = temas[idx + 1];
    let limite;
    if (siguiente) {
      limite = new Date(toDate(siguiente.fechaInicio));
      limite.setDate(limite.getDate() - 1);     // día anterior al inicio de la siguiente
    } else {
      limite = toDate(t.fechaFin) || inicio;     // última UD: su fin (o su inicio)
    }
    if (limite < inicio) limite = new Date(inicio);
    const dia = ultimoDiaLectivo(limite);
    ultimoDeUD.set(t.id, dia);
    console.log(`  ${t.titulo}: último día lectivo = ${dia.toLocaleDateString('es-ES')}`);
  });

  const now = new Date();
  let movidasT = 0, movidosE = 0, sinUD = 0;

  // 3) Tareas (prácticas) con unidadId → fecha de entrega al último día de su UD
  const tSnap = await db.collection('tareas').where('moduloId', '==', modulo.id).get();
  const tareas = tSnap.docs.filter(d => d.data().grupoId === grupo.id && !d.data().archivada);
  console.log(`\n=== Tareas (${tareas.length}) ===`);
  for (const d of tareas) {
    const t = d.data();
    if (!t.unidadId || !ultimoDeUD.has(t.unidadId)) {
      console.log(`  ⚠ "${t.titulo}" sin unidadId válido → se salta`);
      sinUD++; continue;
    }
    const dia = ultimoDeUD.get(t.unidadId);
    // mantener la hora original de entrega si existe (p. ej. 09:00)
    const orig = toDate(t.fechaEntrega);
    const nueva = new Date(dia);
    if (orig) nueva.setHours(orig.getHours(), orig.getMinutes(), 0, 0); else nueva.setHours(9, 0, 0, 0);
    console.log(`  "${t.titulo}" → ${nueva.toLocaleDateString('es-ES')}`);
    if (APPLY) { await d.ref.update({ fechaEntrega: Timestamp.fromDate(nueva), updatedAt: now }); }
    movidasT++;
  }

  // 4) Exámenes con unidadId → fecha al último día de su UD
  const eSnap = await db.collection('examenes').where('moduloId', '==', modulo.id).get();
  const examenes = eSnap.docs.filter(d => d.data().grupoId === grupo.id);
  console.log(`\n=== Exámenes (${examenes.length}) ===`);
  for (const d of examenes) {
    const ex = d.data();
    if (!ex.unidadId || !ultimoDeUD.has(ex.unidadId)) {
      console.log(`  ⚠ "${ex.titulo}" sin unidadId válido → se salta`);
      sinUD++; continue;
    }
    const dia = ultimoDeUD.get(ex.unidadId);
    const orig = toDate(ex.fecha);
    const nueva = new Date(dia);
    if (orig) nueva.setHours(orig.getHours(), orig.getMinutes(), 0, 0); else nueva.setHours(9, 0, 0, 0);
    console.log(`  "${ex.titulo}" → ${nueva.toLocaleDateString('es-ES')}`);
    if (APPLY) { await d.ref.update({ fecha: Timestamp.fromDate(nueva), updatedAt: now }); }
    movidosE++;
  }

  console.log('\n-----------------------------------------------------------');
  console.log(`Tareas a recolocar: ${movidasT} · Exámenes: ${movidosE} · Sin unidadId (saltados): ${sinUD}`);
  if (!APPLY) console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para aplicar.');
  else console.log('\n✓ Fechas actualizadas. Revisa el calendario de Programación.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
