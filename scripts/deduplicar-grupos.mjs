#!/usr/bin/env node
/**
 * ============================================================================
 *  deduplicar-grupos.mjs   (curso 2026-2027)
 *
 *  Deja UN único grupo por nombre canónico y borra los duplicados:
 *     · "2AW3" → ciclo DAW   (el que tenga más alumnos = se conserva)
 *     · "2SM2" → ciclo SMR
 *
 *  Para cada duplicado:
 *     - Si tiene alumnos y es del MISMO ciclo que el que se conserva →
 *       reasigna sus alumnos (grupoId) al que se queda y lo borra.
 *     - Si está vacío → lo borra.
 *     - Si tiene alumnos pero es de OTRO ciclo (p.ej. un "2AW3" colado en SMR) →
 *       NO lo toca: avisa para que decidas a mano (evita mover alumnos al ciclo
 *       equivocado).
 *
 *  Seguridad: dry-run por defecto, backup JSON, --commit. Idempotente.
 *
 *  USO:
 *    node scripts/deduplicar-grupos.mjs                     (diagnóstico + plan)
 *    node scripts/deduplicar-grupos.mjs --commit             (aplica)
 *    node scripts/deduplicar-grupos.mjs --keep2aw3=ID --keep2sm2=ID --commit
 * ============================================================================
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const argVal = (n, d) => { const a = process.argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const CURSO = argVal('--curso', '2026-2027');
const KEEP = { '2AW3': argVal('--keep2aw3', ''), '2SM2': argVal('--keep2sm2', '') };

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Deduplicar grupos · ${CURSO} · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`));
  console.log(`Proyecto: ${sa.project_id}`);

  const grupos  = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const modulos = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const alumnos = (await db.collection('alumnos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const countByGrupo = id => alumnos.filter(a => a.grupoId === id).length;
  const nAlumnos = g => countByGrupo(g.id) + (g.alumnosIds || []).length;

  // Ciclos de referencia
  const cicloDe = (...abrevs) => {
    const m = modulos.find(x => abrevs.includes(norm(x.abreviatura)));
    return m ? m.cicloId : '';
  };
  const cicloDAW = cicloDe('DWEC', 'DWES', 'DIW');
  const cicloSMR = cicloDe('DBDR', 'DASP', 'PROI', 'SOR', 'SVR');
  console.log(C.g(`Ciclo DAW: ${cicloDAW || '∅'}   Ciclo SMR: ${cicloSMR || '∅'}`));

  const TARGETS = [
    { nombre: '2AW3', ciclo: cicloDAW },
    { nombre: '2SM2', ciclo: cicloSMR },
  ];

  // Diagnóstico
  console.log(C.a('\nGrupos del curso ' + CURSO + ':'));
  for (const g of grupos.filter(g => g.cursoAcademico === CURSO)) {
    console.log(`  ${g.id.slice(0,8)} · ${(g.nombre||'∅').padEnd(7)} · ciclo:${(g.cicloId||'∅').slice(0,8)} · c${g.curso ?? '?'} · alumnos:${nAlumnos(g)} (grupoId:${countByGrupo(g.id)})`);
  }

  const backup = { generado: new Date().toISOString(), CURSO, acciones: [] };
  const plan = [];

  for (const t of TARGETS) {
    if (!t.ciclo) { console.log(C.a(`\n· No detecto ciclo para ${t.nombre}; lo salto.`)); continue; }
    const cands = grupos.filter(g => g.cursoAcademico === CURSO && norm(g.nombre) === norm(t.nombre));
    if (cands.length <= 1) { console.log(C.g(`\n${t.nombre}: ${cands.length} grupo (sin duplicados).`)); continue; }

    // Elegir el que se conserva
    let keeper = KEEP[t.nombre] ? cands.find(g => g.id === KEEP[t.nombre]) : null;
    if (!keeper) {
      const delCiclo = cands.filter(g => g.cicloId === t.ciclo);
      const pool = delCiclo.length ? delCiclo : cands;
      keeper = pool.slice().sort((a, b) => nAlumnos(b) - nAlumnos(a))[0];
    }
    console.log(C.a(`\n${t.nombre}: ${cands.length} duplicados → se conserva ${keeper.id.slice(0,8)} (alumnos:${nAlumnos(keeper)}, ciclo:${keeper.cicloId===t.ciclo?'OK':'≠'})`));

    // Asegurar ciclo/curso correctos en el keeper
    if (keeper.cicloId !== t.ciclo) plan.push({ tipo: 'fixKeeper', ref: keeper.ref, id: keeper.id, data: { cicloId: t.ciclo, curso: 2 } });

    for (const dup of cands) {
      if (dup.id === keeper.id) continue;
      const conAlumnos = countByGrupo(dup.id);
      if (conAlumnos > 0 && dup.cicloId !== keeper.cicloId) {
        console.log(C.r(`   ⚠ ${dup.id.slice(0,8)} tiene ${conAlumnos} alumno(s) y es de OTRO ciclo (${(dup.cicloId||'∅').slice(0,8)}). LO DEJO; decide a mano.`));
        continue;
      }
      const alumnosDup = alumnos.filter(a => a.grupoId === dup.id);
      plan.push({ tipo: 'dedupe', dup, keeper, alumnosDup });
      backup.acciones.push({ borrar: dup.id, nombre: dup.nombre, ciclo: dup.cicloId, keeper: keeper.id,
        alumnosMovidos: alumnosDup.map(a => a.id) });
      console.log(`   • borrar ${dup.id.slice(0,8)} (alumnos:${conAlumnos})${conAlumnos?` → mover a ${keeper.id.slice(0,8)}`:''}`);
    }
  }

  if (!plan.length) { console.log(C.v('\n✅ No hay nada que deduplicar.\n')); await admin.app().delete(); return; }

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para aplicar.\n'));
    await admin.app().delete(); return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(__dirname, `backup-deduplicar-grupos-${stamp}.json`), JSON.stringify(backup, null, 2));
  console.log(C.g(`\nBackup: backup-deduplicar-grupos-${stamp}.json`));

  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const p of plan) {
    if (p.tipo === 'fixKeeper') {
      await p.ref.update({ ...p.data, updatedAt: now });
      console.log(C.v(`✓ keeper ${p.id.slice(0,8)} → ciclo/curso corregidos`));
      continue;
    }
    // dedupe: mover alumnos del dup al keeper y borrar el dup
    if (p.alumnosDup.length) {
      let b = db.batch(), c = 0;
      for (const a of p.alumnosDup) { b.update(a.ref, { grupoId: p.keeper.id, updatedAt: now }); if (++c % 400 === 0) { await b.commit(); b = db.batch(); } }
      await b.commit();
      const ids = Array.from(new Set([...((p.keeper.alumnosIds)||[]), ...p.alumnosDup.map(a => a.id)]));
      await p.keeper.ref.update({ alumnosIds: ids, updatedAt: now });
      p.keeper.alumnosIds = ids; // por si otro dup del mismo keeper viene después
      console.log(C.v(`✓ ${p.alumnosDup.length} alumno(s) ${p.dup.id.slice(0,8)} → ${p.keeper.id.slice(0,8)}`));
    }
    await p.dup.ref.delete();
    console.log(C.v(`✓ borrado grupo duplicado ${p.dup.id.slice(0,8)} (${p.dup.nombre})`));
  }

  console.log(C.v('\n✅ Deduplicación completada. Cada nombre queda con un único grupo.\n'));
  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
