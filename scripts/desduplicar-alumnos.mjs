#!/usr/bin/env node
/**
 * ============================================================================
 *  DES-DUPLICADOR de alumnos por email.
 *
 *  Regla (acordada):
 *    Por cada email con varias copias, conservar UNA con esta prioridad:
 *      1) copia en 2AW3 bueno  AJdeLlMHMguP1VwxQ0Nz  (2025-2026)
 *      2) si no, copia en SM2 bueno  94Xc7HWat6IQ953lL6Gd
 *      3) si no, una copia en un grupo que EXISTA
 *      4) si no, la primera (último recurso)
 *    Borrar TODAS las demás copias de ese email.
 *    Nunca se borra el último ejemplar de un alumno.
 *
 *  Según diagnóstico: 12 emails duplicados, cada uno con copia en
 *  AJdeLl (conservar) y en JO4shg / 2AW3 2026-2027 (borrar).
 *
 *  USO:
 *    node desduplicar-alumnos.mjs            # dry-run (no escribe)
 *    node desduplicar-alumnos.mjs --apply    # ejecuta
 *
 *  ⚠️  HAZ COPIA DE SEGURIDAD ANTES. Los borrados son IRREVERSIBLES.
 * ============================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// Prioridad de conservación (grupos "buenos")
const PRIORIDAD = [
  'AJdeLlMHMguP1VwxQ0Nz',  // 2AW3 2025-2026 (el bueno)
  '94Xc7HWat6IQ953lL6Gd'   // SM2 2025-2026 (el bueno)
];

// Salvaguarda: no borrar más de este nº de alumnos (si se supera, aborta)
const MAX_BORRADOS = 100;

// ── Firebase ─────────────────────────────────────────────────────────────────
let serviceAccount;
for (const p of [resolve(__dirname, 'serviceAccount.json'), resolve(__dirname, 'scripts', 'serviceAccount.json')]) {
  try { serviceAccount = JSON.parse(readFileSync(p, 'utf-8')); break; } catch {}
}
if (!serviceAccount) { console.error('❌ No se encontró serviceAccount.json'); process.exit(1); }
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const log = (tag, msg) => console.log(`${APPLY ? '✅' : '🔍'} [${tag}] ${msg}`);

async function main() {
  console.log(`\n${'─'.repeat(78)}`);
  console.log(APPLY ? '🚀  MODO --apply: se BORRARÁN alumnos duplicados en Firestore'
                    : '🔍  MODO DRY-RUN: solo se muestra lo que se haría (añade --apply)');
  console.log(`${'─'.repeat(78)}`);
  console.log('⚠️  Asegúrate de haber hecho COPIA DE SEGURIDAD. Los borrados son irreversibles.\n');

  // Grupos existentes (para saber cuáles son fantasma y mostrar legible)
  const gruposSnap = await db.collection('grupos').get();
  const gruposExisten = new Set(gruposSnap.docs.map(d => d.id));
  const gruposLabel = {};
  gruposSnap.docs.forEach(d => { const g = d.data(); gruposLabel[d.id] = `${g.nombre} [${g.cursoAcademico}]`; });

  // Alumnos agrupados por email
  const alumnosSnap = await db.collection('alumnos').get();
  const alumnos = alumnosSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const porEmail = {};
  for (const a of alumnos) {
    const k = (a.email || `__sinemail__${a.id}`).toLowerCase().trim();
    (porEmail[k] = porEmail[k] || []).push(a);
  }

  // Elegir la copia a conservar según prioridad
  function elegirConservada(copias) {
    for (const gid of PRIORIDAD) {
      const c = copias.find(a => a.grupoId === gid);
      if (c) return c;
    }
    const enGrupoReal = copias.find(a => gruposExisten.has(a.grupoId));
    if (enGrupoReal) return enGrupoReal;
    return copias[0];
  }

  const aBorrar = [];
  let nDup = 0;

  for (const [email, copias] of Object.entries(porEmail)) {
    if (copias.length <= 1) continue;  // sin duplicar → intacto
    nDup++;
    const conservar = elegirConservada(copias);
    const borrar = copias.filter(a => a.id !== conservar.id);

    const a0 = copias[0];
    console.log(`▶ ${a0.apellidos}, ${a0.nombre}  ·  ${email}`);
    console.log(`     CONSERVAR docId ${conservar.id}  →  ${gruposLabel[conservar.grupoId] || '❓ ' + conservar.grupoId}`);
    for (const b of borrar) {
      console.log(`     BORRAR    docId ${b.id}  →  ${gruposLabel[b.grupoId] || '❓ fantasma ' + b.grupoId}`);
      aBorrar.push(b);
    }
    console.log('');
  }

  // Salvaguarda
  if (aBorrar.length > MAX_BORRADOS) {
    console.error(`❌ Se intentarían borrar ${aBorrar.length} alumnos (> ${MAX_BORRADOS}). Aborto por seguridad.`);
    process.exit(1);
  }

  console.log('═'.repeat(78));
  console.log(`  Emails duplicados: ${nDup}  ·  Copias a borrar: ${aBorrar.length}`);
  console.log('═'.repeat(78) + '\n');

  if (aBorrar.length === 0) { console.log('✅ No hay duplicados que borrar.\n'); process.exit(0); }

  if (APPLY) {
    let i = 0;
    while (i < aBorrar.length) {
      const batch = db.batch();
      for (const b of aBorrar.slice(i, i + 450)) batch.delete(b.ref);
      await batch.commit();
      i += 450;
    }
    console.log(`✅  ${aBorrar.length} copia(s) duplicada(s) borrada(s). Recarga la app (Ctrl+Shift+R).\n`);
  } else {
    console.log('ℹ️   Revisa que las copias CONSERVADAS son las correctas. Si cuadra:');
    console.log('    node desduplicar-alumnos.mjs --apply\n');
  }
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
