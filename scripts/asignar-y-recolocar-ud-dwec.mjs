// ============================================================
//  asignar-y-recolocar-ud-dwec.mjs
//  Para DWEC/DAW2, en UN SOLO paso:
//   1) ASIGNA el unidadId a las PRÁCTICAS que no lo tienen, según la regla:
//        Práctica N  ->  UD N   (1:1 por número)
//        Práctica 7  ->  UD10   (excepción indicada)
//        "Proyecto final ..." -> última UD (UD10)
//   2) RECOLOCA la fecha de PRÁCTICAS y EXÁMENES (los que tienen unidadId,
//      ya sea recién asignado o previo) al ÚLTIMO DÍA LECTIVO de su UD.
//
//  La UD de cada número se localiza por el título del evento 'tema' que empieza
//  por "UD<N>:" (p. ej. "UD1: Selección de arquitecturas...").
//
//  Uso:
//    node scripts/asignar-y-recolocar-ud-dwec.mjs           (simulación)
//    node scripts/asignar-y-recolocar-ud-dwec.mjs --apply   (aplicar)
// ============================================================

import { db, Timestamp, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');

// Excepciones de práctica -> número de UD (lo demás es 1:1 por número)
const EXCEPCIONES_PRACTICA = { 7: 10 };

function toDate(x) {
  if (!x) return null;
  if (x.toDate) return x.toDate();
  if (x.seconds != null) return new Date(x.seconds * 1000);
  return new Date(x);
}
function ultimoDiaLectivo(fecha) {
  const d = new Date(fecha);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}
// Nº de UD a partir del título "UD<N>: ..."
function numUD(titulo) {
  const m = (titulo || '').match(/^UD\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
// Nº de práctica a partir del título "Práctica <N>: ..."
function numPractica(titulo) {
  const m = (titulo || '').match(/Pr[áa]ctica\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}
function esProyectoFinal(titulo) {
  return /proyecto\s+final/i.test(titulo || '');
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // 1) UDs (eventos 'tema'), ordenadas por fecha
  const evSnap = await db.collection('eventos_programacion')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const temas = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.tipo === 'tema')
    .sort((a, b) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0));

  // Mapas: numUD -> {id, ...}, y unidadId -> último día lectivo
  const udPorNumero = new Map();
  temas.forEach(t => { const n = numUD(t.titulo); if (n != null) udPorNumero.set(n, t); });
  const ultimaUD = temas[temas.length - 1];

  const ultimoDeUD = new Map();
  temas.forEach((t, idx) => {
    const inicio = toDate(t.fechaInicio);
    const sig = temas[idx + 1];
    let limite;
    if (sig) { limite = new Date(toDate(sig.fechaInicio)); limite.setDate(limite.getDate() - 1); }
    else { limite = toDate(t.fechaFin) || inicio; }
    if (limite < inicio) limite = new Date(inicio);
    ultimoDeUD.set(t.id, ultimoDiaLectivo(limite));
  });
  console.log(`Unidades didácticas: ${temas.length}`);
  udPorNumero.forEach((t, n) => console.log(`  UD${n}: último día lectivo = ${ultimoDeUD.get(t.id).toLocaleDateString('es-ES')}`));

  // Resuelve la UD destino de una práctica
  function udDePractica(titulo) {
    if (esProyectoFinal(titulo)) return ultimaUD;            // proyecto final -> última UD
    const np = numPractica(titulo);
    if (np == null) return null;
    const numUDdestino = EXCEPCIONES_PRACTICA[np] ?? np;     // 1:1 salvo excepciones
    return udPorNumero.get(numUDdestino) || null;
  }

  const now = new Date();
  let asignadas = 0, movidasT = 0, movidosE = 0, sinResolver = 0;

  // 2) TAREAS (prácticas): asignar unidadId si falta + recolocar fecha
  const tSnap = await db.collection('tareas').where('moduloId', '==', modulo.id).get();
  const tareas = tSnap.docs.filter(d => d.data().grupoId === grupo.id && !d.data().archivada);
  console.log(`\n=== Tareas (${tareas.length}) ===`);
  for (const d of tareas) {
    const t = d.data();
    // unidadId: el que tenga, o el que resolvamos por título
    let unidadId = t.unidadId;
    let asignar = false;
    if (!unidadId || !ultimoDeUD.has(unidadId)) {
      const ud = udDePractica(t.titulo);
      if (!ud) { console.log(`  ⚠ "${t.titulo}" no se puede asociar a ninguna UD → se salta`); sinResolver++; continue; }
      unidadId = ud.id; asignar = true;
    }
    const dia = ultimoDeUD.get(unidadId);
    const orig = toDate(t.fechaEntrega);
    const nueva = new Date(dia);
    if (orig) nueva.setHours(orig.getHours(), orig.getMinutes(), 0, 0); else nueva.setHours(9, 0, 0, 0);
    const udNombre = temas.find(x => x.id === unidadId)?.titulo || unidadId;
    console.log(`  "${t.titulo}"${asignar ? ' [+unidadId]' : ''} → ${udNombre.split(':')[0]} · ${nueva.toLocaleDateString('es-ES')}`);
    if (APPLY) {
      const upd = { fechaEntrega: Timestamp.fromDate(nueva), updatedAt: now };
      if (asignar) upd.unidadId = unidadId;
      await d.ref.update(upd);
    }
    if (asignar) asignadas++;
    movidasT++;
  }

  // 3) EXÁMENES: recolocar (respetando su unidadId). Los globales sin unidadId se saltan.
  const eSnap = await db.collection('examenes').where('moduloId', '==', modulo.id).get();
  const examenes = eSnap.docs.filter(d => d.data().grupoId === grupo.id);
  console.log(`\n=== Exámenes (${examenes.length}) ===`);
  for (const d of examenes) {
    const ex = d.data();
    if (!ex.unidadId || !ultimoDeUD.has(ex.unidadId)) {
      console.log(`  ⚠ "${ex.titulo}" sin unidadId de UD → se salta (examen global)`);
      continue;
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
  console.log(`Prácticas con unidadId asignado: ${asignadas} · Prácticas recolocadas: ${movidasT} · Exámenes recolocados: ${movidosE} · Sin resolver: ${sinResolver}`);
  if (!APPLY) console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para aplicar.');
  else console.log('\n✓ Aplicado. Revisa el calendario de Programación.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
