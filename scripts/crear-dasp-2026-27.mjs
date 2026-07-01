#!/usr/bin/env node
/**
 * crear-dasp-2026-27.mjs  (2º curso · SM2 · 2026-2027)
 * --------------------------------------------------------------------------
 * Crea el cuaderno del módulo DASP (Digitalización Aplicada a los Sectores
 * Productivos) del ciclo SMR de Grado Medio para el grupo de 2º (SM2),
 * curso 2026-2027, dentro de "Cuaderno Digital FP Euskadi".
 *
 * Lo que hace, en fases idempotentes:
 *   0. Sonda de esquema  → lee módulo, evento, tarea y examen existentes para
 *                          detectar la forma real de los campos y el FORMATO
 *                          del campo `evaluacion` (etiqueta vs número).
 *   1. Ciclo SMR         → lo reutiliza si existe; si no, lo crea.
 *   2. Grupo 2º (SM2)    → lo reutiliza si existe; si no, lo crea.
 *   3. Módulo DASP       → crea o actualiza con los 5 RA y sus CE ponderados.
 *   4. Programación      → 5 bandas de UD en 2 evaluaciones + eventos de
 *                          actividad y examen en la línea temporal.
 *   5. Tareas/actividades + Exámenes → documentos en sus colecciones.
 *
 * Convenciones del proyecto:
 *   - serviceAccount.json en la carpeta scripts/.
 *   - Proyecto Firebase: cuaderno-digital-fp.
 *   - Dry-run por defecto. Escribe SOLO con --commit (o --apply).
 *   - Backup JSON antes de tocar nada existente.
 *   - Todo lo creado se etiqueta origen:'seed-dasp' para reejecutar sin duplicar.
 *
 * Uso:
 *   cp ~/Downloads/crear-dasp-2026-27.mjs scripts/
 *   node scripts/crear-dasp-2026-27.mjs            # simula, no escribe
 *   node scripts/crear-dasp-2026-27.mjs --commit   # aplica los cambios
 *   node scripts/crear-dasp-2026-27.mjs --probe    # solo muestra el esquema
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
  centroIdFallback: 'default',

  curso: '2026-2027',                 // curso académico del cuaderno

  cicloAbreviatura: 'SMR',
  cicloNombre: 'Sistemas Microinformáticos y Redes',

  grupoNombre: 'SM2',                 // grupo de 2º de Grado Medio
  grupoCurso: 'Segundo Curso',

  moduloAbreviatura: 'DASP',
  moduloNombre: 'Digitalización aplicada a los sectores productivos',
  horasSemanales: 1,
  horasTotales: 32,

  profesorId: '21m6mMuCAieZ7ZpcR2xfm9kH9yc2',

  // Etiquetas EXACTAS de las pestañas del selector de evaluaciones.
  // Si la sonda detecta que el proyecto usa números, se usan números.
  etiquetasEval: { 1: '1ª Evaluación', 2: '2ª Evaluación' },

  // Ventana ISO de cada evaluación (2º curso, acaba antes por la FCT).
  // Ajústalas a tu calendario real de Zornotza.
  periodos: {
    1: ['2026-09-14', '2026-12-18'],
    2: ['2027-01-08', '2027-03-20'],
  },

  // Si la app deriva actividades/exámenes en la línea temporal a partir de las
  // colecciones tareas/examenes, pon esto en false para no duplicarlos.
  crearEventosActExam: true,

  colores: ['#1565C0', '#2E7D32', '#EF6C00', '#6A1B9A', '#00838F'],
};

// ──────────────── DATOS DE LA PROGRAMACIÓN (DASP) ─────────────────
// 5 RA (programación oficial IES de referencia). Cada RA vale 20 %.
const RESULTADOS = [
  {
    codigo: 'RA1',
    peso: 20,
    descripcion: 'Establece las diferencias entre la Economía Lineal (EL) y la Economía Circular (EC), identificando las ventajas de la EC en relación con el medioambiente y el desarrollo sostenible.',
    criterios: [
      ['CE1.a', 'Se han identificado las etapas «típicas» de los modelos basados en EL y modelos basados en EC.'],
      ['CE1.b', 'Se ha analizado cada etapa de los modelos EL y EC y su repercusión en el medio ambiente.'],
      ['CE1.c', 'Se ha valorado la importancia del reciclaje en los modelos económicos.'],
      ['CE1.d', 'Se han identificado procesos reales basados en EL.'],
      ['CE1.e', 'Se han identificado procesos reales basados en EC.'],
      ['CE1.f', 'Se han comparado los modelos anteriores en relación con su impacto medioambiental y los ODS (Objetivos de Desarrollo Sostenible).'],
    ],
  },
  {
    codigo: 'RA2',
    peso: 20,
    descripcion: 'Caracteriza los principales aspectos de la 4.ª Revolución Industrial indicando los cambios y las ventajas que se producen tanto desde el punto de vista de los clientes como de las empresas.',
    criterios: [
      ['CE2.a', 'Se han relacionado los sistemas ciberfísicos con la evolución industrial.'],
      ['CE2.b', 'Se ha analizado el cambio producido en los sistemas automatizados.'],
      ['CE2.c', 'Se ha descrito la combinación de la parte física de las industrias con el software, IoT, comunicaciones, entre otros.'],
      ['CE2.d', 'Se ha descrito la interrelación entre el mundo físico y el virtual.'],
      ['CE2.e', 'Se ha relacionado la migración a entornos 4.0 con la mejora de los resultados de las empresas.'],
      ['CE2.f', 'Se han identificado las ventajas para clientes y empresas.'],
    ],
  },
  {
    codigo: 'RA3',
    peso: 20,
    descripcion: 'Identifica la estructura de los sistemas basados en cloud/nube describiendo su tipología y campo de aplicación.',
    criterios: [
      ['CE3.a', 'Se han identificado los diferentes niveles de la cloud/nube.'],
      ['CE3.b', 'Se han identificado las principales funciones de la cloud/nube (procesamiento de datos, intercambio de información, ejecución de aplicaciones, entre otros).'],
      ['CE3.c', 'Se ha descrito el concepto de edge computing y su relación con la cloud/nube.'],
      ['CE3.d', 'Se han definido los conceptos de fog y mist y sus zonas de aplicación en el conjunto.'],
      ['CE3.e', 'Se han identificado las ventajas que proporciona la utilización de la cloud/nube en los sistemas conectados.'],
    ],
  },
  {
    codigo: 'RA4',
    peso: 20,
    descripcion: 'Compara los sistemas de producción/prestación de servicios digitalizados con los sistemas clásicos identificando las mejoras introducidas.',
    criterios: [
      ['CE4.a', 'Se han identificado las tecnologías habilitadoras (THD) actuales que definen un sistema digitalizado.'],
      ['CE4.b', 'Se han descrito las características y aplicaciones del IoT, IA, Big Data, tecnología 5G, robótica colaborativa, Blockchain, Ciberseguridad, fabricación aditiva, realidad virtual y gemelos digitales, entre otras.'],
      ['CE4.c', 'Se ha descrito la contribución de las THD a la mejora de la productividad y la eficiencia de los sistemas productivos o de prestación de servicios.'],
      ['CE4.d', 'Se ha relacionado la alineación entre las unidades funcionales de las empresas que conforman el sistema y el objetivo del mismo.'],
      ['CE4.e', 'Se ha relacionado la implantación de las tecnologías habilitadoras (sensórica, tratamiento de datos, automatización y comunicaciones) con la reducción de costes y la mejora de la competitividad.'],
      ['CE4.f', 'Se han relacionado las tecnologías disruptivas con aplicaciones concretas en los sectores productivos.'],
      ['CE4.g', 'Se han definido los sistemas de almacenamiento de datos no convencionales y el acceso a los mismos desde cada unidad.'],
      ['CE4.h', 'Se han descrito las mejoras producidas en el sistema y en cada una de sus etapas.'],
    ],
  },
  {
    codigo: 'RA5',
    peso: 20,
    descripcion: 'Elabora un plan de transformación de una empresa clásica del sector en el que se enmarca el título, basada en una EL, al concepto 4.0, determinando los cambios a introducir en las principales fases del sistema e indicando cómo afectaría a los recursos humanos.',
    criterios: [
      ['CE5.a', 'Se ha definido a nivel de bloques el diagrama de funcionamiento de la empresa clásica.'],
      ['CE5.b', 'Se han identificado las etapas susceptibles de ser digitalizadas.'],
      ['CE5.c', 'Se han definido las tecnologías implicadas en cada una de las etapas.'],
      ['CE5.d', 'Se ha establecido la conexión de las etapas digitalizadas con el resto del sistema.'],
      ['CE5.e', 'Se ha elaborado un diagrama de bloques del sistema digitalizado.'],
      ['CE5.f', 'Se ha elaborado un informe de viabilidad y de las mejoras introducidas.'],
      ['CE5.g', 'Se ha analizado la mejora en la producción y gestión de residuos, entre otras.'],
      ['CE5.h', 'Se ha elaborado un documento con la secuencia del plan de transformación y los recursos empleados.'],
    ],
  },
];

// Unidades didácticas → RA, EVALUACIÓN (1 ó 2), nº de sesiones y contenidos.
const UNIDADES = [
  {
    n: 1, titulo: 'Digitalización y sostenibilidad', ra: 'RA1', evaluacion: 1, sesiones: 7,
    contenidos: [
      '1.1 Economías lineal y circular. Modelos de empresas basados en ambas.',
      '1.2 Responsabilidad social: modelos de empresas y afectación del medioambiente.',
      '1.3 Importancia del reciclaje en los modelos económicos.',
      '1.4 Procesos reales basados en la EL y en la EC.',
      '1.5 Comparativa de modelos según su impacto medioambiental y los ODS.',
    ],
  },
  {
    n: 2, titulo: 'La cuarta revolución industrial', ra: 'RA2', evaluacion: 1, sesiones: 6,
    contenidos: [
      '2.1 Sistemas ciberfísicos. Relación con la evolución industrial.',
      '2.2 Sistemas automatizados. Cambios provocados por la cuarta revolución.',
      '2.3 Interrelación entre el mundo físico y el virtual.',
      '2.4 Ventajas de la migración a entornos 4.0.',
      '2.5 Ventajas de la 4.ª revolución industrial para clientes y empresas.',
    ],
  },
  {
    n: 3, titulo: 'Sistemas basados en la nube', ra: 'RA3', evaluacion: 1, sesiones: 6,
    contenidos: [
      '3.1 Cloud. Definición y niveles.',
      '3.2 Posibilidades del trabajo en la cloud.',
      '3.3 Edge computing y su relación con la cloud.',
      '3.4 Fog y mist. Relación con la cloud.',
      '3.5 Ventajas del uso de los recursos de la cloud.',
      '3.6 Uso de la cloud y la rentabilidad de la empresa.',
    ],
  },
  {
    n: 4, titulo: 'Características de los sistemas de producción', ra: 'RA4', evaluacion: 2, sesiones: 7,
    contenidos: [
      '4.1 Tecnologías habilitadoras (THD) actuales. Características y aplicaciones.',
      '4.2 Relación entre THD y productividad.',
      '4.3 Implantación de THD: reducción de costes y mejora de la competitividad.',
      '4.4 Sistemas digitalizados reales. Ejemplos.',
      '4.5 Tecnología disruptiva. Ejemplos.',
      '4.6 Sistemas de almacenamiento de datos.',
    ],
  },
  {
    n: 5, titulo: 'Plan de transformación digital de una empresa', ra: 'RA5', evaluacion: 2, sesiones: 6,
    contenidos: [
      '5.1 Configuración de una empresa clásica. Digitalización de la empresa o sus unidades.',
      '5.2 THD implicadas en la digitalización de las etapas. Relación entre etapas.',
      '5.3 Configuración de la empresa digitalizada.',
      '5.4 Plan de transformación. Recursos empleados.',
    ],
  },
];

// Actividades/tareas → UD de referencia (para la fecha de entrega), RA, evaluación.
const ACTIVIDADES = [
  { ud: 1, ra: 'RA1', evaluacion: 1, titulo: 'A1. Economía lineal vs circular y los ODS',
    descripcion: 'Analiza dos empresas reales (una EL y una EC), describe sus etapas y compáralas por impacto ambiental relacionándolas con los ODS. Entrega un informe con conclusiones.' },
  { ud: 2, ra: 'RA2', evaluacion: 1, titulo: 'A2. Estudio de un sistema ciberfísico (Industria 4.0)',
    descripcion: 'Elige un sistema ciberfísico real (línea de producción, almacén automatizado…) y explica la interrelación físico-virtual y las ventajas 4.0 para clientes y empresa.' },
  { ud: 3, ra: 'RA3', evaluacion: 1, titulo: 'A3. Mapa de la nube: niveles, edge, fog y mist',
    descripcion: 'Elabora un esquema con los niveles de la cloud y ubica edge, fog y mist con un caso de uso para cada uno. Justifica las ventajas para un sistema conectado.' },
  { ud: 4, ra: 'RA4', evaluacion: 2, titulo: 'A4. Catálogo de Tecnologías Habilitadoras Digitales',
    descripcion: 'Cataloga al menos 6 THD (IoT, IA, Big Data, 5G, blockchain, gemelos digitales…) con una aplicación real en un sector productivo y su aporte a productividad/eficiencia.' },
  { ud: 5, ra: 'RA5', evaluacion: 2, titulo: 'A5. Plan de transformación digital (I): diagnóstico',
    descripcion: 'Diagrama de bloques de una empresa clásica e identificación de las etapas digitalizables y las tecnologías implicadas en cada una.' },
  { ud: 5, ra: 'RA5', evaluacion: 2, fin: true, titulo: 'A6. Plan de transformación digital (II): propuesta',
    descripcion: 'Diagrama del sistema digitalizado, informe de viabilidad, mejoras (producción y residuos) y documento final con la secuencia del plan y los recursos.' },
];

// Exámenes. tipo: 'parcial' (de evaluación) o 'final' (global), como en APIN.
const EXAMENES = [
  { evaluacion: 1, tipo: 'parcial', ras: ['RA1', 'RA2', 'RA3'], titulo: 'Examen 1ª Eval: Economía circular, Industria 4.0 y Cloud',
    descripcion: 'Prueba escrita sobre economía circular/sostenibilidad, 4.ª revolución industrial y sistemas cloud. Teoría + supuestos prácticos. 90 min.' },
  { evaluacion: 2, tipo: 'parcial', ras: ['RA4', 'RA5'], titulo: 'Examen 2ª Eval: THD y transformación digital',
    descripcion: 'Prueba escrita sobre tecnologías habilitadoras y plan de transformación digital. Teoría + supuesto práctico de digitalización de una empresa. 90 min.' },
  { evaluacion: 2, tipo: 'final', ras: ['RA1', 'RA2', 'RA3', 'RA4', 'RA5'], titulo: 'Examen final: Digitalización aplicada (RA1–RA5)',
    descripcion: 'Prueba global de recuperación/final sobre los 5 RA del módulo. Teoría + supuestos prácticos. 120 min.', duracion: 120 },
];

// Nota mínima para aprobar (lo que en la app sale como "Mín: 5").
const NOTA_MINIMA = 5;

// ───────────────────────────── UTILIDADES ─────────────────────────────
const c = { gris: s => `\x1b[90m${s}\x1b[0m`, verde: s => `\x1b[32m${s}\x1b[0m`,
  ama: s => `\x1b[33m${s}\x1b[0m`, azul: s => `\x1b[36m${s}\x1b[0m`, rojo: s => `\x1b[31m${s}\x1b[0m` };
const log = (...a) => console.log(...a);
const ts = d => admin.firestore.Timestamp.fromDate(d instanceof Date ? d : new Date(d));

function cargarServiceAccount() {
  const candidatos = ['serviceAccount.json', 'firebase-key.json'];
  for (const f of candidatos) {
    const p = join(__dirname, f);
    if (existsSync(p)) return { path: p, json: JSON.parse(readFileSync(p, 'utf8')) };
  }
  throw new Error(
    'No se encontró serviceAccount.json ni firebase-key.json en la carpeta del script.\n' +
    'Genera una clave nueva en Firebase Console → cuaderno-digital-fp → Cuentas de servicio.'
  );
}

// Reparte el rango de una evaluación en bandas contiguas proporcionales a las sesiones.
function repartirBandas(rangoISO, uds) {
  const ini = new Date(rangoISO[0]);
  const fin = new Date(rangoISO[1]);
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

function detectarClavesRA(moduloEjemplo) {
  const def = { ra: 'resultadosAprendizaje', codigo: 'codigo', descripcion: 'descripcion',
    peso: 'peso', criterios: 'criteriosEvaluacion' };
  if (!moduloEjemplo) return { ...def, ceCodigo: 'codigo', ceDescripcion: 'descripcion', cePeso: 'peso' };
  const raArr = moduloEjemplo.resultadosAprendizaje || moduloEjemplo.ras;
  if (!Array.isArray(raArr) || !raArr.length) return { ...def, ceCodigo: 'codigo', ceDescripcion: 'descripcion', cePeso: 'peso' };
  const ej = raArr[0];
  const k = Object.keys(ej);
  const find = (...alts) => alts.find(a => k.includes(a));
  const critKey = find('criteriosEvaluacion', 'criterios', 'ces', 'criteriosDeEvaluacion');
  return {
    ra: moduloEjemplo.resultadosAprendizaje ? 'resultadosAprendizaje' : 'ras',
    codigo: find('codigo', 'ra_codigo', 'code') || 'codigo',
    descripcion: find('descripcion', 'ra_descripcion', 'nombre', 'texto') || 'descripcion',
    peso: find('peso', 'ra_peso', 'ponderacion') || 'peso',
    criterios: critKey || 'criteriosEvaluacion',
    ceCodigo: 'codigo', ceDescripcion: 'descripcion', cePeso: 'peso',
  };
}

function construirRA(claves) {
  return RESULTADOS.map(ra => {
    const pesoCE = +(100 / ra.criterios.length).toFixed(2);
    return {
      [claves.codigo]: ra.codigo,
      [claves.descripcion]: ra.descripcion,
      [claves.peso]: ra.peso,
      [claves.criterios]: ra.criterios.map(([cod, desc]) => ({
        [claves.ceCodigo]: cod,
        [claves.ceDescripcion]: desc,
        [claves.cePeso]: pesoCE,
      })),
    };
  });
}

// Detecta si `evaluacion` se guarda como número o como etiqueta de texto.
function detectarFormatoEval(samples) {
  for (const s of samples) {
    if (s && s.evaluacion != null) {
      if (typeof s.evaluacion === 'number') return 'numero';
      if (typeof s.evaluacion === 'string') return 'etiqueta';
    }
  }
  return 'etiqueta'; // por defecto: etiqueta exacta (lo que filtra el selector)
}
// Primer nombre de campo presente en la plantilla, de una lista de alternativas.
function findKeyIn(tpl, alts) {
  if (!tpl) return null;
  const k = Object.keys(tpl);
  return alts.find(a => k.includes(a)) || null;
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.azul('  SEMBRADO DEL MÓDULO DASP (SMR · 2º · SM2)'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Proyecto:        cuaderno-digital-fp`);
  log(`  Clave:           ${sa.path}`);
  log(`  Modo:            ${COMMIT ? c.verde('COMMIT (escribe)') : c.ama('DRY-RUN (no escribe)')}`);
  log(`  Curso académico: ${CONFIG.curso}   Grupo: ${CONFIG.grupoNombre}\n`);

  // ── FASE 0: Sonda de esquema ──────────────────────────────────────
  log(c.azul('FASE 0 · Sonda de esquema'));
  const modConRA = (await db.collection('modulos')
    .where('resultadosAprendizaje', '!=', null).limit(1).get().catch(() => null));
  let moduloEjemplo = null;
  if (modConRA && !modConRA.empty) moduloEjemplo = modConRA.docs[0].data();
  else {
    const todos = await db.collection('modulos').limit(20).get();
    moduloEjemplo = todos.docs.map(d => d.data()).find(m =>
      Array.isArray(m.resultadosAprendizaje) && m.resultadosAprendizaje.length) || null;
  }
  const claves = detectarClavesRA(moduloEjemplo);
  log('  · Claves RA/CE detectadas: ' + c.gris(JSON.stringify(claves)));

  const evSnap = await db.collection('eventos_programacion').limit(1).get();
  const eventoTpl = evSnap.empty ? null : evSnap.docs[0].data();
  const tareaSnap = await db.collection('tareas').limit(1).get();
  const tareaTpl = tareaSnap.empty ? null : tareaSnap.docs[0].data();
  const examenSnap = await db.collection('examenes').limit(1).get();
  const examenTpl = examenSnap.empty ? null : examenSnap.docs[0].data();

  const fmtEval = detectarFormatoEval([eventoTpl, tareaTpl, examenTpl]);
  const etiquetaEval = n => fmtEval === 'numero' ? n : (CONFIG.etiquetasEval[n] || `${n}ª Evaluación`);

  // Nombres de campo detectados (con valores por defecto sensatos).
  const kTareaPuntos = findKeyIn(tareaTpl, ['puntuacionMaxima', 'maxPuntos', 'puntosMaximos', 'notaMaxima']) || 'puntuacionMaxima';
  const kTareaFecha  = findKeyIn(tareaTpl, ['fechaEntrega', 'fechaLimite', 'fecha']) || 'fechaEntrega';
  const kExamPuntos  = findKeyIn(examenTpl, ['puntuacionMaxima', 'maxPuntos', 'puntosMaximos', 'notaMaxima']) || 'puntuacionMaxima';
  const kExamFecha   = findKeyIn(examenTpl, ['fecha', 'fechaExamen', 'fechaInicio']) || 'fecha';
  const kExamMin     = findKeyIn(examenTpl, ['notaMinimaAprobado', 'notaMinima', 'minNota', 'notaMin', 'min']) || 'notaMinimaAprobado';
  const kExamDur     = findKeyIn(examenTpl, ['duracionMinutos', 'duracion']) || 'duracionMinutos';

  log('  · eventos_programacion: ' + (eventoTpl ? c.gris(Object.keys(eventoTpl).join(', ')) : c.ama('sin plantilla')));
  log('  · tareas:               ' + (tareaTpl ? c.gris(Object.keys(tareaTpl).join(', ')) : c.ama('sin plantilla')));
  log('  · examenes:             ' + (examenTpl ? c.gris(Object.keys(examenTpl).join(', ')) : c.ama('sin plantilla')));
  log('  · Formato evaluacion:   ' + c.gris(fmtEval) + '  →  ejemplo: ' + c.gris(JSON.stringify(etiquetaEval(1))));
  log('  · Campos elegidos:      ' + c.gris(`tarea[${kTareaPuntos}, ${kTareaFecha}]  examen[${kExamPuntos}, ${kExamFecha}, ${kExamMin}, ${kExamDur}]`));

  if (PROBE_ONLY) {
    log(c.verde('\n  --probe: solo diagnóstico. Nada que escribir.\n'));
    await admin.app().delete();
    return;
  }

  // Resolver centroId / profesorId desde un módulo de referencia si existe.
  const centroId = moduloEjemplo?.centroId || CONFIG.centroIdFallback;
  let profesorId = CONFIG.profesorId || moduloEjemplo?.profesorId || null;

  // ── FASE 1: Ciclo SMR ─────────────────────────────────────────────
  log(c.azul('\nFASE 1 · Ciclo ' + CONFIG.cicloAbreviatura));
  let cicloId = null, cicloRef = null;
  const cicloQ = await db.collection('ciclos').where('abreviatura', '==', CONFIG.cicloAbreviatura).limit(1).get();
  if (!cicloQ.empty) {
    cicloRef = cicloQ.docs[0].ref; cicloId = cicloRef.id;
    if (!profesorId) profesorId = cicloQ.docs[0].data().profesorId || null;
    log('  · Reutilizando ciclo existente: ' + c.gris(cicloId));
  } else {
    cicloRef = db.collection('ciclos').doc(); cicloId = cicloRef.id;
    log('  · ' + c.verde('CREAR') + ' ciclo nuevo: ' + c.gris(cicloId));
  }
  if (!profesorId) profesorId = '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';
  const profesoresIds = [profesorId];
  log('  · profesorId: ' + c.gris(profesorId) + '  ·  centroId: ' + c.gris(centroId));

  // ── FASE 2: Grupo 2º (SM2) ────────────────────────────────────────
  log(c.azul('\nFASE 2 · Grupo ' + CONFIG.grupoNombre));
  let grupoId = null, grupoRef = null;
  const grupoQ = await db.collection('grupos')
    .where('nombre', '==', CONFIG.grupoNombre).where('cicloId', '==', cicloId).limit(1).get();
  if (!grupoQ.empty) {
    grupoRef = grupoQ.docs[0].ref; grupoId = grupoRef.id;
    log('  · Reutilizando grupo existente: ' + c.gris(grupoId));
  } else {
    grupoRef = db.collection('grupos').doc(); grupoId = grupoRef.id;
    log('  · ' + c.verde('CREAR') + ' grupo nuevo: ' + c.gris(grupoId));
  }

  // ── FASE 3: Módulo DASP ───────────────────────────────────────────
  log(c.azul('\nFASE 3 · Módulo ' + CONFIG.moduloAbreviatura));
  let moduloId = null, moduloRef = null, moduloPrevio = null;
  const modQ = await db.collection('modulos')
    .where('abreviatura', '==', CONFIG.moduloAbreviatura).where('cicloId', '==', cicloId).limit(1).get();
  if (!modQ.empty) {
    moduloRef = modQ.docs[0].ref; moduloId = moduloRef.id; moduloPrevio = modQ.docs[0].data();
    log('  · Módulo existente → se ACTUALIZA: ' + c.gris(moduloId));
  } else {
    moduloRef = db.collection('modulos').doc(); moduloId = moduloRef.id;
    log('  · ' + c.verde('CREAR') + ' módulo nuevo: ' + c.gris(moduloId));
  }
  const rasConstruidos = construirRA(claves);
  log(`  · ${rasConstruidos.length} RA · ${rasConstruidos.reduce((s, r) => s + r[claves.criterios].length, 0)} CE`);

  // ── FASE 4: Programación (bandas de UD por evaluación) ────────────
  log(c.azul('\nFASE 4 · Programación (5 UD · 2 evaluaciones)'));
  const base = {
    moduloId, grupoId, profesorId, profesoresIds,
    cursoAcademico: CONFIG.curso,
  };

  const bandasPorUd = {};   // udNumero -> { fechaInicio, fechaFin }
  const eventos = [];
  for (const e of [1, 2]) {
    const uds = UNIDADES.filter(u => u.evaluacion === e);
    const bandas = repartirBandas(CONFIG.periodos[e], uds);
    for (const b of bandas) {
      bandasPorUd[b.n] = { fechaInicio: b.fechaInicio, fechaFin: b.fechaFin };
      eventos.push({
        ...base,
        evaluacion: etiquetaEval(e),
        tipo: 'tema',
        titulo: `UD${b.n}. ${b.titulo}`,
        descripcion: b.contenidos.join('\n'),
        fechaInicio: ts(b.fechaInicio),
        fechaFin: ts(b.fechaFin),
        color: CONFIG.colores[(b.n - 1) % CONFIG.colores.length],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        unidadId: `dasp-ud${b.n}`, udNumero: b.n, raAsociado: b.ra, origen: 'seed-dasp',
      });
      log(`  · UD${b.n} (${b.ra}, ${etiquetaEval(e)}) ` +
        c.gris(`${b.fechaInicio.toISOString().slice(0, 10)} → ${b.fechaFin.toISOString().slice(0, 10)}`));
    }
  }

  // ── FASE 5: Tareas/actividades y exámenes ─────────────────────────
  log(c.azul('\nFASE 5 · Tareas y exámenes'));

  // Fechas: cada actividad vence al final de la banda de su UD (o al final de
  // la evaluación si lleva fin:true). Cada examen, al final de su evaluación.
  const finEval = e => new Date(CONFIG.periodos[e][1]);
  const a23 = d => { const x = new Date(d); x.setHours(23, 59, 0, 0); return x; };
  const a09 = d => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };

  const tareas = [];
  const eventosActExam = [];
  for (const act of ACTIVIDADES) {
    const fEntrega = a23(act.fin ? finEval(act.evaluacion) : (bandasPorUd[act.ud]?.fechaFin || finEval(act.evaluacion)));
    tareas.push({
      ...base,
      evaluacion: etiquetaEval(act.evaluacion),
      titulo: act.titulo,
      descripcion: act.descripcion,
      [kTareaPuntos]: 10,
      porcentajeNotaFinal: 0,
      resultadosAprendizajeIds: [act.ra],
      criteriosEvaluacionIds: [],
      fechaPublicacion: ts(bandasPorUd[act.ud]?.fechaInicio || finEval(act.evaluacion)),
      [kTareaFecha]: ts(fEntrega),
      publicada: true,
      archivada: false,
      esGrupal: false,
      requiereArchivo: false,
      permiteEntregaTardia: true,
      penalizacionRetraso: 0,
      adjuntos: [],
      entregas: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      origen: 'seed-dasp',
    });
    if (CONFIG.crearEventosActExam) {
      eventosActExam.push({
        ...base, evaluacion: etiquetaEval(act.evaluacion), tipo: 'actividad',
        titulo: act.titulo, descripcion: act.descripcion,
        fechaInicio: ts(fEntrega), fechaFin: ts(fEntrega),
        color: '#2E7D32', raAsociado: act.ra,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(), origen: 'seed-dasp',
      });
    }
    log(`  · Tarea ${act.titulo.split('.')[0]} (${act.ra}) entrega ` + c.gris(fEntrega.toISOString().slice(0, 10)));
  }

  const examenes = [];
  for (const ex of EXAMENES) {
    const fExamen = a09(finEval(ex.evaluacion));
    examenes.push({
      ...base,
      evaluacion: etiquetaEval(ex.evaluacion),
      titulo: ex.titulo,
      descripcion: ex.descripcion,
      tipo: ex.tipo || 'parcial',          // 'parcial' | 'final' (etiqueta de la tarjeta)
      [kExamPuntos]: 10,
      [kExamMin]: NOTA_MINIMA,             // notaMinimaAprobado → arregla el "Mín: {{min}}"
      porcentajeNotaFinal: 0,
      tienePonderacion: false,
      [kExamDur]: ex.duracion || 90,       // duracionMinutos
      [kExamFecha]: ts(fExamen),
      horaInicio: '09:00',
      horaFin: ex.duracion === 120 ? '11:00' : '10:30',
      aula: '',
      publicado: true,
      resultadosPublicados: false,
      permiteRecuperacion: ex.tipo === 'final',
      resultadosAprendizajeIds: ex.ras,
      criteriosEvaluacionIds: [],
      secciones: [],
      calificaciones: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      origen: 'seed-dasp',
    });
    if (CONFIG.crearEventosActExam) {
      eventosActExam.push({
        ...base, evaluacion: etiquetaEval(ex.evaluacion), tipo: 'examen',
        titulo: ex.titulo, descripcion: ex.descripcion,
        fechaInicio: ts(fExamen), fechaFin: ts(fExamen),
        color: '#C62828', raAsociado: ex.ras.join('+'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(), origen: 'seed-dasp',
      });
    }
    log(`  · Examen ${ex.tipo || 'parcial'} ${etiquetaEval(ex.evaluacion)} (${ex.ras.join(', ')}) ` + c.gris(fExamen.toISOString().slice(0, 10)));
  }

  const todosEventos = [...eventos, ...eventosActExam];

  // ── Limpieza idempotente: borrar lo creado por este script antes ──
  async function previos(col) {
    return db.collection(col)
      .where('moduloId', '==', moduloId).where('origen', '==', 'seed-dasp')
      .get().catch(() => ({ docs: [] }));
  }
  const prevEv = await previos('eventos_programacion');
  const prevTa = await previos('tareas');
  const prevEx = await previos('examenes');
  log(c.azul('\nReemplazo idempotente (seed-dasp previo)'));
  log(`  · eventos_programacion: ${prevEv.docs.length}   tareas: ${prevTa.docs.length}   examenes: ${prevEx.docs.length}`);

  // ── BACKUP ────────────────────────────────────────────────────────
  const backup = {
    generado: new Date().toISOString(),
    moduloPrevio: moduloPrevio || null,
    eventosPrevios: prevEv.docs.map(d => ({ id: d.id, ...d.data() })),
    tareasPrevias: prevTa.docs.map(d => ({ id: d.id, ...d.data() })),
    examenesPrevios: prevEx.docs.map(d => ({ id: d.id, ...d.data() })),
  };
  if (moduloPrevio || backup.eventosPrevios.length || backup.tareasPrevias.length || backup.examenesPrevios.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bpath = join(__dirname, `backup-dasp-${stamp}.json`);
    if (COMMIT) writeFileSync(bpath, JSON.stringify(backup, null, 2));
    log('  · Backup ' + (COMMIT ? c.verde('guardado') : c.ama('(se guardaría)')) + ': ' + c.gris(bpath));
  }

  // ── RESUMEN ───────────────────────────────────────────────────────
  log(c.azul('\nResumen a crear'));
  log(`  · eventos_programacion: ${todosEventos.length}  (temas ${eventos.length} + act/exam ${eventosActExam.length})`);
  log(`  · tareas:               ${tareas.length}`);
  log(`  · examenes:             ${examenes.length}`);

  if (!COMMIT) {
    log(c.ama('\n────────────────────────────────────────────'));
    log(c.ama('  DRY-RUN: no se ha escrito nada en Firestore.'));
    log(c.ama('  Revisa los campos detectados en FASE 0 y repite con --commit.'));
    log(c.ama('────────────────────────────────────────────\n'));
    await admin.app().delete();
    return;
  }

  // ── ESCRITURA ─────────────────────────────────────────────────────
  const batch = db.batch();

  if (cicloQ.empty) {
    batch.set(cicloRef, { nombre: CONFIG.cicloNombre, abreviatura: CONFIG.cicloAbreviatura, grado: 'medio', centroId, profesorId });
  }
  if (grupoQ.empty) {
    batch.set(grupoRef, { nombre: CONFIG.grupoNombre, curso: CONFIG.grupoCurso, cursoAcademico: CONFIG.curso, cicloId, centroId, tutorId: profesorId, alumnosIds: [] });
  }
  const moduloDoc = {
    nombre: CONFIG.moduloNombre, abreviatura: CONFIG.moduloAbreviatura, cicloId, centroId, profesorId,
    horasSemanales: CONFIG.horasSemanales, horasTotales: CONFIG.horasTotales, cursoAcademico: CONFIG.curso,
    [claves.ra]: rasConstruidos,
  };
  if (moduloPrevio) batch.set(moduloRef, moduloDoc, { merge: true });
  else batch.set(moduloRef, moduloDoc);

  for (const d of prevEv.docs) batch.delete(d.ref);
  for (const d of prevTa.docs) batch.delete(d.ref);
  for (const d of prevEx.docs) batch.delete(d.ref);
  for (const ev of todosEventos) batch.set(db.collection('eventos_programacion').doc(), ev);
  for (const t of tareas) batch.set(db.collection('tareas').doc(), t);
  for (const x of examenes) batch.set(db.collection('examenes').doc(), x);

  await batch.commit();

  log(c.verde('\n────────────────────────────────────────────'));
  log(c.verde('  ✅ HECHO'));
  log(`  · Ciclo  ${CONFIG.cicloAbreviatura}: ${cicloId}`);
  log(`  · Grupo  ${CONFIG.grupoNombre}: ${grupoId}`);
  log(`  · Módulo ${CONFIG.moduloAbreviatura}: ${moduloId}  (${rasConstruidos.length} RA)`);
  log(`  · Programación: ${todosEventos.length} eventos · Tareas: ${tareas.length} · Exámenes: ${examenes.length}`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Abre Programación / Tareas / Exámenes con DASP · SM2 · 2026-2027.\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
