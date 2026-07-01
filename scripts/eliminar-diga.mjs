#!/usr/bin/env node
/**
 * eliminar-diga.mjs
 * --------------------------------------------------------------------------
 * Elimina TODOS los datos del módulo DIGA en el Cuaderno Digital, de forma
 * acotada y reversible.
 *
 * QUÉ BORRA (todo lo que cuelga del moduloId de DIGA):
 *   · El documento del módulo en  modulos                (configurable)
 *   · eventos_programacion, tareas, examenes, recuperaciones, calificaciones,
 *     asistencia, asistencia_mensual  (where moduloId == DIGA)
 *   · cuadernos_generados/{moduloId}*  (PDFs troceados, por prefijo de id)
 *   · La matrícula de DIGA dentro de cada alumno (NO borra el alumno)  (configurable)
 *
 * QUÉ NO TOCA (entidades compartidas):
 *   · alumnos, grupos, ciclos, usuarios, orlas, backups.
 *
 * SEGURIDAD:
 *   · serviceAccount.json en scripts/.  Proyecto: cuaderno-digital-fp.
 *   · DRY-RUN por defecto. Borra SOLO con --commit (o --apply).
 *   · Backup JSON completo antes de borrar (reversible). Los PDFs de
 *     cuadernos_generados solo se respaldan por id (son regenerables).
 *   · Si hay varios módulos con abreviatura DIGA, los lista y los borra todos
 *     (puedes acotar con CONFIG.moduloId).
 *
 * Uso:
 *   cp ~/Downloads/eliminar-diga.mjs scripts/
 *   node scripts/eliminar-diga.mjs            # simula: enseña qué borraría
 *   node scripts/eliminar-diga.mjs --commit   # borra de verdad (tras backup)
 * --------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────── CONFIG ─────────────────────────────
const COMMIT = process.argv.includes('--commit') || process.argv.includes('--apply');

const CONFIG = {
  moduloAbreviatura: 'DIGA',
  moduloId: null,             // fuerza un id concreto si no quieres ir por abreviatura

  borrarModulo: true,         // borra también el documento del módulo
  limpiarMatriculas: true,    // quita la matrícula de DIGA de cada alumno (no borra alumnos)

  // Colecciones con campo moduloId que se barren por completo.
  coleccionesPorModulo: [
    'eventos_programacion', 'tareas', 'examenes',
    'recuperaciones', 'calificaciones',
    'asistencia', 'asistencia_mensual',
  ],
};

// ───────────────────────────── UTILIDADES ─────────────────────────────
const c = { gris: s => `\x1b[90m${s}\x1b[0m`, verde: s => `\x1b[32m${s}\x1b[0m`,
  ama: s => `\x1b[33m${s}\x1b[0m`, azul: s => `\x1b[36m${s}\x1b[0m`, rojo: s => `\x1b[31m${s}\x1b[0m` };
const log = (...a) => console.log(...a);

function cargarServiceAccount() {
  for (const f of ['serviceAccount.json', 'firebase-key.json']) {
    const p = join(__dirname, f);
    if (existsSync(p)) return { path: p, json: JSON.parse(readFileSync(p, 'utf8')) };
  }
  throw new Error('No se encontró serviceAccount.json en scripts/. Genera uno en Firebase Console → cuaderno-digital-fp → Cuentas de servicio.');
}

async function borrarEnLotes(db, refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

async function actualizarEnLotes(db, updates) { // updates: [{ ref, data }]
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();
  const FieldPath = admin.firestore.FieldPath;

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.rojo('  ELIMINAR MÓDULO DIGA · operación destructiva'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Clave: ${c.gris(sa.path)}`);
  log(`  Modo:  ${COMMIT ? c.rojo('COMMIT (BORRA)') : c.ama('DRY-RUN (no borra)')}\n`);

  // 1) Localizar el/los módulo(s) DIGA
  let modulos = [];
  if (CONFIG.moduloId) {
    const d = await db.collection('modulos').doc(CONFIG.moduloId).get();
    if (d.exists) modulos = [{ id: d.id, ...d.data() }];
  } else {
    const q = await db.collection('modulos').where('abreviatura', '==', CONFIG.moduloAbreviatura).get();
    modulos = q.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  if (!modulos.length) throw new Error(`No se encontró ningún módulo "${CONFIG.moduloAbreviatura}".`);

  const ids = modulos.map(m => m.id);
  log(c.azul(`Módulo(s) encontrados (${modulos.length}):`));
  for (const m of modulos) {
    log(`  · ${c.gris(m.id)}  ${m.abreviatura || ''} — ${m.nombre || ''}  (ciclo ${m.cicloId || '?'}, curso ${m.cursoAcademico || m.curso || '?'})`);
  }

  // 2) Recoger documentos por colección (where moduloId in ids)
  log(c.azul('\nDocumentos a borrar:'));
  const recolectado = {};   // col → [{id, data, ref}]
  for (const col of CONFIG.coleccionesPorModulo) {
    const refs = [];
    // 'in' admite hasta 10 ids; aquí siempre serán pocos
    const grupos = [];
    for (let i = 0; i < ids.length; i += 10) grupos.push(ids.slice(i, i + 10));
    for (const g of grupos) {
      const snap = await db.collection(col).where('moduloId', 'in', g).get().catch(() => ({ docs: [] }));
      for (const d of snap.docs) refs.push({ id: d.id, data: d.data(), ref: d.ref });
    }
    recolectado[col] = refs;
    log(`  · ${col.padEnd(22)} ${refs.length}`);
  }

  // 3) cuadernos_generados por prefijo de id ({moduloId}*) + posible campo moduloId
  const cuadGen = [];
  for (const id of ids) {
    const porPrefijo = await db.collection('cuadernos_generados')
      .where(FieldPath.documentId(), '>=', id)
      .where(FieldPath.documentId(), '<', id + '\uf8ff').get().catch(() => ({ docs: [] }));
    for (const d of porPrefijo.docs) cuadGen.push({ id: d.id, ref: d.ref });
  }
  const porCampo = await db.collection('cuadernos_generados').where('moduloId', 'in', ids.slice(0, 10))
    .get().catch(() => ({ docs: [] }));
  for (const d of porCampo.docs) if (!cuadGen.find(x => x.id === d.id)) cuadGen.push({ id: d.id, ref: d.ref });
  log(`  · ${'cuadernos_generados'.padEnd(22)} ${cuadGen.length}  ${c.gris('(solo se respaldan los ids)')}`);

  // 4) Alumnos con matrícula de DIGA (no se borran; se les quita la matrícula)
  let alumnosAfectados = [];
  if (CONFIG.limpiarMatriculas) {
    const snap = await db.collection('alumnos').get();
    for (const d of snap.docs) {
      const a = d.data();
      const mats = Array.isArray(a.matriculas) ? a.matriculas : [];
      if (mats.some(m => ids.includes(m.moduloId))) {
        alumnosAfectados.push({
          id: d.id, ref: d.ref, nombre: `${a.nombre || ''} ${a.apellidos || ''}`.trim(),
          matriculasAntes: mats,
          matriculasDespues: mats.filter(m => !ids.includes(m.moduloId)),
        });
      }
    }
    log(`  · ${'matrículas a limpiar'.padEnd(22)} ${alumnosAfectados.length}  ${c.gris('(alumnos NO se borran)')}`);
  }
  log(`  · ${'módulos (documento)'.padEnd(22)} ${CONFIG.borrarModulo ? modulos.length : 0}`);

  const totalBorrar = Object.values(recolectado).reduce((s, a) => s + a.length, 0)
    + cuadGen.length + (CONFIG.borrarModulo ? modulos.length : 0);

  // 5) Backup
  const backup = {
    generado: new Date().toISOString(),
    moduloAbreviatura: CONFIG.moduloAbreviatura, moduloIds: ids,
    modulos,
    cuadernos_generados_ids: cuadGen.map(x => x.id),
    alumnosMatriculas: alumnosAfectados.map(a => ({ id: a.id, nombre: a.nombre, matriculasAntes: a.matriculasAntes })),
  };
  for (const col of Object.keys(recolectado)) backup[col] = recolectado[col].map(x => ({ id: x.id, ...x.data }));
  const bpath = join(__dirname, `backup-borrado-diga-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  // 6) Ejecución
  log('');
  if (!COMMIT) {
    log(c.ama('────────────────────────────────────────────────────────────'));
    log(c.ama(`  DRY-RUN: no se ha borrado nada.`));
    log(c.ama(`  Se borrarían ${totalBorrar} documentos y se limpiarían ${alumnosAfectados.length} matrículas.`));
    log(c.ama(`  Backup que se generaría: ${bpath}`));
    log(c.ama(`  Repite con --commit para borrar (se guarda el backup primero).`));
    log(c.ama('────────────────────────────────────────────────────────────\n'));
    await admin.app().delete();
    return;
  }

  writeFileSync(bpath, JSON.stringify(backup, null, 2));
  log('  · Backup guardado: ' + c.verde(bpath));

  // 6a) Limpiar matrículas
  if (CONFIG.limpiarMatriculas && alumnosAfectados.length) {
    await actualizarEnLotes(db, alumnosAfectados.map(a => ({
      ref: a.ref, data: { matriculas: a.matriculasDespues, updatedAt: admin.firestore.Timestamp.now() },
    })));
    log(`  · Matrículas de ${CONFIG.moduloAbreviatura} retiradas de ${alumnosAfectados.length} alumnos.`);
  }

  // 6b) Borrar documentos por colección
  for (const col of Object.keys(recolectado)) {
    const refs = recolectado[col].map(x => x.ref);
    if (refs.length) { await borrarEnLotes(db, refs); log(`  · ${col}: ${refs.length} borrados.`); }
  }

  // 6c) Borrar cuadernos_generados
  if (cuadGen.length) { await borrarEnLotes(db, cuadGen.map(x => x.ref)); log(`  · cuadernos_generados: ${cuadGen.length} borrados.`); }

  // 6d) Borrar el módulo
  if (CONFIG.borrarModulo) {
    await borrarEnLotes(db, modulos.map(m => db.collection('modulos').doc(m.id)));
    log(`  · módulos: ${modulos.length} borrados.`);
  }

  log(c.verde('\n────────────────────────────────────────────'));
  log(c.verde('  ✅ DIGA eliminado'));
  log(`  · ${totalBorrar} documentos borrados · ${alumnosAfectados.length} matrículas limpiadas`);
  log(`  · Backup reversible: ${bpath}`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Recarga el Dashboard: el cuaderno de DIGA debería desaparecer.\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
