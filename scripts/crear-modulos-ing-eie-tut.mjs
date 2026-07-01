#!/usr/bin/env node
/**
 * ============================================================================
 *  crear-modulos-ing-eie-tut.mjs
 *
 *  Crea los módulos de apoyo que faltan para completar el horario de SMR:
 *    · ING  "Inglés"                          (3 h/sem)
 *    · EIE  "Empresa e Iniciativa Emprendedora" (2 h/sem)
 *    · TUT  "Tutoría"                          (1 h/sem)
 *  En el ciclo SMR, curso 2, profesorId = '' (no salen en el Panel, sí en el
 *  Horario). Idempotente: si ya existen, no los duplica.
 *
 *  Seguridad: dry-run por defecto, backup JSON, --commit.
 *
 *  USO:
 *    node scripts/crear-modulos-ing-eie-tut.mjs            (simula)
 *    node scripts/crear-modulos-ing-eie-tut.mjs --commit    (aplica)
 * ============================================================================
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

const NUEVOS = [
  { abrev: 'ING', nombre: 'Inglés',                          horas: 3 },
  { abrev: 'EIE', nombre: 'Empresa e Iniciativa Emprendedora', horas: 2 },
  { abrev: 'TUT', nombre: 'Tutoría',                          horas: 1 },
];

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Crear módulos de apoyo SMR (ING, EIE, TUT) · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`));
  console.log(`Proyecto: ${sa.project_id}`);

  const mods = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const byAbrev = a => mods.find(m => norm(m.abreviatura) === norm(a));

  // Ciclo SMR a partir de un módulo conocido
  const ref = byAbrev('DBDR') || byAbrev('DASP') || byAbrev('PROI') || byAbrev('SOR');
  if (!ref) { console.error(C.r('❌ No encuentro un módulo SMR de referencia (DBDR/DASP/PROI/SOR).')); await admin.app().delete(); return; }
  const ciclo = ref.cicloId;
  console.log(`Ciclo SMR: ${ciclo}\n`);

  const aCrear = [];
  for (const x of NUEVOS) {
    if (byAbrev(x.abrev)) console.log(C.g(`· ${x.abrev} ya existe → se omite`));
    else { aCrear.push(x); console.log(C.v(`+ ${x.abrev} «${x.nombre}» (${x.horas} h/sem) → se creará`)); }
  }

  if (!aCrear.length) { console.log(C.a('\nNada que crear (ya existen todos).\n')); await admin.app().delete(); return; }

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para crear.\n'));
    await admin.app().delete(); return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const creados = [];
  for (const x of aCrear) {
    const r = await db.collection('modulos').add({
      nombre: x.nombre, abreviatura: x.abrev, cicloId: ciclo, curso: 2,
      horasSemanales: x.horas, horasTotales: x.horas * 21, profesorId: '',
      resultadosAprendizaje: [], ponderacionRA: {}, criteriosCalificacion: {},
      activo: true, esFCT: false, esProyecto: false, cursosArchivados: [],
      createdAt: now, updatedAt: now
    });
    creados.push({ abrev: x.abrev, id: r.id });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(__dirname, `backup-crear-ing-eie-tut-${stamp}.json`), JSON.stringify({ creados }, null, 2));

  console.log(C.v(`\n✅ Creados: ${creados.map(c => `${c.abrev}(${c.id.slice(0,6)})`).join(', ')}.`));
  console.log(C.a('   Vuelve al Horario y pulsa "Cargar propuesta 2º SMR" para colocarlos.\n'));
  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
