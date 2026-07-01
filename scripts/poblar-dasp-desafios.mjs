#!/usr/bin/env node
/**
 * poblar-dasp-desafios.mjs
 * --------------------------------------------------------------------------
 * Rellena PROGRAMACIÓN, TAREAS y EXÁMENES del cuaderno DASP siguiendo la
 * programación del PDF (IES Alba Longa, curso 2025-26), estructurada en
 * 4 DESAFÍOS (REA) en lugar de 5 UD:
 *
 *   Desafío 1 · Economía Circular        (RA1 + RA2)  reto "Plan 360"
 *   Desafío 2 · Transformación Digital   (RA4)        reto "Comerciales THD"
 *   Desafío 3 · Almacenamiento en Cloud  (RA3)        reto "Nube Experta"
 *   Desafío 4 · Plan de Digitalización   (RA5)        reto en 4 fases
 *
 * Módulo de 32 h, 1 h semanal, 3 trimestres. Como el cuaderno de este grupo
 * trabaja con 2 evaluaciones, los trimestres se remapean automáticamente.
 *
 * No adivina el contexto: localiza el módulo DASP, resuelve el grupo activo
 * (2AW3 / 2026-2027) y clona de un módulo HERMANO el nº de evaluaciones, sus
 * fechas y el esquema real de tarea/examen.
 *
 * Convenciones: serviceAccount.json en scripts/ · proyecto cuaderno-digital-fp
 * · DRY-RUN por defecto (--commit para escribir) · backup JSON previo ·
 * todo con origen:'seed-dasp' (al reejecutar borra lo etiquetado y recrea,
 * sustituyendo cualquier siembra anterior de DASP).
 *
 * Uso:
 *   cp ~/Downloads/poblar-dasp-desafios.mjs scripts/
 *   node scripts/poblar-dasp-desafios.mjs --probe
 *   node scripts/poblar-dasp-desafios.mjs
 *   node scripts/poblar-dasp-desafios.mjs --commit
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
  curso: '2026-2027',
  grupoNombre: '2AW3',
  grupoId: null,             // fuerza un id si la detección no acierta

  crearExamenes: true,       // 1 prueba teórico-práctica por desafío (la programación es muy de rúbrica/proyecto)
  pesoTarea: 4,              // peso (%) orientativo de cada actividad — ajústalo en la app
  pesoReto: 12,              // peso (%) orientativo de cada reto/producto final

  colores: ['#2E7D32', '#EF6C00', '#00838F', '#6A1B9A'],
};

// ─────────────── DATOS DE LA PROGRAMACIÓN (4 DESAFÍOS) ───────────────
const DESAFIOS = [
  {
    n: 1, titulo: 'Economía Circular', ras: ['RA1', 'RA2'], trimestre: 1, sesiones: 10,
    descripcion: 'Transformación del modelo de economía lineal a circular y transformación industrial ' +
      '(automatización, sistemas ciberfísicos, Industria 4.0 e Industria 5.0). Producto final: Plan 360.',
    tareas: [
      'Preguntas de reflexión',
      'Actividad de investigación ODS',
      'Industria 4.0 e Industria 5.0',
      'Actividad del mundo físico al virtual',
      'Actividad de reflexión: Fast Fashion',
      'Escáner circular',
      'Escáner digital',
    ],
    retos: ['Plan 360 · reto final'],
  },
  {
    n: 2, titulo: 'Transformación Digital', ras: ['RA4'], trimestre: 1, sesiones: 10,
    descripcion: 'Tecnologías habilitadoras (THD) para la transformación digital de la empresa: ' +
      'características, ventajas e inconvenientes en los sectores productivos. Producto final: Comerciales THD.',
    tareas: [
      'Preguntas de reflexión',
      'Actividades de consolidación',
      'La UE más digital',
      '¿Nos digitalizamos entonces?',
      'La realidad digital empresarial',
    ],
    retos: ['Comerciales THD · reto final'],
  },
  {
    n: 3, titulo: 'Almacenamiento en Cloud / nube', ras: ['RA3'], trimestre: 2, sesiones: 10,
    descripcion: 'Papel del cloud computing en la transformación digital de las pymes: servicios en la nube, ' +
      'colaboración y seguridad de la información. Producto final: Nube Experta.',
    tareas: [
      'Preguntas de reflexión',
      'Analiza la nube',
      'Actividad de investigación: la nube en nuestro sector',
      'Cuestionario: encuentra la nube oculta',
      'Ponemos nuestra nube en marcha',
      'Nombrar bien, organizar mejor',
      'Detective de permisos',
      'Errores que cuestan caro',
      'Mi decálogo de seguridad',
    ],
    retos: ['Nube Experta · reto final'],
  },
  {
    n: 4, titulo: 'Plan de Digitalización', ras: ['RA5'], trimestre: 3, sesiones: 12,
    descripcion: 'Puesta en marcha de un plan de digitalización para una pequeña empresa del sector, ' +
      'integrando lo trabajado en los desafíos anteriores y herramientas de análisis estratégico.',
    tareas: [
      '¿Trabajaremos menos gracias a la tecnología?',
      'Investigación: ¿son los países más ricos los más tecnológicos?',
      'Diagnóstico Express de Ciberseguridad para una PYME',
      'Investigación: ciberataques y robo de datos en empresas',
      'Ciberseguridad personal',
      'De la teoría a la estrategia: cuatro claves de la transformación digital',
    ],
    retos: [
      'Plan de Digitalización · Fase 1: Diagnóstico',
      'Plan de Digitalización · Fase 2: Estrategia',
      'Plan de Digitalización · Fase 3: Implementación',
      'Plan de Digitalización · Fase 4: Evaluación',
    ],
  },
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

function aDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v); return isNaN(d) ? null : d;
}

// Reparte un rango en bandas contiguas proporcionales a las sesiones.
function repartirBandas(ini, fin, items) {
  const totalDias = (fin - ini) / 86400000;
  const total = items.reduce((s, u) => s + u.sesiones, 0);
  const bordes = [ini];
  let acc = 0;
  for (const u of items) { acc += u.sesiones; bordes.push(new Date(ini.getTime() + (totalDias * acc / total) * 86400000)); }
  return items.map((u, i) => ({ ...u, fechaInicio: bordes[i], fechaFin: i === items.length - 1 ? fin : bordes[i + 1] }));
}

// Devuelve `count` fechas repartidas dentro de [ini, fin] (sin tocar los extremos).
function repartirFechas(ini, fin, count) {
  const span = fin - ini;
  return Array.from({ length: count }, (_, i) => new Date(ini.getTime() + span * (i + 1) / (count + 1)));
}

function idxEval(trimestre, nEvals) {
  if (nEvals >= 3) return Math.min(trimestre - 1, nEvals - 1);
  if (nEvals === 2) return trimestre <= 2 ? 0 : 1;
  return 0;
}

function rangosFallback(nEvals, y0, y1) {
  if (nEvals >= 3) return [[`${y0}-09-15`, `${y0}-12-18`], [`${y1}-01-08`, `${y1}-03-26`], [`${y1}-04-06`, `${y1}-06-18`]];
  if (nEvals === 2) return [[`${y0}-09-07`, `${y1}-02-13`], [`${y1}-02-16`, `${y1}-05-29`]];
  return [[`${y0}-09-15`, `${y1}-05-29`]];
}

function clonarForma(tpl) {
  const out = {};
  if (tpl) for (const [k, v] of Object.entries(tpl)) { if (k === 'id') continue; out[k] = Array.isArray(v) ? [] : v; }
  return out;
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.azul('  POBLAR DASP (4 desafíos) · Programación + Tareas + Exámenes'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Clave: ${c.gris(sa.path)}`);
  log(`  Modo:  ${COMMIT ? c.verde('COMMIT (escribe)') : c.ama('DRY-RUN (no escribe)')}`);
  log(`  Curso: ${CONFIG.curso}  ·  Grupo objetivo: ${CONFIG.grupoNombre}\n`);

  // ── FASE 0 · Detección ──────────────────────────────────────────────
  log(c.azul('FASE 0 · Detección del contexto real'));
  const modQ = await db.collection('modulos').where('abreviatura', '==', CONFIG.moduloAbreviatura).limit(1).get();
  if (modQ.empty) throw new Error(`No existe el módulo ${CONFIG.moduloAbreviatura}.`);
  const moduloId = modQ.docs[0].id;
  const modulo = modQ.docs[0].data();
  const cicloId = modulo.cicloId || null;
  const profesorId = modulo.profesorId || '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';
  log(`  · Módulo ${CONFIG.moduloAbreviatura}: ${c.gris(moduloId)} (cicloId=${c.gris(cicloId)})`);

  const gruposSnap = await db.collection('grupos').get();
  const grupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const cursoDe = g => g.cursoAcademico || g.curso || g.cursoAcad || null;
  const candidatos = grupos.filter(g => g.cicloId === cicloId || g.nombre === CONFIG.grupoNombre);
  log('  · Grupos candidatos:');
  for (const g of candidatos) log(`      ${c.gris(g.id)}  nombre=${g.nombre}  curso=${cursoDe(g)}  cicloId=${g.cicloId}`);
  let grupo = null;
  if (CONFIG.grupoId) grupo = grupos.find(g => g.id === CONFIG.grupoId) || null;
  if (!grupo) grupo = candidatos.find(g => cursoDe(g) === CONFIG.curso && g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = candidatos.find(g => cursoDe(g) === CONFIG.curso);
  if (!grupo) grupo = candidatos.find(g => g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = candidatos[0] || null;
  if (!grupo) throw new Error('No se pudo resolver el grupo. Fija CONFIG.grupoId con un id de la lista.');
  const grupoId = grupo.id;
  const coincideNombre = (grupo.nombre || '').toLowerCase() === CONFIG.grupoNombre.toLowerCase();
  log(`  · Grupo elegido: ${c.gris(grupoId)} (${grupo.nombre}, curso ${cursoDe(grupo)})` +
    (coincideNombre ? '' : c.ama('  ⚠ el nombre no coincide')));

  // Evaluaciones reales (de un módulo hermano) + esquemas de tarea/examen
  const evSnap = await db.collection('eventos_programacion').where('grupoId', '==', grupoId).get();
  const refEventos = evSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.moduloId !== moduloId && e.origen !== 'seed-dasp' &&
      (!CONFIG.curso || !e.cursoAcademico || e.cursoAcademico === CONFIG.curso));
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
    evalInfo = [...porEval.entries()].sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0))
      .map(([valor, r]) => ({ valor, inicio: r.ini, fin: r.fin }));
    log(`  · Evaluaciones detectadas: ${c.verde(evalInfo.length)}`);
  } else {
    evalInfo = rangosFallback(2, y0, y1).map((r, i) => ({ valor: i + 1, inicio: new Date(r[0]), fin: new Date(r[1]) }));
    log(`  · Sin módulo hermano con datos. Uso ${c.ama(evalInfo.length + ' evaluaciones por defecto')}.`);
  }
  for (const e of evalInfo) log(`      eval=${JSON.stringify(e.valor)}  ${iso(e.inicio)} → ${iso(e.fin)}`);

  const tareaTpl = (await db.collection('tareas').where('grupoId', '==', grupoId).limit(1).get())
    .docs[0]?.data() || (await db.collection('tareas').limit(1).get()).docs[0]?.data() || null;
  const examenTpl = (await db.collection('examenes').where('grupoId', '==', grupoId).limit(1).get())
    .docs[0]?.data() || (await db.collection('examenes').limit(1).get()).docs[0]?.data() || null;
  log('  · Plantilla tareas:  ' + (tareaTpl ? c.gris(Object.keys(tareaTpl).join(', ')) : c.ama('ninguna; forma por defecto')));
  log('  · Plantilla examenes:' + (examenTpl ? c.gris(Object.keys(examenTpl).join(', ')) : c.ama(' ninguna; forma por defecto')));

  if (PROBE_ONLY) { log(c.verde('\n  --probe: solo diagnóstico. Nada que escribir.\n')); await admin.app().delete(); return; }
  if (COMMIT && !CONFIG.grupoId && !coincideNombre) {
    throw new Error(`El grupo resuelto (${grupo.nombre}) no coincide con "${CONFIG.grupoNombre}". Fija CONFIG.grupoId con el correcto antes de --commit.`);
  }

  const nEvals = evalInfo.length;
  const ctx = { moduloId, grupoId, profesorId, cursoAcademico: CONFIG.curso, origen: 'seed-dasp' };
  const ahora = Timestamp.now();

  // ── FASE 1 · Programación (bandas de desafío) ──────────────────────
  log(c.azul('\nFASE 1 · Programación'));
  const porEvalIdx = new Map();
  for (const d of DESAFIOS) {
    const idx = idxEval(d.trimestre, nEvals);
    if (!porEvalIdx.has(idx)) porEvalIdx.set(idx, []);
    porEvalIdx.get(idx).push(d);
  }
  const eventos = [];   // { ref, unidadId, desafio, _ini, _fin }
  for (const [idx, ds] of [...porEvalIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const info = evalInfo[idx];
    const bandas = repartirBandas(info.inicio, info.fin, ds);
    for (const b of bandas) {
      const ref = db.collection('eventos_programacion').doc();
      eventos.push({
        ref, unidadId: ref.id, desafio: b, _ini: b.fechaInicio, _fin: b.fechaFin, evaluacion: info.valor,
        data: {
          ...ctx, evaluacion: info.valor, tipo: 'tema',
          titulo: `Desafío ${b.n}. ${b.titulo}`,
          descripcion: b.descripcion,
          fechaInicio: ts(b.fechaInicio), fechaFin: ts(b.fechaFin),
          color: CONFIG.colores[(b.n - 1) % CONFIG.colores.length],
          createdAt: ahora, updatedAt: ahora, raAsociado: b.ras.join(', '),
        },
      });
      log(`  · Desafío ${b.n} (${b.ras.join('+')}, eval ${JSON.stringify(info.valor)}) ` +
        c.gris(`${iso(b.fechaInicio)} → ${iso(b.fechaFin)}`));
    }
  }

  // ── FASE 2 · Tareas (actividades + retos por desafío) ──────────────
  log(c.azul('\nFASE 2 · Tareas'));
  const tareas = [];
  for (const ev of eventos) {
    const d = ev.desafio;
    const items = [
      ...d.tareas.map(t => ({ titulo: t, peso: CONFIG.pesoTarea, reto: false })),
      ...d.retos.map(t => ({ titulo: t, peso: CONFIG.pesoReto, reto: true })),
    ];
    const fechas = repartirFechas(ev._ini, ev._fin, items.length);
    items.forEach((it, i) => {
      tareas.push({
        ...clonarForma(tareaTpl), ...ctx,
        titulo: `D${d.n} · ${it.titulo}`,
        descripcion: `Desafío ${d.n}: ${d.titulo} (${d.ras.join(', ')}).` + (it.reto ? ' Producto/reto final.' : ''),
        unidadId: ev.unidadId, evaluacion: ev.evaluacion,
        fechaEntrega: ts(fechas[i]), peso: it.peso, entregas: [],
        createdAt: ahora, updatedAt: ahora,
      });
    });
    log(`  · Desafío ${d.n}: ${d.tareas.length} actividades + ${d.retos.length} reto(s)`);
  }
  log(`  · Total tareas: ${tareas.length}`);

  // ── FASE 3 · Exámenes (1 prueba teórico-práctica por desafío) ──────
  const examenes = [];
  if (CONFIG.crearExamenes) {
    log(c.azul('\nFASE 3 · Exámenes'));
    const ultimoEv = eventos[eventos.length - 1];
    for (const ev of eventos) {
      const d = ev.desafio;
      const esUltimo = ev === ultimoEv;
      examenes.push({
        ...clonarForma(examenTpl), ...ctx,
        titulo: `Prueba teórico-práctica · Desafío ${d.n} (${d.ras.join(', ')})`,
        descripcion: `Prueba de los resultados de aprendizaje ${d.ras.join(', ')} — ${d.titulo}.`,
        tipo: esUltimo ? 'final' : 'parcial', esFinal: esUltimo,
        evaluacion: ev.evaluacion, unidadId: ev.unidadId,
        fecha: ts(ev._fin), createdAt: ahora, updatedAt: ahora,
      });
      log(`  · Desafío ${d.n} · ${esUltimo ? 'final' : 'parcial'} · ${c.gris(iso(ev._fin))}`);
    }
  } else {
    log(c.azul('\nFASE 3 · Exámenes') + c.gris('  (desactivado: CONFIG.crearExamenes = false)'));
  }

  // ── Limpieza idempotente + backup ──────────────────────────────────
  log(c.azul('\nLimpieza idempotente (origen=seed-dasp para este módulo)'));
  const previos = {};
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    const snap = await db.collection(col).where('moduloId', '==', moduloId).where('origen', '==', 'seed-dasp').get().catch(() => ({ docs: [] }));
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

  // ── Escritura ───────────────────────────────────────────────────────
  log('');
  if (!COMMIT) {
    log(c.ama('────────────────────────────────────────────────────────────'));
    log(c.ama(`  DRY-RUN: nada escrito. Crearía ${eventos.length} desafíos, ${tareas.length} tareas, ${examenes.length} exámenes.`));
    log(c.ama('  Repite con --commit para aplicar.'));
    log(c.ama('────────────────────────────────────────────────────────────\n'));
    await admin.app().delete(); return;
  }

  const ops = [];
  for (const col of Object.keys(previos)) for (const d of previos[col]) ops.push(b => b.delete(d.ref));
  for (const ev of eventos) ops.push(b => b.set(ev.ref, ev.data));
  for (const t of tareas) ops.push(b => b.set(db.collection('tareas').doc(), t));
  for (const x of examenes) ops.push(b => b.set(db.collection('examenes').doc(), x));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach(fn => fn(batch));
    await batch.commit();
  }

  log(c.verde('────────────────────────────────────────────'));
  log(c.verde('  ✅ HECHO'));
  log(`  · Programación: ${eventos.length} desafíos`);
  log(`  · Tareas: ${tareas.length}`);
  log(`  · Exámenes: ${examenes.length}`);
  log(`  · Módulo ${CONFIG.moduloAbreviatura} · grupo ${grupo.nombre} · curso ${CONFIG.curso}`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Recarga Programación / Tareas / Exámenes.\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
