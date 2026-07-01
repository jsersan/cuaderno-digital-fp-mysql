// ============================================================
//  borrar-duplicados-alumnos-daw2.mjs
//  Elimina alumnos duplicados del grupo DAW2.
//
//  Criterio:
//   - Dos registros son el MISMO alumno si comparten DNI/NIE (normalizado).
//   - De cada grupo de duplicados se CONSERVA el más reciente
//     (createdAt más alto; si falta, updatedAt) y se borran los demás.
//   - Alcance: solo alumnos cuyo grupoId sea el de DAW2.
//
//  Los registros sin DNI no se tocan (no se pueden deduplicar con seguridad);
//  se listan aparte por si quieres revisarlos a mano.
//
//  Uso:
//    node scripts/borrar-duplicados-alumnos-daw2.mjs          (simulación)
//    node scripts/borrar-duplicados-alumnos-daw2.mjs --apply  (borrado real)
// ============================================================

import { db, resolverGrupoDaw2 } from './_proy-helpers.mjs';

const APPLY = process.argv.includes('--apply');

// Normaliza un DNI/NIE: sin espacios, mayúsculas, sin guiones.
function normDni(v) {
  return String(v || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

// Devuelve un valor numérico de "fecha de creación" para ordenar (segundos).
// Soporta Timestamp de Firestore, Date y null.
function tiempo(doc) {
  const c = doc.createdAt ?? doc.updatedAt;
  if (!c) return 0;
  if (typeof c.seconds === 'number') return c.seconds;          // Firestore Timestamp
  if (typeof c.toDate === 'function') return c.toDate().getTime() / 1000;
  const d = new Date(c);
  return isNaN(d) ? 0 : d.getTime() / 1000;
}

async function main() {
  const grupo = await resolverGrupoDaw2();
  console.log(`Grupo: ${grupo.nombre} (${grupo.id})`);
  console.log('-----------------------------------------------------------');

  const snap = await db.collection('alumnos')
    .where('grupoId', '==', grupo.id)
    .get();

  console.log(`Total de registros de alumnos en DAW2: ${snap.size}`);

  // Agrupar por DNI normalizado
  const porDni = new Map();   // dni -> [{id, data}, ...]
  const sinDni = [];          // registros sin DNI

  snap.docs.forEach(d => {
    const data = d.data();
    const dni = normDni(data.dni);
    if (!dni) { sinDni.push({ id: d.id, data }); return; }
    if (!porDni.has(dni)) porDni.set(dni, []);
    porDni.get(dni).push({ id: d.id, ref: d.ref, data });
  });

  const aBorrar = [];
  let alumnosUnicos = 0;

  console.log('\n=== Análisis por DNI/NIE ===');
  for (const [dni, registros] of porDni) {
    alumnosUnicos++;
    if (registros.length === 1) continue;  // sin duplicados

    // Ordenar por tiempo descendente: el primero es el más reciente (se conserva)
    registros.sort((a, b) => tiempo(b.data) - tiempo(a.data));
    const conservado = registros[0];
    const duplicados = registros.slice(1);

    const nombre = `${conservado.data.apellidos}, ${conservado.data.nombre}`;
    console.log(`  ${dni}  ${nombre}: ${registros.length} copias → conservar 1, borrar ${duplicados.length}`);
    console.log(`     conservado: [${conservado.id}] (createdAt=${tiempo(conservado.data)})`);
    duplicados.forEach(dup => {
      console.log(`     borrar:     [${dup.id}] (createdAt=${tiempo(dup.data)})`);
      aBorrar.push(dup);
    });
  }

  console.log('\n=== Resumen ===');
  console.log(`Alumnos únicos (por DNI): ${alumnosUnicos}`);
  console.log(`Registros sin DNI (no se tocan): ${sinDni.length}`);
  if (sinDni.length) {
    sinDni.forEach(r => console.log(`     sin DNI: ${r.data.apellidos}, ${r.data.nombre}  [${r.id}]`));
  }
  console.log(`Registros duplicados a borrar: ${aBorrar.length}`);

  if (aBorrar.length === 0) {
    console.log('\nNo hay duplicados que borrar.');
    return;
  }

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha borrado nada. Ejecuta con --apply para borrar.');
    return;
  }

  // Borrado en lotes de 400 (límite de batch de Firestore: 500 operaciones)
  let borrados = 0;
  for (let i = 0; i < aBorrar.length; i += 400) {
    const lote = aBorrar.slice(i, i + 400);
    const batch = db.batch();
    lote.forEach(d => batch.delete(d.ref));
    await batch.commit();
    borrados += lote.length;
  }

  console.log(`\n✓ Eliminados ${borrados} registros duplicados de DAW2.`);
  console.log(`  Quedan ${alumnosUnicos} alumnos únicos + ${sinDni.length} sin DNI.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
