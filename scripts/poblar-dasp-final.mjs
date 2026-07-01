#!/usr/bin/env node
/**
 * poblar-dasp-final.mjs
 * --------------------------------------------------------------------------
 * Recrea PROGRAMACIÓN, TAREAS y EXÁMENES del cuaderno de DASP, lo más completo
 * posible, según la programación de 4 desafíos.
 *
 * Apunta al cuaderno ACTIVO de DASP: curso 2025-2026, grupo SM1 (1.º SMR), que
 * es el sitio natural del módulo. Para evitar los fallos anteriores:
 *
 *   · GRUPO: se resuelve por el cicloId del módulo + curso (no por el primer
 *     "2AW3" que aparezca, que era de otro ciclo).
 *   · EVALUACIONES: van EXPLÍCITAS en CONFIG (texto + fechas reales que muestra
 *     el cuaderno), así los eventos caen exactamente bajo sus pestañas.
 *   · CAMPOS NATIVOS reales (porcentajeNotaFinal, publicada/publicado,
 *     fechaPublicacion, puntuacionMaxima, entregas[], calificaciones[]…).
 *
 * Convenciones: serviceAccount.json en scripts/ · proyecto cuaderno-digital-fp
 * · DRY-RUN por defecto (--commit para escribir) · backup JSON previo · todo
 * con origen:'seed-dasp'. Al reejecutar borra TODO lo etiquetado de DASP en
 * cualquier grupo/curso y recrea → limpia de paso las siembras equivocadas
 * anteriores (las que fueron a 2AW3/2026-2027).
 *
 * Para poblar OTRO curso (p. ej. 2026-2027 / 2AW3): cambia CONFIG.curso,
 * CONFIG.grupoNombre y CONFIG.evaluaciones (fechas de ese curso).
 *
 * Uso:
 *   cp ~/Downloads/poblar-dasp-final.mjs scripts/
 *   node scripts/poblar-dasp-final.mjs --probe
 *   node scripts/poblar-dasp-final.mjs
 *   node scripts/poblar-dasp-final.mjs --commit
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
  curso: '2025-2026',
  grupoNombre: 'SM1',
  grupoId: null,

  // Evaluaciones de DOCENCIA: el texto debe coincidir EXACTO con las pestañas
  // del cuaderno; las fechas son las que muestra (SM1, 2025-2026).
  evaluaciones: [
    { label: '1ª Evaluación', inicio: '2025-09-14', fin: '2025-11-16' },
    { label: '2ª Evaluación', inicio: '2025-11-17', fin: '2026-02-19' },
  ],

  crearExamenes: true,
  puntuacionMaxima: 10,
  porcentajeTarea: 4,
  porcentajeReto: 12,
  porcentajeExamen: 10,

  colores: ['#2E7D32', '#EF6C00', '#00838F', '#6A1B9A'],
};

// ─────────────── DATOS DE LA PROGRAMACIÓN (4 DESAFÍOS) ───────────────
const DESAFIOS = [
  {
    n: 1, titulo: 'Economía Circular', ras: ['RA1', 'RA2'], sesiones: 10,
    descripcion: 'Transformación del modelo de economía lineal a circular y transformación industrial ' +
      '(automatización, sistemas ciberfísicos, Industria 4.0 e Industria 5.0). Producto final: Plan 360.',
    tareas: ['Preguntas de reflexión', 'Actividad de investigación ODS', 'Industria 4.0 e Industria 5.0',
      'Actividad del mundo físico al virtual', 'Actividad de reflexión: Fast Fashion', 'Escáner circular', 'Escáner digital'],
    retos: ['Plan 360 · reto final'],
  },
  {
    n: 2, titulo: 'Transformación Digital', ras: ['RA4'], sesiones: 10,
    descripcion: 'Tecnologías habilitadoras (THD) para la transformación digital de la empresa: ' +
      'características, ventajas e inconvenientes en los sectores productivos. Producto final: Comerciales THD.',
    tareas: ['Preguntas de reflexión', 'Actividades de consolidación', 'La UE más digital',
      '¿Nos digitalizamos entonces?', 'La realidad digital empresarial'],
    retos: ['Comerciales THD · reto final'],
  },
  {
    n: 3, titulo: 'Almacenamiento en Cloud / nube', ras: ['RA3'], sesiones: 10,
    descripcion: 'Papel del cloud computing en la transformación digital de las pymes: servicios en la nube, ' +
      'colaboración y seguridad de la información. Producto final: Nube Experta.',
    tareas: ['Preguntas de reflexión', 'Analiza la nube', 'Actividad de investigación: la nube en nuestro sector',
      'Cuestionario: encuentra la nube oculta', 'Ponemos nuestra nube en marcha', 'Nombrar bien, organizar mejor',
      'Detective de permisos', 'Errores que cuestan caro', 'Mi decálogo de seguridad'],
    retos: ['Nube Experta · reto final'],
  },
  {
    n: 4, titulo: 'Plan de Digitalización', ras: ['RA5'], sesiones: 12,
    descripcion: 'Puesta en marcha de un plan de digitalización para una pequeña empresa del sector, ' +
      'integrando lo trabajado en los desafíos anteriores y herramientas de análisis estratégico.',
    tareas: ['¿Trabajaremos menos gracias a la tecnología?', 'Investigación: ¿son los países más ricos los más tecnológicos?',
      'Diagnóstico Express de Ciberseguridad para una PYME', 'Investigación: ciberataques y robo de datos en empresas',
      'Ciberseguridad personal', 'De la teoría a la estrategia: cuatro claves de la transformación digital'],
    retos: ['Plan de Digitalización · Fase 1: Diagnóstico', 'Plan de Digitalización · Fase 2: Estrategia',
      'Plan de Digitalización · Fase 3: Implementación', 'Plan de Digitalización · Fase 4: Evaluación'],
  },
];

// ───────────────────────────── UTILIDADES ─────────────────────────────
const c = { gris: s => `\x1b[90m${s}\x1b[0m`, verde: s => `\x1b[32m${s}\x1b[0m`,
  ama: s => `\x1b[33m${s}\x1b[0m`, azul: s => `\x1b[36m${s}\x1b[0m`, rojo: s => `\x1b[31m${s}\x1b[0m` };
const log = (...a) => console.log(...a);
const Timestamp = admin.firestore.Timestamp;
const ts = d => Timestamp.fromDate(d instanceof Date ? d : new Date(d));
const iso = d => d.toISOString().slice(0, 10);

function cargarServiceAccount() {
  for (const f of ['serviceAccount.json', 'firebase-key.json']) {
    const p = join(__dirname, f);
    if (existsSync(p)) return { path: p, json: JSON.parse(readFileSync(p, 'utf8')) };
  }
  throw new Error('No se encontró serviceAccount.json en scripts/.');
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

// Reparte `count` fechas dentro de [ini, fin] sin tocar los extremos.
function repartirFechas(ini, fin, count) {
  const span = fin - ini;
  return Array.from({ length: count }, (_, i) => new Date(ini.getTime() + span * (i + 1) / (count + 1)));
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.azul('  POBLAR DASP (definitivo) · Programación + Tareas + Exámenes'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Clave: ${c.gris(sa.path)}`);
  log(`  Modo:  ${COMMIT ? c.verde('COMMIT (escribe)') : c.ama('DRY-RUN (no escribe)')}`);
  log(`  Curso: ${CONFIG.curso}  ·  Grupo objetivo: ${CONFIG.grupoNombre}\n`);

  // ── FASE 0 · Detección ──────────────────────────────────────────────
  log(c.azul('FASE 0 · Detección'));
  const modQ = await db.collection('modulos').where('abreviatura', '==', CONFIG.moduloAbreviatura).limit(1).get();
  if (modQ.empty) throw new Error(`No existe el módulo ${CONFIG.moduloAbreviatura}.`);
  const moduloId = modQ.docs[0].id;
  const modulo = modQ.docs[0].data();
  const cicloId = modulo.cicloId || null;
  const profesorId = modulo.profesorId || '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';
  log(`  · Módulo ${CONFIG.moduloAbreviatura}: ${c.gris(moduloId)} (cicloId=${c.gris(cicloId)})`);

  const grupos = (await db.collection('grupos').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const cursoDe = g => g.cursoAcademico || g.curso || g.cursoAcad || null;
  const mismoCiclo = grupos.filter(g => g.cicloId === cicloId);
  log('  · Grupos del ciclo del módulo:');
  for (const g of mismoCiclo) log(`      ${c.gris(g.id)}  nombre=${g.nombre}  curso=${cursoDe(g)}`);

  let grupo = null;
  if (CONFIG.grupoId) grupo = grupos.find(g => g.id === CONFIG.grupoId) || null;
  if (!grupo) grupo = mismoCiclo.find(g => cursoDe(g) === CONFIG.curso && g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = mismoCiclo.find(g => cursoDe(g) === CONFIG.curso);
  if (!grupo) grupo = mismoCiclo.find(g => g.nombre === CONFIG.grupoNombre);
  if (!grupo) grupo = mismoCiclo[0] || null;
  if (!grupo) throw new Error('No hay grupo en el ciclo del módulo. Fija CONFIG.grupoId.');
  const grupoId = grupo.id;
  const cicloOk = grupo.cicloId === cicloId;
  log(`  · Grupo elegido: ${c.gris(grupoId)} (${grupo.nombre}, curso ${cursoDe(grupo)})` +
    (cicloOk ? c.verde('  ✓ mismo ciclo') : c.rojo('  ✗ ciclo distinto')));

  const evalInfo = CONFIG.evaluaciones.map(e => ({ valor: e.label, inicio: new Date(e.inicio), fin: new Date(e.fin) }));
  log(`  · Evaluaciones (de CONFIG): ${c.verde(evalInfo.length)}`);
  for (const e of evalInfo) log(`      "${e.valor}"  ${iso(e.inicio)} → ${iso(e.fin)}`);

  const tareaTpl = (await db.collection('tareas').limit(1).get()).docs[0]?.data() || null;
  const examenTpl = (await db.collection('examenes').limit(1).get()).docs[0]?.data() || null;
  log('  · Campos tareas:  ' + (tareaTpl ? c.gris(Object.keys(tareaTpl).join(', ')) : c.ama('sin ejemplo')));
  log('  · Campos examenes:' + (examenTpl ? c.gris(Object.keys(examenTpl).join(', ')) : c.ama(' sin ejemplo')));

  if (PROBE_ONLY) { log(c.verde('\n  --probe: solo diagnóstico. Nada que escribir.\n')); await admin.app().delete(); return; }
  if (COMMIT && !CONFIG.grupoId && !cicloOk) {
    throw new Error('El grupo resuelto no es del mismo ciclo que el módulo. Fija CONFIG.grupoId.');
  }

  const nEvals = evalInfo.length;
  const ahora = Timestamp.now();
  const baseCtx = { moduloId, grupoId, profesorId, cursoAcademico: CONFIG.curso, origen: 'seed-dasp' };

  // Reparte los desafíos lo más equilibradamente posible entre evaluaciones.
  const idxDesafio = i => Math.min(Math.floor(i * nEvals / DESAFIOS.length), nEvals - 1);

  // ── FASE 1 · Programación ──────────────────────────────────────────
  log(c.azul('\nFASE 1 · Programación'));
  const porEvalIdx = new Map();
  DESAFIOS.forEach((d, i) => {
    const idx = idxDesafio(i);
    if (!porEvalIdx.has(idx)) porEvalIdx.set(idx, []);
    porEvalIdx.get(idx).push(d);
  });
  const eventos = [];
  for (const [idx, ds] of [...porEvalIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const info = evalInfo[idx];
    for (const b of repartirBandas(info.inicio, info.fin, ds)) {
      const ref = db.collection('eventos_programacion').doc();
      eventos.push({
        ref, unidadId: ref.id, desafio: b, _ini: b.fechaInicio, _fin: b.fechaFin, evaluacion: info.valor,
        data: {
          ...baseCtx, evaluacion: info.valor, tipo: 'tema',
          titulo: `Desafío ${b.n}. ${b.titulo}`, descripcion: b.descripcion,
          fechaInicio: ts(b.fechaInicio), fechaFin: ts(b.fechaFin),
          color: CONFIG.colores[(b.n - 1) % CONFIG.colores.length],
          raAsociado: b.ras.join(', '), unidadId: ref.id, createdAt: ahora, updatedAt: ahora,
        },
      });
      log(`  · Desafío ${b.n} (${b.ras.join('+')}, "${info.valor}") ` + c.gris(`${iso(b.fechaInicio)} → ${iso(b.fechaFin)}`));
    }
  }

  // ── FASE 2 · Tareas ────────────────────────────────────────────────
  log(c.azul('\nFASE 2 · Tareas'));
  const tareas = [];
  for (const ev of eventos) {
    const d = ev.desafio;
    const items = [
      ...d.tareas.map(t => ({ titulo: t, pct: CONFIG.porcentajeTarea, reto: false })),
      ...d.retos.map(t => ({ titulo: t, pct: CONFIG.porcentajeReto, reto: true })),
    ];
    const fechas = repartirFechas(ev._ini, ev._fin, items.length);
    items.forEach((it, i) => {
      tareas.push({
        ...baseCtx,
        titulo: `D${d.n} · ${it.titulo}`,
        descripcion: `Desafío ${d.n}: ${d.titulo} (${d.ras.join(', ')}).` + (it.reto ? ' Producto/reto final.' : ''),
        resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
        fechaPublicacion: ts(ev._ini), fechaEntrega: ts(fechas[i]),
        puntuacionMaxima: CONFIG.puntuacionMaxima, porcentajeNotaFinal: it.pct,
        penalizacionRetraso: 0, permiteEntregaTardia: true, esGrupal: it.reto, requiereArchivo: false,
        evaluacion: ev.evaluacion, publicada: true, archivada: false,
        entregas: [], adjuntos: [], unidadId: ev.unidadId, createdAt: ahora, updatedAt: ahora,
      });
    });
    log(`  · Desafío ${d.n}: ${d.tareas.length} actividades + ${d.retos.length} reto(s)`);
  }
  log(`  · Total tareas: ${tareas.length}`);

  // ── FASE 3 · Exámenes ──────────────────────────────────────────────
  const examenes = [];
  if (CONFIG.crearExamenes) {
    log(c.azul('\nFASE 3 · Exámenes'));
    const ultimo = eventos[eventos.length - 1];
    for (const ev of eventos) {
      const d = ev.desafio;
      const esFinal = ev === ultimo;
      examenes.push({
        ...baseCtx,
        titulo: `Prueba teórico-práctica · Desafío ${d.n} (${d.ras.join(', ')})`,
        descripcion: `Prueba de los RA ${d.ras.join(', ')} — ${d.titulo}.`,
        tipo: esFinal ? 'final' : 'parcial', evaluacion: ev.evaluacion,
        puntuacionMaxima: CONFIG.puntuacionMaxima, porcentajeNotaFinal: CONFIG.porcentajeExamen,
        notaMinimaAprobado: 5, tienePonderacion: true,
        horaInicio: null, horaFin: null, aula: '', duracionMinutos: 50,
        fecha: ts(ev._fin), publicado: true, resultadosPublicados: false, permiteRecuperacion: true,
        calificaciones: [], secciones: [], resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
        unidadId: ev.unidadId, esFinal, createdAt: ahora, updatedAt: ahora,
      });
      log(`  · Desafío ${d.n} · ${esFinal ? 'final' : 'parcial'} · ${c.gris(iso(ev._fin))}`);
    }
  } else log(c.azul('\nFASE 3 · Exámenes') + c.gris('  (desactivado)'));

  // ── Limpieza idempotente + backup ──────────────────────────────────
  log(c.azul('\nLimpieza idempotente (origen=seed-dasp, en cualquier grupo/curso)'));
  const previos = {};
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    const snap = await db.collection(col).where('moduloId', '==', moduloId).where('origen', '==', 'seed-dasp').get().catch(() => ({ docs: [] }));
    previos[col] = snap.docs;
    log(`  · ${col}: ${snap.docs.length} a reemplazar`);
  }
  if (Object.values(previos).some(d => d.length)) {
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
    log(c.ama(`  DRY-RUN: nada escrito. Crearía ${eventos.length} desafíos, ${tareas.length} tareas, ${examenes.length} exámenes en ${grupo.nombre}.`));
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
  log(`  · Programación: ${eventos.length} desafíos · Tareas: ${tareas.length} · Exámenes: ${examenes.length}`);
  log(`  · Módulo ${CONFIG.moduloAbreviatura} · grupo ${grupo.nombre} (${grupoId}) · curso ${CONFIG.curso}`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Recarga Programación / Tareas / Exámenes (con 2025-2026 y SM1 activos).\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
