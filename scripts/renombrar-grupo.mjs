// scripts/renombrar-grupo.mjs
// -----------------------------------------------------------------------------
// Renombra el grupo "2AW3B" a "2AW3".
//
// Uso:
//   node --check scripts/renombrar-grupo.mjs       → validar sintaxis
//   node scripts/renombrar-grupo.mjs               → DRY-RUN (no escribe nada)
//   node scripts/renombrar-grupo.mjs --commit      → aplicar
//   (opcional) primer argumento = ruta del serviceAccount.json
//
// Si ya existiera un "2AW3" en el mismo ciclo y curso académico, NO se renombra
// (habría dos grupos iguales): se informa para fusionarlos aparte.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const NOMBRE_VIEJO = '2AW3B';
const NOMBRE_NUEVO = '2AW3';

// --- Localizar serviceAccount.json (argumento, junto al script, cwd, scripts/) ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const argPath = process.argv.slice(2).find(a => !a.startsWith('--'));
const candidatos = [
  argPath && (isAbsolute(argPath) ? argPath : resolve(process.cwd(), argPath)),
  resolve(__dirname, 'serviceAccount.json'),
  resolve(process.cwd(), 'serviceAccount.json'),
  resolve(process.cwd(), 'scripts/serviceAccount.json'),
].filter(Boolean);
const saPath = candidatos.find(p => existsSync(p));
if (!saPath) {
  console.error('✗ No encuentro serviceAccount.json. Rutas probadas:\n  ' + candidatos.join('\n  '));
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log(COMMIT ? '== MODO COMMIT: se escribirá en Firestore ==' : '== DRY-RUN: no se escribe nada. Usa --commit para aplicar ==');
  console.log(`Proyecto: ${serviceAccount.project_id}`);

  const snap = await db.collection('grupos').where('nombre', '==', NOMBRE_VIEJO).get();
  if (snap.empty) {
    console.log(`No hay ningún grupo llamado "${NOMBRE_VIEJO}". Nada que hacer.`);
    return;
  }

  // Todos los grupos, para detectar conflictos de nombre por ciclo + curso académico
  const todos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ...d.data() }));

  let aRenombrar = 0, conflictos = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    const g = doc.data();
    const conflicto = todos.find(o => o.id !== doc.id && o.nombre === NOMBRE_NUEVO
      && o.cicloId === g.cicloId && o.cursoAcademico === g.cursoAcademico);
    if (conflicto) {
      conflictos++;
      console.log(`⚠ Conflicto: ya existe "${NOMBRE_NUEVO}" (${conflicto.id}) en el mismo ciclo y curso ${g.cursoAcademico || '?'}.`);
      console.log(`  Se OMITE ${doc.id}: habría dos grupos iguales. Habría que FUSIONARLOS, no solo renombrar.`);
      continue;
    }
    console.log(`✓ ${doc.id}: "${NOMBRE_VIEJO}" → "${NOMBRE_NUEVO}"  (cicloId=${g.cicloId}, curso ${g.cursoAcademico || '?'})`);
    if (COMMIT) batch.update(doc.ref, { nombre: NOMBRE_NUEVO });
    aRenombrar++;
  }

  if (COMMIT && aRenombrar) await batch.commit();
  console.log(`\n${COMMIT ? 'Aplicado' : 'Dry-run'}: ${aRenombrar} renombrado(s), ${conflictos} con conflicto.`);
  if (conflictos) console.log('Para los conflictos dime y preparo un script de fusión (mover modulosIds/alumnosIds y borrar el duplicado).');
}

main().catch(e => {
  if (e && (e.code === 16 || /UNAUTHENTICATED/.test(e.message || ''))) {
    console.error('\n✗ Credenciales rechazadas (UNAUTHENTICATED). Usa una clave válida del proyecto correcto.');
  } else { console.error(e); }
  process.exit(1);
});
