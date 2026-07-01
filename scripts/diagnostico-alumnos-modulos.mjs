#!/usr/bin/env node
/**
 * diagnostico-alumnos-modulos.mjs  (SOLO LEE)
 * 1) Lista los módulos cuya abreviatura sea DWEC/DEWC/DCLI/PROY con su id,
 *    nombre y profesorId (para detectar módulos duplicados).
 * 2) Lista los alumnos (email + nombre) de cada grupo DAW2, para ver si los
 *    de un grupo coinciden con los de otro antes de consolidar.
 *
 * USO:  node scripts/diagnostico-alumnos-modulos.mjs
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

async function run() {
  // 1) Módulos relevantes
  console.log(`\n${'═'.repeat(64)}`);
  console.log('  MÓDULOS (DWEC / DEWC / DCLI / PROY)');
  console.log(`${'═'.repeat(64)}`);
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    const ab = norm(m.abreviatura);
    if (['dwec', 'dewc', 'dcli', 'proy'].includes(ab)) {
      console.log(`   ${(m.abreviatura||'').padEnd(6)} id=${d.id}  ·  "${m.nombre || ''}"  ·  profesorId=${m.profesorId || '(sin)'}  ·  cicloId=${m.cicloId || '(sin)'}`);
    }
  });

  // 2) Alumnos por grupo DAW2
  const grupos = [];
  (await db.collection('grupos').get()).forEach(d => {
    if (norm(d.data().nombre) === 'daw2') grupos.push({ id: d.id, ...d.data() });
  });

  const emailsPorGrupo = {};
  for (const g of grupos) {
    console.log(`\n${'─'.repeat(64)}`);
    console.log(`  ALUMNOS de DAW2 ${g.cursoAcademico}  (grupo ${g.id})`);
    console.log(`${'─'.repeat(64)}`);
    const snap = await db.collection('alumnos').where('grupoId', '==', g.id).get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));
    emailsPorGrupo[g.id] = new Set(lista.map(a => norm(a.email)));
    lista.forEach(a => {
      console.log(`   ${(a.email || '(sin email)').padEnd(36)} ${a.apellidos}, ${a.nombre}`);
    });
    if (lista.length === 0) console.log('   (sin alumnos)');
  }

  // 3) Comparación de solapamiento entre grupos de 2025-2026
  const g2526 = grupos.filter(g => g.cursoAcademico === '2025-2026');
  if (g2526.length >= 2) {
    console.log(`\n${'═'.repeat(64)}`);
    console.log('  SOLAPAMIENTO de alumnos entre los DAW2 de 2025-2026');
    console.log(`${'═'.repeat(64)}`);
    for (let i = 0; i < g2526.length; i++) {
      for (let j = i + 1; j < g2526.length; j++) {
        const a = emailsPorGrupo[g2526[i].id], b = emailsPorGrupo[g2526[j].id];
        const comunes = [...a].filter(e => e && b.has(e));
        console.log(`   ${g2526[i].id}  vs  ${g2526[j].id}`);
        console.log(`      ${g2526[i].id}: ${a.size} alumnos · ${g2526[j].id}: ${b.size} alumnos · en común: ${comunes.length}`);
      }
    }
  }
  console.log('');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
