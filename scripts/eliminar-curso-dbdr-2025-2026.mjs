#!/usr/bin/env node
/**
 * eliminar-curso-dbdr-2025-2026.mjs
 * --------------------------------------------------------------------------
 * Elimina de forma SEGURA la instancia sobrante del módulo DBDR
 * (Diseño de Bases de Datos Relacionales) correspondiente al curso
 * académico 2025-2026 (grupo SM1), que está vacía, SIN tocar la
 * instancia del curso 2026-2027 (grupo SM2).
 *
 * QUÉ BORRA (solo lo que resuelva al curso 2025-2026):
 *   - El/los documento(s) de "modulos" DBDR cuyo curso resuelva a 2025-2026.
 *   - Sus eventos_programacion / tareas / examenes asociados (por moduloId).
 *
 * QUÉ NO TOCA NUNCA:
 *   - La instancia DBDR de 2026-2027 (grupo SM2) ni sus datos.
 *   - Los grupos (SM1 / SM2): se informan pero NO se borran (un grupo puede
 *     estar usado por otros módulos). Usa --incluir-grupo si quieres borrar
 *     también el grupo SM1, pero revísalo bien antes.
 *
 * SEGURIDAD:
 *   - DRY-RUN por defecto: inspecciona y vuelca el esquema real, NO escribe.
 *   - Antes de borrar (--commit) crea un backup JSON con TODO lo que se borra.
 *   - Solo borra lo que resuelve EXACTAMENTE a CURSO_BORRAR. Si el año de un
 *     módulo no se puede resolver con certeza, lo OMITE y avisa.
 *
 * USO:
 *   node eliminar-curso-dbdr-2025-2026.mjs                  # dry-run (no borra)
 *   node eliminar-curso-dbdr-2025-2026.mjs --commit         # borra (con backup)
 *   node eliminar-curso-dbdr-2025-2026.mjs --commit --incluir-grupo  # + borra grupo SM1
 *
 * REQUISITOS:
 *   - npm install firebase-admin
 *   - scripts/serviceAccount.json (clave de cuenta de servicio de Firebase)
 * --------------------------------------------------------------------------
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ----- Flags -----
const COMMIT = process.argv.includes('--commit');
const INCLUIR_GRUPO = process.argv.includes('--incluir-grupo');

// ----- Configuración -----
const COD_MODULO = 'DBDR';                 // abreviatura/código del módulo
const NOMBRE_MODULO_HINT = 'diseño de bases de datos relacionales';
const CURSO_BORRAR = '2025-2026';          // curso a eliminar (el que sobra)
const CURSO_PROTEGIDO = '2026-2027';       // curso que NUNCA se toca
const GRUPO_BORRAR = 'SM1';                // grupo de la instancia a borrar
const GRUPO_PROTEGIDO = 'SM2';             // grupo de la instancia protegida

// --------------------------------------------------------------------------
//  Firebase init
// --------------------------------------------------------------------------
let db;
function initFirebase() {
  const saPath = join(__dirname, 'serviceAccount.json');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
  } catch (e) {
    console.error(`\n❌ No se encontró ${saPath}`);
    console.error('   Guarda la clave de cuenta de servicio como scripts/serviceAccount.json\n');
    process.exit(1);
  }
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
}

// --------------------------------------------------------------------------
//  Utilidades
// --------------------------------------------------------------------------
// Serializa Timestamps de Firestore a ISO para el backup JSON.
function jsonReplacer(_key, value) {
  if (value instanceof Timestamp) return { __timestamp__: value.toDate().toISOString() };
  return value;
}

function dump(obj) {
  // Vuelca campos de forma legible, ocultando arrays largos.
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Timestamp) out[k] = v.toDate().toISOString();
    else if (Array.isArray(v)) out[k] = `[array de ${v.length}]`;
    else out[k] = v;
  }
  return out;
}

// Resuelve el curso académico de un módulo: primero su propio campo,
// si no, el del grupo vinculado. Devuelve { curso, fuente }.
function resolverCurso(m, grupoById) {
  if (m.cursoAcademico) return { curso: m.cursoAcademico, fuente: 'modulo.cursoAcademico' };
  const g = m.grupoId ? grupoById[m.grupoId] : null;
  if (g && g.cursoAcademico) return { curso: g.cursoAcademico, fuente: 'grupo.cursoAcademico' };
  if (g && g.nombre) return { curso: null, fuente: `grupo.nombre=${g.nombre} (sin cursoAcademico)` };
  return { curso: null, fuente: 'desconocido' };
}

// --------------------------------------------------------------------------
//  Principal
// --------------------------------------------------------------------------
async function run() {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  ELIMINAR CURSO SOBRANTE · ${COD_MODULO} · ${CURSO_BORRAR}`);
  console.log(`  Modo: ${COMMIT ? '🔴 COMMIT (BORRA en Firestore)' : '🔍 DRY-RUN (no borra nada)'}`);
  console.log(`  Protegido (no se toca): ${COD_MODULO} · ${CURSO_PROTEGIDO} · ${GRUPO_PROTEGIDO}`);
  console.log(`${'='.repeat(64)}\n`);

  initFirebase();

  // --- Cargar grupos (para resolver el curso de cada módulo) ---
  const grupoById = {};
  (await db.collection('grupos').get()).forEach(d => { grupoById[d.id] = { id: d.id, ...d.data() }; });

  // --- Buscar TODOS los módulos DBDR ---
  const modsSnap = await db.collection('modulos').get();
  const dbdrModulos = [];
  modsSnap.forEach(d => {
    const m = d.data();
    const esDBDR = m.abreviatura === COD_MODULO || m.codigo === COD_MODULO ||
      (m.nombre || '').toLowerCase().includes(NOMBRE_MODULO_HINT);
    if (esDBDR) dbdrModulos.push({ id: d.id, ...m });
  });

  if (dbdrModulos.length === 0) {
    console.error(`❌ No se encontró ningún módulo ${COD_MODULO} en "modulos". Nada que hacer.\n`);
    process.exit(1);
  }

  console.log(`📋 Módulos ${COD_MODULO} encontrados: ${dbdrModulos.length}\n`);

  const objetivos = []; // módulos a borrar (curso === CURSO_BORRAR)
  for (const m of dbdrModulos) {
    const { curso, fuente } = resolverCurso(m, grupoById);
    const g = m.grupoId ? grupoById[m.grupoId] : null;
    const etiqueta = curso === CURSO_BORRAR ? '🗑️  BORRAR'
      : curso === CURSO_PROTEGIDO ? '🛡️  PROTEGIDO'
      : '⏭️  OMITIR (año no resuelto)';
    console.log(`  ${etiqueta}  modulo id=${m.id}`);
    console.log(`     curso resuelto: ${curso || '??'}  (vía ${fuente})`);
    console.log(`     grupo: ${g ? `${g.nombre} (id=${g.id})` : m.grupoId || '—'}`);
    console.log(`     campos: ${JSON.stringify(dump(m))}`);
    console.log('');
    if (curso === CURSO_BORRAR) objetivos.push({ modulo: m, grupo: g });
  }

  if (objetivos.length === 0) {
    console.log(`✅ No hay ningún módulo ${COD_MODULO} que resuelva a ${CURSO_BORRAR}.`);
    console.log('   Revisa el volcado de arriba: si el año se guarda de otra forma,');
    console.log('   ajusta la lógica de resolverCurso() y vuelve a ejecutar el dry-run.\n');
    return;
  }

  // --- Reunir documentos dependientes de cada objetivo ---
  const coleccionesDep = ['eventos_programacion', 'tareas', 'examenes'];
  const aBorrar = []; // { col, id, data }
  for (const { modulo, grupo } of objetivos) {
    // Salvaguarda extra: jamás borrar nada del grupo protegido
    if (grupo && grupo.nombre === GRUPO_PROTEGIDO) {
      console.error(`🛑 ABORTANDO: el objetivo apunta al grupo protegido ${GRUPO_PROTEGIDO}. Revisa los datos.`);
      process.exit(1);
    }
    for (const col of coleccionesDep) {
      const snap = await db.collection(col).where('moduloId', '==', modulo.id).get();
      snap.forEach(d => aBorrar.push({ col, id: d.id, data: d.data() }));
    }
    // El propio documento de módulo (curso 2025-2026)
    aBorrar.push({ col: 'modulos', id: modulo.id, data: modulo, esModulo: true });

    // Grupo SM1: solo si se pide explícitamente y no es el protegido
    if (INCLUIR_GRUPO && grupo && grupo.nombre === GRUPO_BORRAR && grupo.nombre !== GRUPO_PROTEGIDO) {
      aBorrar.push({ col: 'grupos', id: grupo.id, data: grupo, esGrupo: true });
    }
  }

  // --- Resumen ---
  const porColeccion = {};
  for (const x of aBorrar) porColeccion[x.col] = (porColeccion[x.col] || 0) + 1;
  console.log('📊 DOCUMENTOS A ELIMINAR:');
  for (const [col, n] of Object.entries(porColeccion)) console.log(`   · ${col}: ${n}`);
  console.log(`   · TOTAL: ${aBorrar.length}\n`);

  // Aviso si la instancia no está realmente vacía (esperabas vacía)
  const depCount = aBorrar.filter(x => coleccionesDep.includes(x.col)).length;
  if (depCount > 0) {
    console.log(`⚠️  Atención: la instancia ${CURSO_BORRAR} NO está vacía (${depCount} eventos/tareas/exámenes).`);
    console.log('   Esperabas que estuviera vacía. Revisa el backup antes de continuar.\n');
  }

  if (!COMMIT) {
    console.log('🔍 DRY-RUN: no se ha borrado nada.');
    console.log('👉 Si el reparto de arriba es correcto, ejecuta con --commit.\n');
    return;
  }

  // --- Backup antes de borrar ---
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(__dirname, `backup-dbdr-${CURSO_BORRAR}-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(aBorrar, jsonReplacer, 2), 'utf8');
  console.log(`💾 Backup escrito en: ${backupPath}\n`);

  // --- Borrado por lotes ---
  console.log('🗑️  Borrando...');
  let batch = db.batch();
  let count = 0;
  for (const x of aBorrar) {
    batch.delete(db.collection(x.col).doc(x.id));
    if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();

  console.log(`\n✅ Eliminados ${aBorrar.length} documentos del curso ${COD_MODULO} ${CURSO_BORRAR}.`);
  console.log(`🛡️  La instancia ${CURSO_PROTEGIDO} (${GRUPO_PROTEGIDO}) NO se ha tocado.\n`);
}

run().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
