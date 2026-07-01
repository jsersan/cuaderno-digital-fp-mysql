#!/usr/bin/env node
/**
 * ============================================================================
 *  DIAGNÓSTICO (solo lectura) de grupos, alumnos y módulos.
 *  NO escribe ni borra nada. Sirve para entender los duplicados antes de
 *  consolidar.
 *
 *  USO:
 *    node diagnostico-grupos.mjs
 * ============================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let serviceAccount;
for (const p of [resolve(__dirname, 'serviceAccount.json'), resolve(__dirname, 'scripts', 'serviceAccount.json')]) {
  try { serviceAccount = JSON.parse(readFileSync(p, 'utf-8')); break; } catch {}
}
if (!serviceAccount) { console.error('❌ No se encontró serviceAccount.json'); process.exit(1); }
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log(`\n🔌 Proyecto: ${serviceAccount.project_id}\n`);

  // 1) Todos los grupos
  const gruposSnap = await db.collection('grupos').get();
  const grupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2) Todos los alumnos y módulos (para contar por grupo)
  const alumnosSnap = await db.collection('alumnos').get();
  const alumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const modsSnap = await db.collection('modulos').get();
  const modulos = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('═'.repeat(78));
  console.log(`  GRUPOS EN FIRESTORE: ${grupos.length}`);
  console.log('═'.repeat(78));

  // Agrupar por nombre para detectar duplicados
  const porNombre = {};
  for (const g of grupos) {
    const n = (g.nombre || '(sin nombre)').trim();
    (porNombre[n] = porNombre[n] || []).push(g);
  }

  for (const [nombre, lista] of Object.entries(porNombre)) {
    const dup = lista.length > 1 ? `  ⚠️ DUPLICADO ×${lista.length}` : '';
    console.log(`\n▶ "${nombre}"${dup}`);
    for (const g of lista) {
      const nAlumnosCampo = (g.alumnosIds || []).length;
      const nAlumnosReal = alumnos.filter(a => a.grupoId === g.id).length;
      const nAlumnosActivos = alumnos.filter(a => a.grupoId === g.id && (a.estado === undefined || a.estado === 'activo')).length;
      const modsDelGrupo = modulos.filter(m => m.grupoId === g.id || (g.modulosIds || []).includes(m.id));
      console.log(`   id: ${g.id}`);
      console.log(`      curso: ${g.curso ?? '—'} · cicloId: ${g.cicloId ?? '—'} · cursoAcadémico: ${g.cursoAcademico ?? '—'} · activo: ${g.activo ?? '—'}`);
      console.log(`      alumnos: ${nAlumnosReal} reales (${nAlumnosActivos} activos) · alumnosIds[]: ${nAlumnosCampo}`);
      console.log(`      módulos: ${modsDelGrupo.map(m => m.abreviatura).join(', ') || '(ninguno)'}`);
    }
  }

  // 3) Resumen de módulos y a qué grupo apuntan
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`  MÓDULOS: ${modulos.length}`);
  console.log('═'.repeat(78));
  for (const m of modulos) {
    const g = grupos.find(x => x.id === m.grupoId);
    console.log(`   ${(m.abreviatura || '—').padEnd(6)} grupoId: ${m.grupoId ?? '—'} → ${g ? '"' + g.nombre + '"' : '❌ grupo inexistente'}`);
  }

  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Este script es SOLO LECTURA. No se ha modificado nada.');
  console.log('═'.repeat(78) + '\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
