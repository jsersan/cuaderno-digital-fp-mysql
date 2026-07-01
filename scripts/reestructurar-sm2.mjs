#!/usr/bin/env node
/**
 * ============================================================================
 *  reestructurar-sm2.mjs   (curso 2026-2027)
 *
 *  Separa 1º y 2º del ciclo SMR (grado medio):
 *    1) El grupo SM2/2SM2 actual queda como 2º: nombre "2SM2", curso = 2.
 *    2) Crea el grupo "1SM2" (curso = 1, 2026-2027, mismo ciclo, SIN alumnos).
 *    3) Mueve los módulos de 1º (DASP, DIGI) a 1SM2: curso = 1 y MIGRA sus datos
 *       (eventos_programacion, tareas, examenes, calificaciones, recuperaciones,
 *        asistencia, asistencia_mensual) del grupo 2º al 1SM2.
 *    4) Crea los módulos de 2º que falten: SOR (Servicios en red), SEG
 *       (Seguridad informática), curso = 2, vacíos.
 *
 *  REQUISITO en la app: el dashboard debe emparejar por ciclo+curso (editado).
 *
 *  Seguridad: dry-run por defecto, backup JSON, --commit. Idempotente.
 *
 *  USO:
 *    node scripts/reestructurar-sm2.mjs                 (simulación)
 *    node scripts/reestructurar-sm2.mjs --commit         (aplica)
 *    node scripts/reestructurar-sm2.mjs --grupo2=ID --commit   (forzar el grupo 2º)
 *    node scripts/reestructurar-sm2.mjs --modulos1=DASP,DIGI --commit
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
const GRUPO2_ID = argVal('--grupo2', '');                       // grupo 2º (si no, se resuelve)
const MODULOS_1 = argVal('--modulos1', 'DASP,DIGI').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const NUEVOS_2 = [   // módulos de 2º a crear si faltan
  { abrev: 'SOR', nombre: 'Servicios en red' },
  { abrev: 'SEG', nombre: 'Seguridad informática' },
];
const COLS_DATOS = ['eventos_programacion', 'tareas', 'examenes', 'calificaciones', 'recuperaciones', 'asistencia'];

const C = { v:s=>`\x1b[32m${s}\x1b[0m`, a:s=>`\x1b[33m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, g:s=>`\x1b[90m${s}\x1b[0m` };
const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log(C.a(`\n=== Reestructurar SMR 1º/2º · ${COMMIT ? 'COMMIT (escribe)' : 'DRY-RUN (no escribe)'} ===`));
  console.log(`Proyecto: ${sa.project_id}  ·  Curso: ${CURSO}`);

  const mods = (await db.collection('modulos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

  // Módulos de 1º a mover (DASP/DIGI)
  const modulos1 = mods.filter(m => MODULOS_1.includes(norm(m.abreviatura)));
  if (!modulos1.length) { console.error(C.r(`❌ No encuentro módulos ${MODULOS_1.join('/')}.`)); await admin.app().delete(); return; }
  const ciclo = modulos1[0].cicloId;
  console.log(`\nMódulos de 1º a mover: ${modulos1.map(m => `${m.abreviatura}(${m.id.slice(0,6)})`).join(', ')}`);
  console.log(`Ciclo SMR detectado: ${ciclo}`);

  // Grupo 2º: el indicado, o el grupo del ciclo en CURSO llamado SM2/2SM2 (el "activo")
  let grupo2 = GRUPO2_ID ? grupos.find(g => g.id === GRUPO2_ID) : null;
  if (!grupo2) {
    const cands = grupos.filter(g => g.cicloId === ciclo && g.cursoAcademico === CURSO
      && (norm(g.nombre) === 'SM2' || norm(g.nombre) === '2SM2'));
    if (cands.length > 1) console.log(C.a(`ℹ Varios candidatos a grupo 2º: ${cands.map(g=>`${g.id}/${g.nombre}`).join(', ')} (usa --grupo2=ID)`));
    grupo2 = cands[0];
  }
  if (!grupo2) { console.error(C.r('❌ No encuentro el grupo 2º (SM2/2SM2) del ciclo en ' + CURSO + '. Usa --grupo2=ID.')); await admin.app().delete(); return; }
  console.log(`Grupo 2º: ${grupo2.nombre} (${grupo2.id})  curso=${grupo2.curso ?? '?'}`);

  // Grupo 1º: ¿existe ya un 1SM2 en el ciclo+curso?
  let grupo1 = grupos.find(g => g.cicloId === ciclo && g.cursoAcademico === CURSO && norm(g.nombre) === '1SM2');

  const backup = { generado: new Date().toISOString(), grupo2: { id: grupo2.id, nombre: grupo2.nombre, curso: grupo2.curso ?? null },
                   grupo1Existente: grupo1?.id || null, modulos1: modulos1.map(m => ({ id: m.id, curso: m.curso ?? null })), migraciones: {} };

  console.log(C.a('\nPlan:'));
  console.log(`  1) Grupo "${grupo2.nombre}" → nombre "2SM2", curso 2`);
  console.log(`  2) ${grupo1 ? `Reutilizar grupo 1SM2 existente (${grupo1.id})` : 'Crear grupo "1SM2" (curso 1, sin alumnos)'}`);
  console.log(`  3) Mover ${modulos1.map(m=>m.abreviatura).join('/')} → curso 1 + migrar sus datos a 1SM2`);

  // Contar datos a migrar
  const totalPorCol = {};
  for (const col of COLS_DATOS) {
    let n = 0;
    for (const m of modulos1) {
      const snap = await db.collection(col).where('moduloId','==',m.id).where('grupoId','==',grupo2.id).get();
      n += snap.size;
    }
    totalPorCol[col] = n;
  }
  // asistencia_mensual (doc id = grupo_modulo_anio-mes): se recrea con nuevo grupo
  let nMensual = 0;
  for (const m of modulos1) {
    const snap = await db.collection('asistencia_mensual').where('moduloId','==',m.id).where('grupoId','==',grupo2.id).get();
    nMensual += snap.size;
  }
  console.log('     datos a migrar:', Object.entries(totalPorCol).map(([k,v])=>`${k}:${v}`).join(' '), `asistencia_mensual:${nMensual}`);

  // Módulos de 2º a crear
  const crear2 = NUEVOS_2.filter(x => !mods.some(m => norm(m.abreviatura) === norm(x.abrev)));
  console.log(`  4) Crear módulos de 2º que faltan: ${crear2.map(x=>x.abrev).join(', ') || '(ninguno, ya existen)'}`);

  if (!COMMIT) {
    console.log(C.a('\nDRY-RUN: no se ha escrito nada. Repite con --commit para aplicar.\n'));
    await admin.app().delete();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(__dirname, `backup-reestructurar-sm2-${stamp}.json`), JSON.stringify(backup, null, 2));
  console.log(C.g(`\nBackup guardado: backup-reestructurar-sm2-${stamp}.json`));

  const now = admin.firestore.FieldValue.serverTimestamp();

  // (1) Grupo 2º
  await grupo2.ref.update({ nombre: '2SM2', curso: 2, updatedAt: now });
  console.log(C.v('✓ Grupo 2º → "2SM2" (curso 2)'));

  // (2) Grupo 1º
  if (!grupo1) {
    const ref = await db.collection('grupos').add({
      nombre: '1SM2', curso: 1, letra: grupo2.letra || '',
      cicloId: ciclo, cicloNombre: grupo2.cicloNombre || '',
      centroId: grupo2.centroId || '', tutorId: grupo2.tutorId || '',
      cursoAcademico: CURSO, turno: grupo2.turno || '', aula: grupo2.aula || '',
      alumnosIds: [], modulosIds: modulos1.map(m => m.id),
      horario: null, activo: true, createdAt: now, updatedAt: now
    });
    grupo1 = { id: ref.id };
    console.log(C.v(`✓ Grupo "1SM2" creado (${ref.id}, sin alumnos)`));
  } else {
    const mids = Array.from(new Set([...((grupo1.modulosIds)||[]), ...modulos1.map(m=>m.id)]));
    await db.collection('grupos').doc(grupo1.id).update({ curso: 1, modulosIds: mids, updatedAt: now });
    console.log(C.v(`✓ Grupo 1SM2 reutilizado (${grupo1.id})`));
  }

  // (3) Mover módulos 1º + migrar datos
  for (const m of modulos1) {
    await m.ref.update({ curso: 1, updatedAt: now });
    // quitar de modulosIds del grupo2, añadir al grupo1
    const g2mods = ((grupo2.modulosIds)||[]).filter(id => id !== m.id);
    await grupo2.ref.update({ modulosIds: g2mods });
    // migrar colecciones por grupoId
    for (const col of COLS_DATOS) {
      const snap = await db.collection(col).where('moduloId','==',m.id).where('grupoId','==',grupo2.id).get();
      let b = db.batch(), c = 0, tot = 0;
      for (const d of snap.docs) { b.update(d.ref, { grupoId: grupo1.id, updatedAt: now }); if (++c % 400 === 0) { await b.commit(); b = db.batch(); } tot++; }
      await b.commit();
      if (tot) console.log(C.g(`    ${m.abreviatura} · ${col}: ${tot} migrados`));
    }
    // asistencia_mensual: recrear doc con nuevo id (grupo_modulo_anio-mes)
    const am = await db.collection('asistencia_mensual').where('moduloId','==',m.id).where('grupoId','==',grupo2.id).get();
    for (const d of am.docs) {
      const data = d.data();
      const nuevoId = `${grupo1.id}_${m.id}_${data.anio}-${String(data.mes).padStart(2,'0')}`;
      await db.collection('asistencia_mensual').doc(nuevoId).set({ ...data, grupoId: grupo1.id, updatedAt: now });
      await d.ref.delete();
    }
    if (am.size) console.log(C.g(`    ${m.abreviatura} · asistencia_mensual: ${am.size} recreados`));
    console.log(C.v(`✓ ${m.abreviatura} → curso 1, datos en 1SM2`));
  }

  // (4) Crear SOR/SEG de 2º
  for (const x of crear2) {
    const ref = await db.collection('modulos').add({
      nombre: x.nombre, abreviatura: x.abrev, cicloId: ciclo, curso: 2,
      horasSemanales: 0, horasTotales: 0, profesorId: modulos1[0].profesorId || '',
      resultadosAprendizaje: [], ponderacionRA: {}, criteriosCalificacion: {},
      activo: true, esFCT: false, esProyecto: false, cursosArchivados: [],
      createdAt: now, updatedAt: now
    });
    console.log(C.v(`✓ Módulo 2º creado: ${x.abrev} — ${x.nombre} (${ref.id})`));
  }

  console.log(C.v('\n✅ Reestructuración completada.'));
  console.log(C.a('   Recuerda: el dashboard debe emparejar por ciclo+curso (ya editado) para ver 1SM2 y 2SM2 por separado.\n'));
  await admin.app().delete();
}
main().catch(e => { console.error(C.r('Error: ' + e.message)); process.exit(1); });
