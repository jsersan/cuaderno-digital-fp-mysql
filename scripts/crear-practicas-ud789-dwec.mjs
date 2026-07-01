// ============================================================
//  crear-practicas-ud789-dwec.mjs
//  Crea 3 PRÁCTICAS nuevas para las unidades que se quedaron sin práctica:
//    UD7 -> "Práctica: TypeScript"
//    UD8 -> "Práctica: jQuery"
//    UD9 -> "Práctica: AJAX"
//
//  Copia la estructura de campos de una práctica (tarea) EXISTENTE de DWEC/DAW2
//  como plantilla, y cambia solo: título, descripción, unidadId, evaluación y
//  fecha de entrega (último día lectivo de su UD). Hereda la evaluación de la UD.
//
//  Anti-duplicado: si ya hay una tarea con ese unidadId, la salta.
//
//  Uso:
//    node scripts/crear-practicas-ud789-dwec.mjs           (simulación)
//    node scripts/crear-practicas-ud789-dwec.mjs --apply   (aplicar)
// ============================================================

import { db, Timestamp, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');

// Definición de las prácticas nuevas: número de UD, título y descripción
const NUEVAS = [
  { numUD: 7, titulo: 'Práctica: TypeScript', descripcion: 'Tipado estático, interfaces y clases con TypeScript.' },
  { numUD: 8, titulo: 'Práctica: jQuery', descripcion: 'Manipulación del DOM y eventos con jQuery.' },
  { numUD: 9, titulo: 'Práctica: AJAX', descripcion: 'Consumo de datos JSON con AJAX y peticiones asíncronas.' },
];

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
function numUD(titulo) {
  const m = (titulo || '').match(/^UD\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();
  console.log(`Módulo: ${modulo.abreviatura} (${modulo.id}) · Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // 1) UDs (eventos 'tema') ordenadas, con su último día lectivo
  const evSnap = await db.collection('eventos_programacion')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const temas = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.tipo === 'tema')
    .sort((a, b) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0));

  const udPorNumero = new Map();
  temas.forEach(t => { const n = numUD(t.titulo); if (n != null) udPorNumero.set(n, t); });

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

  // 2) Plantilla: una práctica existente de DWEC/DAW2
  const tSnap = await db.collection('tareas').where('moduloId', '==', modulo.id).get();
  const tareas = tSnap.docs.filter(d => d.data().grupoId === grupo.id && !d.data().archivada);
  if (tareas.length === 0) { console.error('No hay ninguna práctica existente para usar como plantilla.'); return; }
  const plantilla = tareas[0].data();
  console.log(`Plantilla tomada de: "${plantilla.titulo}"`);
  const idsConPractica = new Set(tareas.map(d => d.data().unidadId).filter(Boolean));

  const now = new Date();
  let creadas = 0, saltadas = 0;

  for (const def of NUEVAS) {
    const ud = udPorNumero.get(def.numUD);
    if (!ud) { console.log(`  ⚠ No encuentro UD${def.numUD} → se salta`); continue; }
    if (idsConPractica.has(ud.id)) { console.log(`  ⏭ UD${def.numUD} ya tiene práctica → se salta`); saltadas++; continue; }

    const dia = ultimoDeUD.get(ud.id);
    const fechaEntrega = new Date(dia); fechaEntrega.setHours(9, 0, 0, 0);

    // Copiar estructura de la plantilla, sobrescribiendo solo lo necesario
    const nueva = {
      ...plantilla,
      titulo: def.titulo,
      descripcion: def.descripcion,
      unidadId: ud.id,
      evaluacion: ud.evaluacion ?? plantilla.evaluacion,
      fechaEntrega: Timestamp.fromDate(fechaEntrega),
      entregas: [],            // sin entregas: práctica nueva
      createdAt: now,
      updatedAt: now,
    };
    delete nueva.id;           // que Firestore genere uno nuevo

    console.log(`  + "${def.titulo}" → UD${def.numUD} · ${fechaEntrega.toLocaleDateString('es-ES')} · eval=${nueva.evaluacion}`);
    if (APPLY) { await db.collection('tareas').add(nueva); }
    creadas++;
  }

  console.log('\n-----------------------------------------------------------');
  console.log(`Prácticas a crear: ${creadas} · Saltadas (ya existían): ${saltadas}`);
  if (!APPLY) console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para crear las prácticas.');
  else console.log('\n✓ Creadas. Recuerda calificarlas si quieres que cuenten en notas (script de calificar tareas).');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
