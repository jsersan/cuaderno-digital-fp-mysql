#!/usr/bin/env node
/**
 * poblar-dasp.mjs
 * --------------------------------------------------------------------------
 * Rellena los apartados PROGRAMACIÓN, TAREAS y EXÁMENES del cuaderno de DASP
 * (Digitalización Aplicada a los Sectores Productivos), ajustados a la
 * programación oficial del módulo (5 UD · 5 RA · 33 CE).
 *
 * Clave del problema anterior: el cuaderno está activo en curso 2026-2027 y
 * grupo 2AW3; las bandas que se sembraron antes iban con curso 2025-2026 y
 * grupo SM1, así que el cuaderno (que filtra por curso+grupo+evaluación
 * activos) no las veía. Este script NO adivina: detecta el contexto real.
 *
 * Qué hace:
 *   FASE 0 · Detección
 *       - Localiza el módulo DASP → moduloId, cicloId, profesorId.
 *       - Resuelve el grupo activo (cicloId del módulo + cursoAcademico = CURSO;
 *         prefiere el llamado como GRUPO_NOMBRE). Permite forzar GRUPO_ID.
 *       - Toma un módulo HERMANO que ya tenga datos en ese mismo grupo+curso
 *         y aprende de él: cuántas evaluaciones hay, sus fechas, y el esquema
 *         real de tarea/examen (clona la forma de los campos).
 *   FASE 1 · Programación  → 5 bandas de UD (tipo 'tema').
 *   FASE 2 · Tareas        → 1 actividad evaluable por UD/RA.
 *   FASE 3 · Exámenes      → 1 prueba por evaluación.
 *
 * Convenciones del proyecto:
 *   - serviceAccount.json en la carpeta scripts/.
 *   - Proyecto Firebase: cuaderno-digital-fp.
 *   - DRY-RUN por defecto. Escribe SOLO con --commit (o --apply).
 *   - Backup JSON previo de todo lo que se borre/reemplace.
 *   - Todo lo creado lleva origen:'seed-dasp'. Al reejecutar, primero borra lo
 *     etiquetado (en las 3 colecciones, para este moduloId) y luego recrea →
 *     idempotente y, de paso, limpia las bandas huérfanas de la vez anterior.
 *
 * Uso:
 *   cp ~/Downloads/poblar-dasp.mjs scripts/
 *   node scripts/poblar-dasp.mjs --probe     # solo diagnóstico (muy recomendado)
 *   node scripts/poblar-dasp.mjs             # simula
 *   node scripts/poblar-dasp.mjs --commit    # aplica
 * --------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────── CONFIG ─────────────────────────────
const COMMIT = process.argv.includes('--commit') || process.argv.includes('--apply');
const PROBE_ONLY = process.argv.includes('--probe');

const CONFIG = {
  moduloAbreviatura: 'DASP',
  curso: '2026-2027',          // el que está activo en el cuaderno (cabecera)
  grupoNombre: '2AW3',         // grupo activo mostrado en la cabecera
  grupoId: null,               // fuerza un id concreto si la detección no acierta

  // Peso (%) de cada tarea evaluable. La programación reparte 20 % por RA.
  pesoTarea: 20,

  colores: ['#1565C0', '#2E7D32', '#EF6C00', '#6A1B9A', '#00838F'],
};

// ─────────────── DATOS DE LA PROGRAMACIÓN (DASP) ───────────────
// 5 UD → RA, trimestre teórico (se remapea a las evaluaciones reales) y sesiones.
const UNIDADES = [
  { n: 1, titulo: 'Digitalización y sostenibilidad', ra: 'RA1', trimestre: 1, sesiones: 7,
    contenidos: [
      '1.1 Economías lineal y circular. Modelos de empresa.',
      '1.2 Responsabilidad social y afectación del medioambiente.',
      '1.3 Importancia del reciclaje en los modelos económicos.',
      '1.4 Procesos reales basados en EL y en EC.',
      '1.5 Comparativa de modelos: impacto medioambiental y ODS.',
    ] },
  { n: 2, titulo: 'La cuarta revolución industrial', ra: 'RA2', trimestre: 1, sesiones: 6,
    contenidos: [
      '2.1 Sistemas ciberfísicos y evolución industrial.',
      '2.2 Sistemas automatizados. Cambios de la 4.ª revolución.',
      '2.3 Interrelación entre mundo físico y virtual.',
      '2.4 Ventajas de la migración a entornos 4.0.',
      '2.5 Ventajas para clientes y empresas.',
    ] },
  { n: 3, titulo: 'Sistemas basados en la nube', ra: 'RA3', trimestre: 2, sesiones: 6,
    contenidos: [
      '3.1 Cloud. Definición y niveles.',
      '3.2 Posibilidades del trabajo en la cloud.',
      '3.3 Edge computing y su relación con la cloud.',
      '3.4 Fog y mist. Relación con la cloud.',
      '3.5 Ventajas del uso de la cloud.',
      '3.6 Cloud y rentabilidad de la empresa.',
    ] },
  { n: 4, titulo: 'Características de los sistemas de producción', ra: 'RA4', trimestre: 2, sesiones: 7,
    contenidos: [
      '4.1 Tecnologías habilitadoras (TDH). Características y aplicaciones.',
      '4.2 Relación entre TDH y productividad.',
      '4.3 Implantación de TDH: costes y competitividad.',
      '4.4 Sistemas digitalizados reales. Ejemplos.',
      '4.5 Tecnología disruptiva. Ejemplos.',
      '4.6 Sistemas de almacenamiento de datos.',
    ] },
  { n: 5, titulo: 'Plan de transformación digital de una empresa', ra: 'RA5', trimestre: 3, sesiones: 6,
    contenidos: [
      '5.1 Configuración de una empresa clásica. Digitalización.',
      '5.2 TDH implicadas en cada etapa. Relación entre etapas.',
      '5.3 Configuración de la empresa digitalizada.',
      '5.4 Plan de transformación. Recursos empleados.',
    ] },
];

// ───────────────────────────── UTILIDADES ─────────────────────────────
const c = { gris: s => `\x1b[90m${s}\x1b[0m`, verde: s => `\x1b[32m${s}\x1b[0m`,
  ama: s => `\x1b[33m${s}\x1b[0m`, azul: s => `\x1b[36m${s}\x1b[0m`, rojo: s => `\x1b[31m${s}\x1b[0m` };
const log = (...a) => console.log(...a);
const Timestamp = admin.firestore.Timestamp;
const ts = d => Timestamp.fromDate(d instanceof Date ? d : new Date(d));
const ordinal = n => `${n}ª`;
const iso = d => d.toISOString().slice(0, 10);

function cargarServiceAccount() {
  for (const f of ['serviceAccount.json', 'firebase-key.json']) {
    const p = join(__dirname, f);
    if (existsSync(p)) return { path: p, json: JSON.parse(readFileSync(p, 'utf8')) };
  }
  throw new Error('No se encontró serviceAccount.json en scripts/. Genera uno en Firebase Console → cuaderno-digital-fp → Cuentas de servicio.');
}

// Convierte un valor de fecha (Timestamp | {seconds} | ISO | Date) a Date.
function aDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// Reparte un rango en bandas contiguas proporcionales a las sesiones.
function repartirBandas(ini, fin, uds) {
  const totalDias = (fin - ini) / 86400000;
  const totalSes = uds.reduce((s, u) => s + u.sesiones, 0);
  const bordes = [ini];
  let acc = 0;
  for (const u of uds) {
    acc += u.sesiones;
    bordes.push(new Date(ini.getTime() + (totalDias * acc / totalSes) * 86400000));
  }
  return uds.map((u, i) => ({
    ...u,
    fechaInicio: bordes[i],
    fechaFin: i === uds.length - 1 ? fin : bordes[i + 1],
  }));
}

// Índice de evaluación para un trimestre teórico, según cuántas evaluaciones reales hay.
function idxEval(trimestre, nEvals) {
  if (nEvals >= 3) return Math.min(trimestre - 1, nEvals - 1);
  if (nEvals === 2) return trimestre <= 2 ? 0 : 1;
  return 0;
}

// Rangos de fecha por defecto si no hay módulo hermano de referencia.
function rangosFallback(nEvals, y0, y1) {
  if (nEvals >= 3) return [
    [`${y0}-09-15`, `${y0}-12-18`], [`${y1}-01-08`, `${y1}-03-26`], [`${y1}-04-06`, `${y1}-06-18`],
  ];
  if (nEvals === 2) return [
    [`${y0}-09-07`, `${y1}-02-13`], [`${y1}-02-16`, `${y1}-05-29`],
  ];
  return [[`${y0}-09-15`, `${y1}-05-29`]];
}

// Clona la forma de un documento de plantilla: copia campos, vacía los arrays,
// quita id y timestamps; luego se aplican overrides.
function clonarForma(tpl) {
  const out = {};
  if (tpl) for (const [k, v] of Object.entries(tpl)) {
    if (k === 'id') continue;
    out[k] = Array.isArray(v) ? [] : v;
  }
  return out;
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.azul('  POBLAR DASP · Programación + Tareas + Exámenes'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Clave: ${c.gris(sa.path)}`);
  log(`  Modo:  ${COMMIT ? c.verde('COMMIT (escribe)') : c.ama('DRY-RUN (no escribe)')}`);
  log(`  Curso: ${CONFIG.curso}  ·  Grupo objetivo: ${CONFIG.grupoNombre}\n`);

  // ── FASE 0 · Detección ─────────────────────────────────────────────
  log(c.azul('FASE 0 · Detección del contexto real'));

  // 0.1 Módulo DASP
  const modQ = await db.collection('modulos').where('abreviatura', '==', CONFIG.moduloAbreviatura).limit(1).get();
  if (modQ.empty) throw new Error(`No existe el módulo ${CONFIG.moduloAbreviatura}. Créalo primero (crear-dasp-smr.mjs).`);
  const moduloId = modQ.docs[0].id;
  const modulo = modQ.docs[0].data();
  const cicloId = modulo.cicloId || null;
  const profesorId = modulo.profesorId || '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';
  log(`  · Módulo ${CONFIG.moduloAbreviatura}: ${c.gris(moduloId)}  (cicloId=${c.gris(cicloId)})`);

  // 0.2 Grupo activo
  const gruposSnap = await db.collection('grupos').get();
  const grupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const cursoDe = g => g.cursoAcademico || g.curso || g.cursoAcad || null;
  const candidatos = grupos.filter(g => g.cicloId === cicloId || g.nombre === CONFIG.grupoNombre);
  log('  · Grupos candidatos:');
  for (const g of candidatos) {
    log(`      ${c.gris(g.id)}  nombre=${g.nombre}  curso=${cursoDe(g)}  cicloId=${g.cicloId}`);
  }
  let grupo = null;
  if (CONFIG.grupoId) grupo = grupos.find(g => g.id === CONFIG.grupoId) || null;
  if (!grupo) grupo = candidatos.find(g => cursoDe(g) === CONFIG.curso && g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = candidatos.find(g => cursoDe(g) === CONFIG.curso);
  if (!grupo) grupo = candidatos.find(g => g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = candidatos[0] || null;
  if (!grupo) throw new Error('No se pudo resolver el grupo. Fija CONFIG.grupoId con uno de la lista de candidatos.');
  const grupoId = grupo.id;
  const coincideNombre = (grupo.nombre || '').toLowerCase() === CONFIG.grupoNombre.toLowerCase();
  log(`  · Grupo elegido: ${c.gris(grupoId)} (${grupo.nombre}, curso ${cursoDe(grupo)})` +
    (coincideNombre ? '' : c.ama('  ⚠ el nombre no coincide con grupoNombre')));

  // 0.3 Módulo hermano de referencia → evaluaciones reales + plantillas de esquema
  const evSnap = await db.collection('eventos_programacion').where('grupoId', '==', grupoId).get();
  const refEventos = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.moduloId !== moduloId && e.origen !== 'seed-dasp' &&
      (!CONFIG.curso || !e.cursoAcademico || e.cursoAcademico === CONFIG.curso));

  // Agrupa por valor de 'evaluacion' → rango [min inicio, max fin]
  const porEval = new Map();
  for (const e of refEventos) {
    const ini = aDate(e.fechaInicio) || aDate(e.fecha);
    const fin = aDate(e.fechaFin) || ini;
    if (e.evaluacion == null || !ini) continue;
    const cur = porEval.get(e.evaluacion) || { ini, fin };
    if (ini < cur.ini) cur.ini = ini;
    if (fin > cur.fin) cur.fin = fin;
    porEval.set(e.evaluacion, cur);
  }

  const [y0, y1] = CONFIG.curso.split('-').map(Number);
  let evalInfo;
  if (porEval.size) {
    evalInfo = [...porEval.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0))
      .map(([valor, r]) => ({ valor, inicio: r.ini, fin: r.fin }));
    log(`  · Evaluaciones detectadas de un módulo hermano: ${c.verde(evalInfo.length)}`);
  } else {
    const nEvals = 2; // por defecto, como el resto de cuadernos de este grupo
    evalInfo = rangosFallback(nEvals, y0, y1).map((r, i) => ({
      valor: i + 1, inicio: new Date(r[0]), fin: new Date(r[1]),
    }));
    log(`  · Sin módulo hermano con datos. Uso ${c.ama(evalInfo.length + ' evaluaciones por defecto')}.`);
  }
  for (const e of evalInfo) log(`      eval=${JSON.stringify(e.valor)}  ${iso(e.inicio)} → ${iso(e.fin)}`);

  // Plantillas de esquema (clonar la forma real de tarea y examen)
  const tareaTpl = (await db.collection('tareas').where('grupoId', '==', grupoId).limit(1).get())
    .docs[0]?.data() || (await db.collection('tareas').limit(1).get()).docs[0]?.data() || null;
  const examenTpl = (await db.collection('examenes').where('grupoId', '==', grupoId).limit(1).get())
    .docs[0]?.data() || (await db.collection('examenes').limit(1).get()).docs[0]?.data() || null;
  log('  · Plantilla tareas:  ' + (tareaTpl ? c.gris(Object.keys(tareaTpl).join(', ')) : c.ama('ninguna; forma por defecto')));
  log('  · Plantilla examenes:' + (examenTpl ? c.gris(Object.keys(examenTpl).join(', ')) : c.ama(' ninguna; forma por defecto')));

  if (PROBE_ONLY) {
    log(c.verde('\n  --probe: solo diagnóstico. Nada que escribir.\n'));
    await admin.app().delete();
    return;
  }

  // Guarda de seguridad: no escribir en un grupo equivocado sin confirmar.
  if (COMMIT && !CONFIG.grupoId && !coincideNombre) {
    throw new Error(
      `El grupo resuelto (${grupo.nombre}) no coincide con "${CONFIG.grupoNombre}".\n` +
      `Revisa la lista de candidatos de arriba y fija CONFIG.grupoId con el correcto antes de --commit.`);
  }

  const nEvals = evalInfo.length;
  const ctx = { moduloId, grupoId, profesorId, cursoAcademico: CONFIG.curso, origen: 'seed-dasp' };
  const ahora = Timestamp.now();

  // ── FASE 1 · Programación (bandas de UD) ───────────────────────────
  log(c.azul('\nFASE 1 · Programación'));
  // Agrupa UD por evaluación y reparte fechas dentro del rango de cada una.
  const udsPorEval = new Map();
  for (const u of UNIDADES) {
    const idx = idxEval(u.trimestre, nEvals);
    if (!udsPorEval.has(idx)) udsPorEval.set(idx, []);
    udsPorEval.get(idx).push(u);
  }
  const eventos = [];
  for (const [idx, uds] of [...udsPorEval.entries()].sort((a, b) => a[0] - b[0])) {
    const info = evalInfo[idx];
    const bandas = repartirBandas(info.inicio, info.fin, uds);
    for (const b of bandas) {
      const ref = db.collection('eventos_programacion').doc();
      eventos.push({
        ref, unidadId: ref.id, udNumero: b.n, ra: b.ra,
        data: {
          ...ctx,
          evaluacion: info.valor,
          tipo: 'tema',
          titulo: `UD${b.n}. ${b.titulo}`,
          descripcion: b.contenidos.join('\n'),
          fechaInicio: ts(b.fechaInicio),
          fechaFin: ts(b.fechaFin),
          color: CONFIG.colores[(b.n - 1) % CONFIG.colores.length],
          createdAt: ahora, updatedAt: ahora,
          raAsociado: b.ra,
        },
        _fin: b.fechaFin,
      });
      log(`  · UD${b.n} (${b.ra}, eval ${JSON.stringify(info.valor)}) ` +
        c.gris(`${iso(b.fechaInicio)} → ${iso(b.fechaFin)}`));
    }
  }

  // ── FASE 2 · Tareas (1 actividad evaluable por UD/RA) ──────────────
  log(c.azul('\nFASE 2 · Tareas'));
  const tareas = [];
  for (const ev of eventos) {
    const u = UNIDADES.find(x => x.n === ev.udNumero);
    const base = clonarForma(tareaTpl);
    tareas.push({
      ...base,
      ...ctx,
      titulo: `Actividad evaluable ${ev.ra} · ${u.titulo}`,
      descripcion: u.contenidos.join('\n'),
      unidadId: ev.unidadId,
      evaluacion: ev.data.evaluacion,
      fechaEntrega: ts(ev._fin),
      peso: CONFIG.pesoTarea,
      entregas: [],
      createdAt: ahora, updatedAt: ahora,
    });
    log(`  · ${ev.ra} → entrega ${c.gris(iso(ev._fin))} · peso ${CONFIG.pesoTarea}%`);
  }

  // ── FASE 3 · Exámenes (1 prueba por evaluación) ────────────────────
  log(c.azul('\nFASE 3 · Exámenes'));
  const examenes = [];
  const idxsUsados = [...udsPorEval.keys()].sort((a, b) => a - b);
  idxsUsados.forEach((idx, pos) => {
    const info = evalInfo[idx];
    const uds = udsPorEval.get(idx);
    const ras = uds.map(u => u.ra);
    const rango = ras.length > 1 ? `${ras[0]}–${ras[ras.length - 1]}` : ras[0];
    const fechaEx = eventos.filter(e => e.data.evaluacion === info.valor)
      .reduce((mx, e) => (e._fin > mx ? e._fin : mx), info.inicio);
    const esUltima = pos === idxsUsados.length - 1;
    examenes.push({
      ...clonarForma(examenTpl),
      ...ctx,
      titulo: `Prueba escrita ${ordinal(pos + 1)} Evaluación · ${rango}`,
      descripcion: `Prueba de los resultados de aprendizaje ${rango} (UD ${uds.map(u => u.n).join(', ')}).`,
      tipo: esUltima ? 'final' : 'parcial',
      esFinal: esUltima,
      evaluacion: info.valor,
      fecha: ts(fechaEx),
      createdAt: ahora, updatedAt: ahora,
    });
    log(`  · ${ordinal(pos + 1)} Evaluación (${rango}) · ${esUltima ? 'final' : 'parcial'} · ${c.gris(iso(fechaEx))}`);
  });

  // ── Borrado idempotente de lo sembrado antes + backup ──────────────
  log(c.azul('\nLimpieza idempotente (origen=seed-dasp para este módulo)'));
  const previos = {};
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    const snap = await db.collection(col)
      .where('moduloId', '==', moduloId).where('origen', '==', 'seed-dasp').get().catch(() => ({ docs: [] }));
    previos[col] = snap.docs;
    log(`  · ${col}: ${snap.docs.length} a reemplazar`);
  }
  const totalPrevios = Object.values(previos).reduce((s, d) => s + d.length, 0);
  if (totalPrevios) {
    const backup = { generado: new Date().toISOString(), moduloId, grupoId, curso: CONFIG.curso };
    for (const col of Object.keys(previos)) backup[col] = previos[col].map(d => ({ id: d.id, ...d.data() }));
    const bpath = join(__dirname, `backup-dasp-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    if (COMMIT) writeFileSync(bpath, JSON.stringify(backup, null, 2));
    log('  · Backup ' + (COMMIT ? c.verde('guardado') : c.ama('(se guardaría)')) + ': ' + c.gris(bpath));
  }

  // ── Escritura ──────────────────────────────────────────────────────
  log('');
  if (!COMMIT) {
    log(c.ama('────────────────────────────────────────────'));
    log(c.ama(`  DRY-RUN: nada escrito. Crearía ${eventos.length} UD, ${tareas.length} tareas, ${examenes.length} exámenes.`));
    log(c.ama('  Repite con --commit para aplicar.'));
    log(c.ama('────────────────────────────────────────────\n'));
    await admin.app().delete();
    return;
  }

  const batch = db.batch();
  for (const col of Object.keys(previos)) for (const d of previos[col]) batch.delete(d.ref);
  for (const ev of eventos) batch.set(ev.ref, ev.data);
  for (const t of tareas) batch.set(db.collection('tareas').doc(), t);
  for (const x of examenes) batch.set(db.collection('examenes').doc(), x);
  await batch.commit();

  log(c.verde('────────────────────────────────────────────'));
  log(c.verde('  ✅ HECHO'));
  log(`  · Programación: ${eventos.length} bandas de UD`);
  log(`  · Tareas: ${tareas.length}`);
  log(`  · Exámenes: ${examenes.length}`);
  log(`  · Módulo ${CONFIG.moduloAbreviatura} · grupo ${grupo.nombre} · curso ${CONFIG.curso}`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Recarga Programación / Tareas / Exámenes en el cuaderno.\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
