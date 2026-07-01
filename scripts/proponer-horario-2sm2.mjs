#!/usr/bin/env node
/**
 * ============================================================================
 *  proponer-horario-2sm2.mjs   (curso 2026-2027)
 *
 *  Rellena grupo.horario del grupo 2SM2 (2026-2027) con la propuesta de 2º SMR,
 *  en el MISMO formato que usa la app:
 *    grupo.horario = { lunes:[], martes:[], miercoles:[], jueves:[], viernes:[] }
 *    cada celda = { horaInicio, horaFin, moduloId, moduloAbreviatura, profesorId, aula }
 *
 *  Resuelve cada módulo por abreviatura DENTRO DEL CICLO del grupo (igual que el
 *  botón "Cargar propuesta" del componente). Avisa de los que no encuentre.
 *
 *  Seguridad: dry-run por defecto, backup del horario anterior, --commit.
 *
 *  USO:
 *    node scripts/proponer-horario-2sm2.mjs                 (simulación)
 *    node scripts/proponer-horario-2sm2.mjs --commit         (escribe)
 *    node scripts/proponer-horario-2sm2.mjs --grupo=ID --commit
 *    node scripts/proponer-horario-2sm2.mjs --grupo-nombre=2SM2 --curso=2026-2027
 * ============================================================================
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const argVal = (name, def) => { const a = process.argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : def; };
const GRUPO_ID = argVal('--grupo', '');
const NOMBRE_GRUPO = argVal('--grupo-nombre', '2SM2');   // tras el renombrado SM2→2SM2
const CURSO = argVal('--curso', '2026-2027');

const FRANJAS = ['08:30-09:25', '09:25-10:20', '10:20-11:15', '11:45-12:40', '12:40-13:35', '13:35-14:30'];

// Propuesta oficial de 2º SMR (DCB), idéntica a la del componente:
// SVR 9 · SOR 8 · AW 5 · FOL 5 · EIE 3 = 30 sesiones (= 21 semanas sept-feb)
//   SVR=Servicios en red · SOR=Sistemas operativos en red · AW=Aplicaciones web
const PROPUESTA = [
  { dia: 'lunes', ini: '08:30', abrev: 'SVR' }, { dia: 'martes', ini: '08:30', abrev: 'SOR' }, { dia: 'miercoles', ini: '08:30', abrev: 'AW' }, { dia: 'jueves', ini: '08:30', abrev: 'FOL' }, { dia: 'viernes', ini: '08:30', abrev: 'EIE' },
  { dia: 'lunes', ini: '09:25', abrev: 'SVR' }, { dia: 'martes', ini: '09:25', abrev: 'SOR' }, { dia: 'miercoles', ini: '09:25', abrev: 'AW' }, { dia: 'jueves', ini: '09:25', abrev: 'FOL' }, { dia: 'viernes', ini: '09:25', abrev: 'SVR' },
  { dia: 'lunes', ini: '10:20', abrev: 'SOR' }, { dia: 'martes', ini: '10:20', abrev: 'SVR' }, { dia: 'miercoles', ini: '10:20', abrev: 'SOR' }, { dia: 'jueves', ini: '10:20', abrev: 'AW' }, { dia: 'viernes', ini: '10:20', abrev: 'SVR' },
  { dia: 'lunes', ini: '11:45', abrev: 'SVR' }, { dia: 'martes', ini: '11:45', abrev: 'SOR' }, { dia: 'miercoles', ini: '11:45', abrev: 'SVR' }, { dia: 'jueves', ini: '11:45', abrev: 'FOL' }, { dia: 'viernes', ini: '11:45', abrev: 'SOR' },
  { dia: 'lunes', ini: '12:40', abrev: 'SOR' }, { dia: 'martes', ini: '12:40', abrev: 'AW' }, { dia: 'miercoles', ini: '12:40', abrev: 'SVR' }, { dia: 'jueves', ini: '12:40', abrev: 'FOL' }, { dia: 'viernes', ini: '12:40', abrev: 'EIE' },
  { dia: 'lunes', ini: '13:35', abrev: 'FOL' }, { dia: 'martes', ini: '13:35', abrev: 'SVR' }, { dia: 'miercoles', ini: '13:35', abrev: 'SOR' }, { dia: 'jueves', ini: '13:35', abrev: 'AW' }, { dia: 'viernes', ini: '13:35', abrev: 'EIE' }
];

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
const finDeFranja = ini => { const fr = FRANJAS.find(f => f.startsWith(ini)); return fr ? fr.split('-')[1] : ini; };

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Propuesta horario 2º SMR → grupo ${NOMBRE_GRUPO} (${CURSO}) · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`));
  console.log(`Proyecto: ${sa.project_id}`);

  // Resolver grupo
  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  let grupo = GRUPO_ID ? grupos.find(g => g.id === GRUPO_ID) : null;
  if (!grupo) {
    const cands = grupos.filter(g => (norm(g.nombre) === norm(NOMBRE_GRUPO) || norm(g.nombre) === norm('SM2')) && (!CURSO || g.cursoAcademico === CURSO));
    if (cands.length > 1) console.log(C.a(`ℹ Varios candidatos: ${cands.map(g => `${g.id}/${g.nombre}/${g.cursoAcademico}`).join(', ')} (usa --grupo=ID)`));
    grupo = cands[0];
  }
  if (!grupo) { console.error(C.r(`❌ No se encontró el grupo ${NOMBRE_GRUPO} (${CURSO}). Usa --grupo=ID.`)); await admin.app().delete(); return; }
  console.log(`✓ Grupo: ${grupo.nombre} (${grupo.id}, curso ${grupo.cursoAcademico}, ciclo ${(grupo.cicloId||'?').slice(0,6)})`);

  // Módulos del ciclo del grupo (como hace el componente)
  const mods = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.cicloId === grupo.cicloId);
  const buscar = abrev => mods.find(m => norm(m.abreviatura || '') === norm(abrev)) || null;

  // Construir horario
  const horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
  const noEncontrados = new Set();
  let colocados = 0;
  for (const item of PROPUESTA) {
    const mod = buscar(item.abrev);
    if (!mod) { noEncontrados.add(item.abrev); continue; }
    horario[item.dia].push({
      horaInicio: item.ini, horaFin: finDeFranja(item.ini),
      moduloId: mod.id || '', moduloAbreviatura: mod.abreviatura || item.abrev,
      profesorId: mod.profesorId || '', aula: grupo.aula || ''
    });
    colocados++;
  }

  // Resumen
  console.log(C.a(`\nResumen de la propuesta:`));
  for (const dia of ['lunes','martes','miercoles','jueves','viernes']) {
    const celdas = horario[dia].sort((a,b)=>a.horaInicio.localeCompare(b.horaInicio));
    console.log(`   ${dia.padEnd(10)}: ${celdas.map(c => `${c.horaInicio} ${c.moduloAbreviatura}`).join(' · ') || '—'}`);
  }
  console.log(`\n   Sesiones colocadas: ${colocados}/${PROPUESTA.length}`);
  if (noEncontrados.size) console.log(C.r(`   ⚠ Abreviaturas NO encontradas en el ciclo: ${[...noEncontrados].join(', ')} (se omiten; créalas o asígnalas a mano)`));

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para guardar.\n'));
    await admin.app().delete();
    return;
  }

  // Backup del horario anterior
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bpath = join(__dirname, `backup-horario-${grupo.id}-${stamp}.json`);
  writeFileSync(bpath, JSON.stringify({ grupoId: grupo.id, horarioAnterior: grupo.horario || null }, null, 2));
  console.log(C.g(`\nBackup del horario anterior: ${bpath}`));

  await db.collection('grupos').doc(grupo.id).update({ horario, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(C.v(`\n✅ Horario guardado en el grupo ${grupo.nombre} (${colocados} sesiones).\n`));
  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
