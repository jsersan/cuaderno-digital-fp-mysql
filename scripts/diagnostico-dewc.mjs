#!/usr/bin/env node
/**
 * diagnostico-dewc.mjs  (SOLO LEE)
 * Muestra, por cada grupo DAW2 y por cada colección, cuántos documentos de
 * DEWC hay realmente, agrupados por grupoId + cursoAcademico. Sirve para
 * detectar grupos DAW2 duplicados y saber dónde están de verdad los datos.
 *
 * USO:  node scripts/diagnostico-dewc.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const norm = s => (s || '').toLowerCase().trim();
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const COLECCIONES = ['eventos_programacion', 'tareas', 'examenes', 'recuperaciones', 'calificaciones'];

async function run() {
  // DEWC
  let dewc = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!dewc && (norm(m.abreviatura) === 'dewc' || norm(m.abreviatura) === 'dwec'))
      dewc = { id: d.id, ...m };
  });
  console.log(`\n=== DEWC: ${dewc?.id} ===`);

  // Todos los grupos DAW2
  console.log('\n--- Grupos llamados DAW2 ---');
  const gruposDaw2 = [];
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (norm(g.nombre) === 'daw2') {
      gruposDaw2.push({ id: d.id, ...g });
      console.log(`   ${d.id}  ·  cursoAcademico: ${g.cursoAcademico || '(sin)'}  ·  alumnosIds: ${(g.alumnosIds||[]).length}`);
    }
  });

  // Recuento por colección, agrupado por grupoId real
  for (const col of COLECCIONES) {
    const snap = await db.collection(col).where('moduloId', '==', dewc.id).get();
    const porGrupo = {};
    snap.forEach(d => {
      const g = d.data().grupoId || '(sin grupoId)';
      porGrupo[g] = (porGrupo[g] || 0) + 1;
    });
    console.log(`\n--- ${col}: ${snap.size} docs de DEWC en total ---`);
    for (const [g, n] of Object.entries(porGrupo)) {
      const grupo = gruposDaw2.find(x => x.id === g);
      const etiqueta = grupo ? `DAW2 ${grupo.cursoAcademico}` : '⚠️ grupo desconocido';
      console.log(`   grupoId ${g}: ${n} docs  (${etiqueta})`);
    }
  }
  console.log('\n=== FIN ===\n');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
