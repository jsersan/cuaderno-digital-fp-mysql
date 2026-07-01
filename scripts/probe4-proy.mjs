// probe4-proy.mjs — SOLO LECTURA. Localiza la tarea creada a mano ("PRUEBA")
// y muestra el moduloId + grupoId reales que usa el cuaderno PROI/SM2 desde la app.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Grupos SM2 y módulos de proyecto SMR conocidos (para etiquetar).
const NOMBRE_GRUPO = {
  '6FizW6wI8iHYzoSWCV8y':'SM2(6FizW6)', 'EtIYPCvquwkb1BX4Fspm':'SM2(EtI)*qjh',
  'MESWcuGHQO6yP7rxwFKh':'SM2(MESWcu)', 'PuFIWchb1TJ7SGEpxvUG':'SM2(PuFIWchb)',
  'SYj7pEqYEMWApdUwoVEI':'SM2(SYj7)',
};
const NOMBRE_MOD = {
  'qjhDxHpiyGQcoTWHyNXJ':'PROI «Proyecto Intermodular SM2»',
  'lJ0d3IFKltKuCXdfNzNd':'PROI «Proyecto»', 'FG3sFdVErRh26V7YaIAE':'PROY «Proyecto»',
};

async function main() {
  console.log('PROYECTO:', sa.project_id, '\n');

  // 1) Tareas tituladas PRUEBA (creadas a mano desde la app)
  const all = await db.collection('tareas').get();
  const prueba = all.docs.filter(d => /prueba/i.test(d.data().titulo || ''));
  console.log(`Tareas con "PRUEBA" en el título: ${prueba.length}`);
  for (const d of prueba) {
    const t = d.data();
    console.log(`  · "${t.titulo}"`);
    console.log(`      moduloId = ${t.moduloId}   (${NOMBRE_MOD[t.moduloId] || '?'})`);
    console.log(`      grupoId  = ${t.grupoId}    (${NOMBRE_GRUPO[t.grupoId] || '?'})`);
    console.log(`      cursoAcademico = ${t.cursoAcademico ?? '(sin campo)'}  evaluacion = ${t.evaluacion ?? '-'}`);
    console.log(`      → para que el seed funcione: moduloId='${t.moduloId}'  grupoId='${t.grupoId}'`);
  }
  if (!prueba.length) console.log('  (No hay ninguna. ¿La creaste desde el cuaderno PROI/SM2?)');

  // 2) De paso: dónde están las 8 tareas del proyecto SMR ahora mismo
  console.log('\nReparto actual de las tareas de proyecto SMR (módulo → grupos):');
  for (const modId of Object.keys(NOMBRE_MOD)) {
    const q = await db.collection('tareas').where('moduloId', '==', modId).get();
    if (q.empty) continue;
    const porG = {}; q.forEach(d => { const g = d.data().grupoId; porG[g] = (porG[g]||0)+1; });
    const etiq = Object.entries(porG).map(([g,n]) => `${NOMBRE_GRUPO[g]||g}:${n}`).join('  ');
    console.log(`  ${NOMBRE_MOD[modId]}  →  ${etiq}`);
  }
  await admin.app().delete();
}
main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
