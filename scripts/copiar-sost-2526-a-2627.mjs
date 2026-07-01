#!/usr/bin/env node
/**
 * copiar-sost-2526-a-2627.mjs  (v2 — corregido)
 *
 * Copia la programación temporal, tareas y exámenes del módulo SOST
 * del curso 2025-2026 al curso 2026-2027.
 *
 * Se copian:
 *   ✓ Eventos de programación (temas/UD, actividades, exámenes programados)
 *   ✓ Tareas (sin entregas ni adjuntos, como no publicadas)
 *   ✓ Exámenes (sin calificaciones, como no publicados)
 *   ✓ Referencias unidadId (se remapean al nuevo ID del evento copiado)
 *   ✓ Fechas desplazadas +1 año
 *
 * No se copian:
 *   ✗ Alumnos, calificaciones, entregas, asistencia, recuperaciones
 *
 * Cambios en v2:
 *   - Maneja módulos SOST duplicados
 *   - Itera todos los módulos SOST buscando el que tenga datos
 *     con grupoId coincidente con el grupo 2AW3 del curso origen
 *   - Fallback: si ninguno coincide, busca solo por moduloId
 *
 * Uso:
 *   node copiar-sost-2526-a-2627.mjs                  # dry-run
 *   node copiar-sost-2526-a-2627.mjs --apply           # ejecuta la copia
 *
 * Requiere:
 *   npm install firebase-admin
 *   El fichero firebase-key.json en el mismo directorio (o ajustar KEY_PATH).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Configuración ───────────────────────────────────────
const CURSO_ORIGEN  = '2025-2026';
const CURSO_DESTINO = '2026-2027';
const MODULO_ABREV  = 'SOST';
const DIFF_YEARS    = 1;

const APPLY = process.argv.includes('--apply');

// ─── Firebase init ───────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = join(__dirname, 'firebase-key.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
} catch {
  console.error(`❌ No se encontró ${KEY_PATH}`);
  console.error(`   Copia tu clave de servicio de Firebase ahí (o ajusta KEY_PATH).`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Helpers ─────────────────────────────────────────────

/** Desplaza un Timestamp de Firestore N años hacia adelante. */
function shiftTs(ts, years) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date((ts._seconds ?? ts.seconds) * 1000);
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return Timestamp.fromDate(d);
}

/** Formatea un Timestamp para log legible. */
function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date((ts._seconds ?? ts.seconds) * 1000);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
}

/** Elimina claves con valor undefined (Firestore las rechaza). */
function limpiar(obj) {
  const r = { ...obj };
  for (const k of Object.keys(r)) {
    if (r[k] === undefined) delete r[k];
  }
  return r;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Copiar ${MODULO_ABREV}: ${CURSO_ORIGEN} → ${CURSO_DESTINO}`);
  console.log(`  Modo: ${APPLY ? '🟢 APLICAR cambios' : '🔵 DRY-RUN (usa --apply para ejecutar)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ── 1. Buscar TODOS los módulos SOST ──────────────────
  const modulosSnap = await db.collection('modulos')
    .where('abreviatura', '==', MODULO_ABREV)
    .get();

  if (modulosSnap.empty) {
    console.error(`❌ No se encontró ningún módulo con abreviatura "${MODULO_ABREV}".`);
    process.exit(1);
  }

  const modulos = modulosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`📘 Módulos "${MODULO_ABREV}" encontrados: ${modulos.length}`);
  for (const m of modulos) {
    console.log(`   ID: ${m.id}  |  cicloId: ${m.cicloId}  |  activo: ${m.activo}`);
  }

  // Obtener el cicloId (todos comparten el mismo)
  const cicloId = modulos[0].cicloId;

  // ── 2. Buscar grupos ORIGEN y DESTINO ─────────────────
  const gruposSnap = await db.collection('grupos')
    .where('cicloId', '==', cicloId)
    .get();

  const grupoOrigenDoc = gruposSnap.docs.find(d => d.data().cursoAcademico === CURSO_ORIGEN);
  const grupoDestinoDoc = gruposSnap.docs.find(d => d.data().cursoAcademico === CURSO_DESTINO);

  if (!grupoOrigenDoc) {
    console.error(`❌ No hay grupo del ciclo ${cicloId} en ${CURSO_ORIGEN}.`);
    process.exit(1);
  }
  if (!grupoDestinoDoc) {
    console.error(`❌ No hay grupo del ciclo ${cicloId} en ${CURSO_DESTINO}.`);
    console.error(`   Créalo primero desde el Dashboard del Cuaderno Digital.`);
    process.exit(1);
  }

  const grupoOrigen  = { id: grupoOrigenDoc.id, ...grupoOrigenDoc.data() };
  const grupoDestino = { id: grupoDestinoDoc.id, ...grupoDestinoDoc.data() };

  console.log(`\n📂 Grupo ORIGEN: ${grupoOrigen.nombre} (${CURSO_ORIGEN})`);
  console.log(`   ID: ${grupoOrigen.id}`);
  console.log(`📂 Grupo DESTINO: ${grupoDestino.nombre} (${CURSO_DESTINO})`);
  console.log(`   ID: ${grupoDestino.id}`);

  // ── 3. Elegir el módulo correcto ──────────────────────
  //    Probamos cada módulo SOST: primero con grupoId del grupo ORIGEN,
  //    luego con cualquier grupoId (fallback).

  let modulo = null;
  let eventosOrigen = [];
  let tareasOrigen = [];
  let examenesOrigen = [];

  // Intento 1: moduloId + grupoId del grupo ORIGEN
  for (const m of modulos) {
    const evSnap = await db.collection('eventos_programacion')
      .where('moduloId', '==', m.id)
      .where('grupoId', '==', grupoOrigen.id)
      .get();
    const tarSnap = await db.collection('tareas')
      .where('moduloId', '==', m.id)
      .where('grupoId', '==', grupoOrigen.id)
      .get();
    const exSnap = await db.collection('examenes')
      .where('moduloId', '==', m.id)
      .where('grupoId', '==', grupoOrigen.id)
      .get();

    const total = evSnap.size + tarSnap.size + exSnap.size;
    console.log(`\n   Módulo ${m.id}: ${evSnap.size} ev + ${tarSnap.size} tar + ${exSnap.size} ex (con grupoId=${grupoOrigen.id})`);

    if (total > 0) {
      modulo = m;
      eventosOrigen = evSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
      tareasOrigen = tarSnap.docs
        .map(d => ({ _id: d.id, ...d.data() }))
        .filter(t => !t.archivada);
      examenesOrigen = exSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
      console.log(`   ✅ Coincidencia exacta. Usando este módulo.`);
      break;
    }
  }

  // Intento 2 (fallback): solo por moduloId, sin filtro de grupo
  if (!modulo) {
    console.log(`\n⚠️  Ningún módulo tiene datos con grupoId=${grupoOrigen.id}.`);
    console.log(`   Buscando por moduloId solamente...`);

    for (const m of modulos) {
      const evSnap = await db.collection('eventos_programacion')
        .where('moduloId', '==', m.id)
        .get();
      const tarSnap = await db.collection('tareas')
        .where('moduloId', '==', m.id)
        .get();
      const exSnap = await db.collection('examenes')
        .where('moduloId', '==', m.id)
        .get();

      // Filtrar: excluir lo que ya sea del destino
      const evDocs = evSnap.docs.filter(d => d.data().grupoId !== grupoDestino.id);
      const tarDocs = tarSnap.docs.filter(d => d.data().grupoId !== grupoDestino.id);
      const exDocs = exSnap.docs.filter(d => d.data().grupoId !== grupoDestino.id);

      const total = evDocs.length + tarDocs.length + exDocs.length;
      if (total > 0) {
        modulo = m;
        eventosOrigen = evDocs.map(d => ({ _id: d.id, ...d.data() }));
        tareasOrigen = tarDocs
          .map(d => ({ _id: d.id, ...d.data() }))
          .filter(t => !t.archivada);
        examenesOrigen = exDocs.map(d => ({ _id: d.id, ...d.data() }));

        const grupoIdReal = eventosOrigen[0]?.grupoId || tareasOrigen[0]?.grupoId || '(desconocido)';
        console.log(`   ✅ Módulo ${m.id} tiene ${total} docs con grupoId: ${grupoIdReal}`);
        break;
      }
    }
  }

  if (!modulo) {
    console.error(`\n❌ No se encontraron datos de ${MODULO_ABREV} para ${CURSO_ORIGEN}.`);
    process.exit(1);
  }

  console.log(`\n📘 Módulo seleccionado: ${modulo.abreviatura} – ${modulo.nombre}`);
  console.log(`   ID: ${modulo.id}  |  cicloId: ${modulo.cicloId}`);

  // Ordenar
  eventosOrigen.sort((a, b) => ((a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0)));
  tareasOrigen.sort((a, b) => ((a.orden ?? 999) - (b.orden ?? 999)) || ((a.fechaEntrega?.seconds || 0) - (b.fechaEntrega?.seconds || 0)));
  examenesOrigen.sort((a, b) => ((a.fecha?.seconds || 0) - (b.fecha?.seconds || 0)));

  // ── 4. Mostrar resumen del origen ─────────────────────

  console.log(`\n📅 Eventos de programación: ${eventosOrigen.length}`);
  for (const e of eventosOrigen) {
    console.log(`   [${(e.tipo || '?').padEnd(9)}] ${e.titulo}  (${e.evaluacion})  ${fmt(e.fechaInicio)}${e.fechaFin ? ' → ' + fmt(e.fechaFin) : ''}`);
  }

  console.log(`\n📝 Tareas (no archivadas): ${tareasOrigen.length}`);
  for (const t of tareasOrigen) {
    console.log(`   ${t.titulo}  (${t.evaluacion})  entrega: ${fmt(t.fechaEntrega)}  ${t.puntuacionMaxima} pts`);
  }

  console.log(`\n📋 Exámenes: ${examenesOrigen.length}`);
  for (const e of examenesOrigen) {
    console.log(`   ${e.titulo}  (${e.tipo}, ${e.evaluacion})  ${fmt(e.fecha)}  ${e.puntuacionMaxima} pts`);
  }

  const totalOrigen = eventosOrigen.length + tareasOrigen.length + examenesOrigen.length;
  if (totalOrigen === 0) {
    console.log(`\n⚠️  No hay nada que copiar en el origen. ¿Curso correcto?`);
    process.exit(0);
  }

  // ── 5. Guarda idempotente: el destino debe estar vacío ─
  let totalDestino = 0;
  for (const m of modulos) {
    const evD = await db.collection('eventos_programacion').where('moduloId', '==', m.id).where('grupoId', '==', grupoDestino.id).get();
    const tarD = await db.collection('tareas').where('moduloId', '==', m.id).where('grupoId', '==', grupoDestino.id).get();
    const exD = await db.collection('examenes').where('moduloId', '==', m.id).where('grupoId', '==', grupoDestino.id).get();
    totalDestino += evD.size + tarD.size + exD.size;
  }

  if (totalDestino > 0) {
    console.log(`\n⚠️  El destino ${CURSO_DESTINO} YA tiene ${totalDestino} docs para ${MODULO_ABREV}.`);
    console.log(`   ❌ Abortando para no duplicar.`);
    console.log(`   Si quieres rehacer la copia, borra primero esos documentos.\n`);
    process.exit(1);
  }

  // ── 6. Backup del origen ──────────────────────────────
  const backup = {
    generado: new Date().toISOString(),
    script: 'copiar-sost-2526-a-2627.mjs (v2)',
    cursoOrigen: CURSO_ORIGEN,
    cursoDestino: CURSO_DESTINO,
    modulo: { id: modulo.id, abreviatura: modulo.abreviatura, nombre: modulo.nombre },
    grupoOrigen: { id: grupoOrigen.id, nombre: grupoOrigen.nombre },
    grupoDestino: { id: grupoDestino.id, nombre: grupoDestino.nombre },
    eventos: eventosOrigen,
    tareas: tareasOrigen,
    examenes: examenesOrigen,
  };
  const backupFile = `backup-sost-${CURSO_ORIGEN}-origen.json`;
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\n💾 Backup del origen guardado en: ${backupFile}`);

  // ── 7. Resumen antes de aplicar ───────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Resumen de la copia:`);
  console.log(`    ${eventosOrigen.length} eventos de programación`);
  console.log(`    ${tareasOrigen.length} tareas (sin entregas, publicada=false)`);
  console.log(`    ${examenesOrigen.length} exámenes (sin calificaciones, publicado=false)`);
  console.log(`    Fechas desplazadas +${DIFF_YEARS} año`);
  console.log(`    moduloId destino: ${modulo.id}`);
  console.log(`    grupoId destino:  ${grupoDestino.id} (${grupoDestino.nombre} ${CURSO_DESTINO})`);
  console.log(`${'─'.repeat(60)}`);

  if (!APPLY) {
    console.log(`\n🔵 DRY-RUN completado. Nada se ha modificado en Firestore.`);
    console.log(`   Ejecuta con --apply para realizar la copia.\n`);
    process.exit(0);
  }

  // ═══════════════════════════════════════════════════════
  //  APLICAR
  // ═══════════════════════════════════════════════════════
  console.log(`\n🟢 Aplicando copia en Firestore...\n`);

  // 7a. Eventos de programación
  const evMap = new Map(); // oldId → newId
  let nEv = 0;
  for (const ev of eventosOrigen) {
    const { _id, id, createdAt, updatedAt, ...data } = ev;
    const nuevo = limpiar({
      ...data,
      moduloId: modulo.id,
      grupoId: grupoDestino.id,
      cursoAcademico: CURSO_DESTINO,
      fechaInicio: shiftTs(data.fechaInicio, DIFF_YEARS),
      fechaFin: data.fechaFin ? shiftTs(data.fechaFin, DIFF_YEARS) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    if (nuevo.fechaFin === null) delete nuevo.fechaFin;

    const ref = await db.collection('eventos_programacion').add(nuevo);
    evMap.set(_id, ref.id);
    nEv++;
    console.log(`   ✅ Evento: ${data.titulo} → ${ref.id}`);
  }

  // 7b. Tareas
  let nTar = 0;
  for (const t of tareasOrigen) {
    const { _id, id, createdAt, updatedAt, entregas, adjuntos, ...data } = t;
    const nuevo = limpiar({
      ...data,
      moduloId: modulo.id,
      grupoId: grupoDestino.id,
      fechaPublicacion: shiftTs(data.fechaPublicacion, DIFF_YEARS),
      fechaEntrega: shiftTs(data.fechaEntrega, DIFF_YEARS),
      fechaLimiteRetraso: data.fechaLimiteRetraso ? shiftTs(data.fechaLimiteRetraso, DIFF_YEARS) : null,
      unidadId: (data.unidadId && evMap.has(data.unidadId)) ? evMap.get(data.unidadId) : (data.unidadId || null),
      publicada: false,
      archivada: false,
      entregas: [],
      adjuntos: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    if (nuevo.fechaLimiteRetraso === null) delete nuevo.fechaLimiteRetraso;
    if (nuevo.unidadId === null) delete nuevo.unidadId;

    const ref = await db.collection('tareas').add(nuevo);
    nTar++;
    console.log(`   ✅ Tarea: ${data.titulo} → ${ref.id}`);
  }

  // 7c. Exámenes
  let nEx = 0;
  for (const ex of examenesOrigen) {
    const { _id, id, createdAt, updatedAt, calificaciones, examenRecuperacionId, ...data } = ex;
    const nuevo = limpiar({
      ...data,
      moduloId: modulo.id,
      grupoId: grupoDestino.id,
      fecha: shiftTs(data.fecha, DIFF_YEARS),
      unidadId: (data.unidadId && evMap.has(data.unidadId)) ? evMap.get(data.unidadId) : (data.unidadId || null),
      publicado: false,
      resultadosPublicados: false,
      calificaciones: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    if (nuevo.unidadId === null) delete nuevo.unidadId;
    delete nuevo.examenRecuperacionId;

    const ref = await db.collection('examenes').add(nuevo);
    nEx++;
    console.log(`   ✅ Examen: ${data.titulo} → ${ref.id}`);
  }

  // ── 8. Resultado ──────────────────────────────────────
  const logCreados = {
    generado: new Date().toISOString(),
    cursoDestino: CURSO_DESTINO,
    moduloId: modulo.id,
    grupoDestinoId: grupoDestino.id,
    eventosCreados: Object.fromEntries(evMap),
    tareasCreadas: nTar,
    examenesCreados: nEx,
  };
  const logFile = `log-copia-sost-${CURSO_DESTINO}.json`;
  writeFileSync(logFile, JSON.stringify(logCreados, null, 2));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ✅ Copia completada:`);
  console.log(`     ${nEv} eventos de programación`);
  console.log(`     ${nTar} tareas (publicada: false, sin entregas)`);
  console.log(`     ${nEx} exámenes (publicado: false, sin calificaciones)`);
  console.log(`     Fechas desplazadas +${DIFF_YEARS} año`);
  console.log(`\n  📄 Log de IDs creados: ${logFile}`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message || err);
  process.exit(1);
});
