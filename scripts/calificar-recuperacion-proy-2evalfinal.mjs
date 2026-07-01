// ============================================================
//  calificar-recuperacion-proy-2evalfinal.mjs
//  Escribe directamente en Firestore las NOTAS DE RECUPERACIÓN de los
//  alumnos convocados a la recuperación del módulo de Proyecto (PROY) de
//  DAW2 en la 2ª Evaluación Final.
//
//  Sirve para meter las notas sin pasar por la pantalla de Recuperaciones
//  (útil para datos de prueba o si el guardado en pantalla falla).
//
//  Para cada alumno convocado:
//    - notaRecuperacion = nota indicada (acotada a notaMaximaRecuperacion)
//    - estado = 'aprobado' si nota >= notaMinimaAprobado, si no 'suspenso'
//
//  Notas:
//    · Por defecto pone un 5 a TODOS los convocados (aprueban justo).
//    · Puedes fijar notas concretas por apellido con --notas
//        --notas "Etxebarria=5,Larrañaga=4"
//      (coincide por inclusión de texto sobre alumnoNombre, sin tildes ni mayúsc.)
//    · O una nota única para todos con --nota 5
//
//  Uso:
//    node scripts/calificar-recuperacion-proy-2evalfinal.mjs                       (simulación, todos a 5)
//    node scripts/calificar-recuperacion-proy-2evalfinal.mjs --apply               (aplicar, todos a 5)
//    node scripts/calificar-recuperacion-proy-2evalfinal.mjs --nota 6 --apply      (todos a 6)
//    node scripts/calificar-recuperacion-proy-2evalfinal.mjs --notas "Etxebarria=5,Larrañaga=4" --apply
// ============================================================

import { db, resolverModuloProy, resolverGrupoDaw2 } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');
const EVAL_2F = '2ª Evaluación Final';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Parsear --notas "Apellido=nota,Apellido=nota"
const notasPorNombre = {};
const notasArg = arg('--notas');
if (notasArg) {
  notasArg.split(',').forEach(par => {
    const [k, v] = par.split('=');
    if (k && v != null) notasPorNombre[norm(k)] = Number(v);
  });
}
const notaUnica = arg('--nota') != null ? Number(arg('--nota')) : null;
const NOTA_DEFECTO = 5;

function resolverNota(alumnoNombre) {
  const n = norm(alumnoNombre);
  // 1) Coincidencia por apellido/nombre en --notas
  for (const [clave, valor] of Object.entries(notasPorNombre)) {
    if (n.includes(clave)) return valor;
  }
  // 2) Nota única
  if (notaUnica != null) return notaUnica;
  // 3) Por defecto
  return NOTA_DEFECTO;
}

async function main() {
  const modulo = await resolverModuloProy();
  const grupo = await resolverGrupoDaw2();

  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  // Localizar la recuperación de PROY/DAW2 en la 2ª Eval Final
  const snap = await db.collection('recuperaciones')
    .where('moduloId', '==', modulo.id)
    .where('grupoId', '==', grupo.id)
    .get();
  const recs = snap.docs
    .map(d => ({ _id: d.id, _ref: d.ref, ...d.data() }))
    .filter(r => r.evaluacion === EVAL_2F);

  if (recs.length === 0) {
    console.log(`⚠️  No hay recuperación en "${EVAL_2F}". Ejecuta antes crear-recuperacion-proy-2evalfinal.mjs --apply`);
    return;
  }

  for (const rec of recs) {
    const notaMax = rec.notaMaximaRecuperacion ?? 6;
    const notaMin = rec.notaMinimaAprobado ?? 5;
    console.log(`\nRecuperación: "${rec.titulo}" (${rec._id})`);
    console.log(`  Nota máx: ${notaMax} · Mín aprobado: ${notaMin}`);

    const convocados = rec.alumnosConvocados || [];
    if (convocados.length === 0) { console.log('  (sin alumnos convocados)'); continue; }

    const actualizados = convocados.map(a => {
      const notaPedida = resolverNota(a.alumnoNombre);
      const notaFinal = Math.min(notaPedida, notaMax);
      const estado = notaFinal >= notaMin ? 'aprobado' : 'suspenso';
      const out = { ...a, notaRecuperacion: notaFinal, estado };
      // Saneo: ningún campo undefined (Firestore lo rechaza)
      Object.keys(out).forEach(k => { if (out[k] === undefined) out[k] = null; });
      console.log(`    ${a.alumnoNombre}: orig ${a.notaOriginal ?? '-'} → recup ${notaFinal} [${estado}]`);
      return out;
    });

    if (APPLY) {
      await rec._ref.update({ alumnosConvocados: actualizados });
      console.log('  ✓ Guardado.');
    }
  }

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Añade --apply para guardar.');
  } else {
    console.log('\n✓ Notas de recuperación escritas. Ahora ejecuta consolidar-proy-2evalfinal.mjs --apply');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
