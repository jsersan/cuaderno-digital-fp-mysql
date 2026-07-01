#!/usr/bin/env node
/**
 * ============================================================================
 *  ajustar-modulos-smr-dcb.mjs
 *
 *  Deja la estructura de módulos de SMR coherente con el DCB oficial:
 *    1) SEG (Seguridad informática, 0226) → 1º: curso = 1, profesorId = ''.
 *    2) SOR (creado como "Servicios en red") → "Sistemas operativos en red"
 *       (0224), curso = 2, horasSemanales = 8, profesorId = ''.
 *    3) Crear si faltan (curso 2, sin profesor → fuera del Panel, dentro del Horario):
 *         · Servicios en red          (SVR, 9 h/sem, 0227)
 *         · Aplicaciones web          (AW,  5 h/sem, 0228)
 *         · Formación y Orientación L. (FOL, 5 h/sem, 0229)
 *         · Empresa e Iniciativa E.    (EIE, 3 h/sem, 0239)
 *
 *  profesorId = '' en los de otros profes → NO aparecen en el Panel (que filtra
 *  por profesor) pero SÍ en el Horario (que carga todos los del ciclo).
 *
 *  Seguridad: dry-run por defecto, backup JSON, --commit. Idempotente.
 *
 *  USO:
 *    node scripts/ajustar-modulos-smr-dcb.mjs            (simula)
 *    node scripts/ajustar-modulos-smr-dcb.mjs --commit    (aplica)
 *    node scripts/ajustar-modulos-smr-dcb.mjs --grupo1=ID --grupo2=ID --commit
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

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Módulos de 2º a garantizar (crear si faltan). SOR se trata aparte (renombrado).
const CREAR_2 = [
  { abrev: 'SVR', nombre: 'Servicios en red',           horas: 9 },
  { abrev: 'AW',  nombre: 'Aplicaciones web',           horas: 5 },
  { abrev: 'FOL', nombre: 'Formación y Orientación Laboral', horas: 5 },
  { abrev: 'EIE', nombre: 'Empresa e Iniciativa Emprendedora', horas: 3 },
];

async function main() {
  console.log(C.a(`\n=== Ajustar módulos SMR al DCB · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`));
  console.log(`Proyecto: ${sa.project_id}  ·  Curso: ${CURSO}`);

  const mods = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const byAbrev = a => mods.find(m => norm(m.abreviatura) === norm(a));

  // Detectar ciclo SMR a partir de un módulo conocido (DASP/DBDR/PROI/SOR)
  const ref = byAbrev('DBDR') || byAbrev('DASP') || byAbrev('PROI') || byAbrev('SOR');
  if (!ref) { console.error(C.r('❌ No encuentro ningún módulo SMR de referencia (DBDR/DASP/PROI/SOR).')); await admin.app().delete(); return; }
  const ciclo = ref.cicloId;
  console.log(`Ciclo SMR: ${ciclo}`);

  const backup = { generado: new Date().toISOString(), cambios: [] };
  const plan = [];

  // (1) SEG → 1º, sin profesor
  const seg = byAbrev('SEG');
  if (seg) {
    plan.push({ tipo: 'update', ref: seg.ref, label: `SEG → curso 1, profesorId ''`,
      data: { curso: 1, profesorId: '' } });
    backup.cambios.push({ id: seg.id, antes: { curso: seg.curso ?? null, profesorId: seg.profesorId ?? null } });
  } else console.log(C.a('· SEG no existe (se omite).'));

  // (2) SOR → "Sistemas operativos en red", curso 2, 8h, sin profesor
  const sor = byAbrev('SOR');
  if (sor) {
    plan.push({ tipo: 'update', ref: sor.ref, label: `SOR → "Sistemas operativos en red", curso 2, 8h, profesorId ''`,
      data: { nombre: 'Sistemas operativos en red', curso: 2, horasSemanales: 8, profesorId: '' } });
    backup.cambios.push({ id: sor.id, antes: { nombre: sor.nombre, curso: sor.curso ?? null, horasSemanales: sor.horasSemanales ?? null, profesorId: sor.profesorId ?? null } });
  } else {
    // si no existe SOR, lo creamos como Sistemas operativos en red
    plan.push({ tipo: 'create', label: `crear SOR "Sistemas operativos en red" (curso 2, 8h)`,
      data: nuevoModulo(ciclo, 'SOR', 'Sistemas operativos en red', 8) });
  }

  // (3) Crear los de 2º que falten
  for (const x of CREAR_2) {
    const m = byAbrev(x.abrev);
    if (m) {
      // si ya existe, asegurar curso 2, horas y sin profesor
      plan.push({ tipo: 'update', ref: m.ref, label: `${x.abrev} ya existe → curso 2, ${x.horas}h, profesorId ''`,
        data: { curso: 2, horasSemanales: x.horas, profesorId: '' } });
      backup.cambios.push({ id: m.id, antes: { curso: m.curso ?? null, horasSemanales: m.horasSemanales ?? null, profesorId: m.profesorId ?? null } });
    } else {
      plan.push({ tipo: 'create', label: `crear ${x.abrev} "${x.nombre}" (curso 2, ${x.horas}h)`,
        data: nuevoModulo(ciclo, x.abrev, x.nombre, x.horas) });
    }
  }

  console.log(C.a('\nPlan:'));
  plan.forEach(p => console.log(`   • ${p.label}`));

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para aplicar.\n'));
    await admin.app().delete(); return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(__dirname, `backup-modulos-smr-${stamp}.json`), JSON.stringify(backup, null, 2));
  console.log(C.g(`\nBackup guardado: backup-modulos-smr-${stamp}.json`));

  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const p of plan) {
    if (p.tipo === 'update') await p.ref.update({ ...p.data, updatedAt: now });
    else await db.collection('modulos').add({ ...p.data, createdAt: now, updatedAt: now });
  }
  console.log(C.v(`\n✅ Aplicados ${plan.length} cambios. Los módulos de otros profes (profesorId '') no saldrán en el Panel, sí en el Horario.\n`));
  await admin.app().delete();
}

function nuevoModulo(ciclo, abrev, nombre, horas) {
  return {
    nombre, abreviatura: abrev, cicloId: ciclo, curso: 2,
    horasSemanales: horas, horasTotales: horas * 21, profesorId: '',
    resultadosAprendizaje: [], ponderacionRA: {}, criteriosCalificacion: {},
    activo: true, esFCT: false, esProyecto: false, cursosArchivados: []
  };
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
