#!/usr/bin/env node
/**
 * ============================================================================
 *  renombrar-sm2-y-marcar-dasp.mjs
 *
 *  (1) Renombra los grupos cuyo nombre es exactamente "SM2"  →  "2SM2".
 *  (2) Marca el módulo DASP como 1º (curso = 1), que es lo que pinta la
 *      insignia de la tarjeta en el panel.
 *
 *  Seguridad: dry-run por defecto, backup JSON antes de escribir, idempotente
 *  (no re-renombra los que ya sean "2SM2"). Muestra cada grupo afectado con su
 *  ciclo, curso académico, módulos enlazados y nº de alumnos para que puedas
 *  revisarlo ANTES de confirmar.
 *
 *  USO:
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs                 (simulación)
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs --commit        (aplica)
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs --curso=2026-2027 --commit   (solo ese curso)
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs --grupo=ID --commit          (solo ese grupo)
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs --no-dasp --commit           (solo renombrar grupos)
 *    node scripts/renombrar-sm2-y-marcar-dasp.mjs --solo-dasp --commit         (solo marcar DASP)
 * ============================================================================
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const NO_DASP = process.argv.includes('--no-dasp');
const SOLO_DASP = process.argv.includes('--solo-dasp');
const argVal = (name, def) => { const a = process.argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : def; };
const CURSO_FILTRO = argVal('--curso', '');   // opcional: limita el renombrado a un curso académico
const GRUPO_FILTRO = argVal('--grupo', '');   // opcional: limita a un grupo concreto

const NOMBRE_ORIGEN = 'SM2';
const NOMBRE_DESTINO = '2SM2';
const ABREV_DASP = 'DASP';
const CURSO_DASP = 1;   // 1º

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().trim().toUpperCase();

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Renombrar SM2→2SM2 y marcar DASP 1º · ${COMMIT ? 'COMMIT (escribe)' : 'DRY-RUN (no escribe)'} ===`));
  console.log(`Proyecto: ${sa.project_id}`);
  if (CURSO_FILTRO) console.log(`Filtro de curso: ${CURSO_FILTRO}`);
  if (GRUPO_FILTRO) console.log(`Filtro de grupo: ${GRUPO_FILTRO}`);

  const backup = { generado: new Date().toISOString(), grupos: [], modulo: null };

  // ── (1) RENOMBRAR GRUPOS SM2 → 2SM2 ──────────────────────────────────────
  let renombrar = [];
  if (!SOLO_DASP) {
    const gruposSnap = await db.collection('grupos').get();
    const todos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renombrar = todos.filter(g => norm(g.nombre) === NOMBRE_ORIGEN
      && (!CURSO_FILTRO || g.cursoAcademico === CURSO_FILTRO)
      && (!GRUPO_FILTRO || g.id === GRUPO_FILTRO));

    console.log(C.a(`\n[1] GRUPOS "${NOMBRE_ORIGEN}" → "${NOMBRE_DESTINO}": ${renombrar.length} encontrado(s)`));
    if (!renombrar.length) console.log(C.g('   (ninguno; quizá ya están renombrados a 2SM2)'));
    for (const g of renombrar) {
      const nAl = (g.alumnosIds || []).length;
      const nMod = (g.modulosIds || []).length;
      console.log(`   • ${g.id}  "${g.nombre}" → "${NOMBRE_DESTINO}"  [curso ${g.cursoAcademico || '?'} · ciclo ${(g.cicloId||'?').slice(0,6)} · ${nMod} módulos · ${nAl} alumnos]`);
      backup.grupos.push({ id: g.id, nombreAnterior: g.nombre });
    }
  }

  // ── (2) MARCAR DASP COMO 1º (curso = 1) ──────────────────────────────────
  let dasp = null;
  if (!NO_DASP) {
    const modsSnap = await db.collection('modulos').get();
    const cands = modsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => norm(m.abreviatura) === norm(ABREV_DASP));
    console.log(C.a(`\n[2] Módulo DASP → curso = ${CURSO_DASP} (1º): ${cands.length} encontrado(s)`));
    if (cands.length > 1) console.log(C.r(`   ⚠ Hay ${cands.length} módulos DASP; se marcarán todos.`));
    for (const m of cands) {
      console.log(`   • ${m.id}  «${m.nombre}»  curso ${m.curso ?? '?'} → ${CURSO_DASP}`);
      backup.modulo = backup.modulo || [];
      backup.modulo.push({ id: m.id, cursoAnterior: m.curso ?? null });
    }
    dasp = cands;
  }

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para aplicar.\n'));
    await admin.app().delete();
    return;
  }

  // Backup
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bpath = join(__dirname, `backup-rename-sm2-${stamp}.json`);
  writeFileSync(bpath, JSON.stringify(backup, null, 2));
  console.log(C.g(`\nBackup guardado: ${bpath}`));

  // Aplicar
  const now = admin.firestore.FieldValue.serverTimestamp();
  let nG = 0, nM = 0;
  const batch = db.batch();
  for (const g of renombrar) { batch.update(db.collection('grupos').doc(g.id), { nombre: NOMBRE_DESTINO, updatedAt: now }); nG++; }
  if (dasp) for (const m of dasp) { batch.update(db.collection('modulos').doc(m.id), { curso: CURSO_DASP, updatedAt: now }); nM++; }
  await batch.commit();

  console.log(C.v(`\n✅ Hecho: ${nG} grupo(s) renombrado(s) a "${NOMBRE_DESTINO}"${dasp ? ` · ${nM} módulo(s) DASP marcado(s) como ${CURSO_DASP}º` : ''}.`));
  if (nG > 0) console.log(C.a('\n⚠ OJO: los scripts simular-*-(apin|dasp|dbdr) buscan el grupo por nombre "SM2".\n   Tras este renombrado, pásales --grupo=ID o avísame y actualizo NOMBRE_GRUPO a "2SM2".'));
  console.log('');
  await admin.app().delete();
}

main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
