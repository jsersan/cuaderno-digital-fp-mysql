// ============================================================
//  calificar-recuperacion-dwec.mjs
//  Escribe las NOTAS DE RECUPERACIÓN de los alumnos convocados a las
//  recuperaciones del módulo DWEC (DAW2), en la evaluación indicada.
//
//  Lógica realista: el alumno que va a recuperación suele aprobar justo
//  (nota acotada al máximo de recuperación, normalmente 6). Por defecto se
//  reparte: la mayoría aprueba la recuperación (5-6) y alguno la suspende (3-4).
//
//  Para cada alumno convocado:
//    - notaRecuperacion = nota (acotada a notaMaximaRecuperacion)
//    - estado = 'aprobado' si >= notaMinimaAprobado, si no 'suspenso'
//
//  Uso:
//    node scripts/calificar-recuperacion-dwec.mjs --eval "1ª Evaluación"            (simulación)
//    node scripts/calificar-recuperacion-dwec.mjs --eval "1ª Evaluación" --apply
//    node scripts/calificar-recuperacion-dwec.mjs --eval "1ª Evaluación" --nota 6 --apply
//    node scripts/calificar-recuperacion-dwec.mjs --eval "1ª Evaluación" --notas "Sarasola=4,Irizar=6" --apply
// ============================================================

import { db, resolverModuloDwec, resolverGrupoDaw2 } from './_dwec-helpers.mjs';

const APPLY = process.argv.includes('--apply');
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function norm(s) { return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

const EVAL = arg('--eval') || '1ª Evaluación';

// --notas "Apellido=nota,Apellido=nota"
const notasPorNombre = {};
const notasArg = arg('--notas');
if (notasArg) {
  notasArg.split(',').forEach(par => { const [k, v] = par.split('='); if (k && v != null) notasPorNombre[norm(k)] = Number(v); });
}
const notaUnica = arg('--nota') != null ? Number(arg('--nota')) : null;

// Reparto por defecto: la mayoría aprueba la recuperación, alguno la suspende.
// Determinista por nombre para reproducibilidad.
function notaDefecto(alumnoNombre) {
  const n = norm(alumnoNombre);
  const seed = n.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  // 1 de cada 4 suspende la recuperación (3-4), el resto aprueba (5-6)
  if (seed % 4 === 0) return 4;
  return (seed % 2 === 0) ? 5 : 6;
}

function resolverNota(alumnoNombre) {
  const n = norm(alumnoNombre);
  for (const [clave, valor] of Object.entries(notasPorNombre)) { if (n.includes(clave)) return valor; }
  if (notaUnica != null) return notaUnica;
  return notaDefecto(alumnoNombre);
}

async function main() {
  const modulo = await resolverModuloDwec();
  const grupo = await resolverGrupoDaw2();

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Evaluación: "${EVAL}"`);
  console.log('-----------------------------------------------------------');

  const snap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
  const recs = snap.docs.map(d => ({ _id: d.id, _ref: d.ref, ...d.data() })).filter(r => r.evaluacion === EVAL);

  if (recs.length === 0) {
    console.log(`⚠️  No hay recuperaciones en "${EVAL}". Genera primero los exámenes suspensos (la app las crea automáticamente al calificar).`);
    return;
  }

  for (const rec of recs) {
    const notaMax = rec.notaMaximaRecuperacion ?? 6;
    const notaMin = rec.notaMinimaAprobado ?? 5;
    console.log(`\nRecuperación: "${rec.titulo}" (${rec._id}) · máx ${notaMax} · mín ${notaMin}`);

    const convocados = rec.alumnosConvocados || [];
    if (convocados.length === 0) { console.log('  (sin alumnos convocados)'); continue; }

    const actualizados = convocados.map(a => {
      const notaPedida = resolverNota(a.alumnoNombre);
      const notaFinal = Math.min(notaPedida, notaMax);
      const estado = notaFinal >= notaMin ? 'aprobado' : 'suspenso';
      const out = { ...a, notaRecuperacion: notaFinal, estado };
      Object.keys(out).forEach(k => { if (out[k] === undefined) out[k] = null; });
      console.log(`    ${a.alumnoNombre}: orig ${a.notaOriginal ?? '-'} → recup ${notaFinal} [${estado}]`);
      return out;
    });

    if (APPLY) { await rec._ref.update({ alumnosConvocados: actualizados }); console.log('  ✓ Guardado.'); }
  }

  if (!APPLY) console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para guardar.');
  else console.log('\n✓ Notas de recuperación escritas.');
}

main().then(() => process.exit(0)).catch(err => { console.error('Error:', err.message); process.exit(1); });
