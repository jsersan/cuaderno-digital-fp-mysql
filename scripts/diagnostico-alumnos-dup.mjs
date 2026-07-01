#!/usr/bin/env node
/**
 * ============================================================================
 *  DIAGNÓSTICO (solo lectura) de ALUMNOS DUPLICADOS por email.
 *  No escribe nada. Muestra, por cada email repetido, en qué grupos está.
 *
 *  USO:
 *    node diagnostico-alumnos-dup.mjs
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

  // Grupos: id → nombre + año (para mostrar legible)
  const gruposSnap = await db.collection('grupos').get();
  const grupos = {};
  gruposSnap.docs.forEach(d => { const g = d.data(); grupos[d.id] = `${g.nombre} [${g.cursoAcademico}]`; });

  // Alumnos
  const alumnosSnap = await db.collection('alumnos').get();
  const alumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('═'.repeat(80));
  console.log(`  ALUMNOS TOTALES: ${alumnos.length}`);
  console.log('═'.repeat(80));

  // Agrupar por email (clave de identidad)
  const porEmail = {};
  for (const a of alumnos) {
    const k = (a.email || '(sin email)').toLowerCase().trim();
    (porEmail[k] = porEmail[k] || []).push(a);
  }

  const duplicados = Object.entries(porEmail).filter(([, l]) => l.length > 1);
  const unicos = Object.entries(porEmail).filter(([, l]) => l.length === 1);

  console.log(`  Emails únicos:        ${unicos.length}`);
  console.log(`  Emails DUPLICADOS:    ${duplicados.length}`);
  console.log(`  Copias sobrantes:     ${duplicados.reduce((s, [, l]) => s + (l.length - 1), 0)}`);
  console.log('═'.repeat(80) + '\n');

  if (duplicados.length === 0) { console.log('✅ No hay duplicados.\n'); process.exit(0); }

  console.log('── Detalle de duplicados (email → copias y su grupo) ──\n');
  for (const [email, lista] of duplicados.sort()) {
    const a0 = lista[0];
    console.log(`▶ ${a0.apellidos}, ${a0.nombre}  ·  ${email}  ·  ${lista.length} copias`);
    for (const a of lista) {
      const grp = grupos[a.grupoId] || `❓ grupo inexistente (${a.grupoId})`;
      console.log(`     docId: ${a.id}  ·  grupoId: ${a.grupoId}  →  ${grp}  ·  estado: ${a.estado ?? '—'}`);
    }
    console.log('');
  }

  // Resumen por grupo: cuántos alumnos cuelga cada grupo
  console.log('═'.repeat(80));
  console.log('  ALUMNOS POR GRUPO');
  console.log('═'.repeat(80));
  const porGrupo = {};
  for (const a of alumnos) porGrupo[a.grupoId] = (porGrupo[a.grupoId] || 0) + 1;
  for (const [gid, n] of Object.entries(porGrupo).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}  ${grupos[gid] || '❓ inexistente'}  (${gid})`);
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  SOLO LECTURA. No se ha modificado nada.');
  console.log('═'.repeat(80) + '\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
