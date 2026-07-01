#!/usr/bin/env node
/**
 * crear-dasp-smr.mjs
 * --------------------------------------------------------------------------
 * Crea el cuaderno del módulo DASP (Digitalización Aplicada a los Sectores
 * Productivos) del ciclo SMR de Grado Medio, según la programación oficial
 * del curso 2024-2025 (IES Guadalpeña), dentro de "Cuaderno Digital FP Euskadi".
 *
 * Lo que hace, en 5 fases idempotentes:
 *   0. Sonda de esquema  → lee un módulo y un evento existentes para clonar la
 *                          forma real de los campos (RA/CE y eventos_programacion).
 *   1. Ciclo SMR         → lo reutiliza si existe; si no, lo crea.
 *   2. Grupo 1º (SM1)    → lo reutiliza si existe; si no, lo crea.
 *   3. Módulo DASP       → crea o actualiza con los 5 RA y sus CE ponderados.
 *   4. Programación      → 5 bandas de UD repartidas por trimestre (32 sesiones).
 *
 * Convenciones del proyecto:
 *   - serviceAccount.json en la carpeta scripts/ (la del proyecto raíz está revocada).
 *   - Proyecto Firebase: cuaderno-digital-fp.
 *   - Dry-run por defecto. Escribe SOLO con --commit (o --apply).
 *   - Genera un backup JSON antes de tocar nada que ya exista.
 *   - Todo lo creado por el script se etiqueta con origen:'seed-dasp' para poder
 *     reejecutar sin duplicar (borra primero lo etiquetado, luego recrea).
 *
 * Uso:
 *   cp ~/Downloads/crear-dasp-smr.mjs scripts/
 *   node scripts/crear-dasp-smr.mjs            # simula, no escribe
 *   node scripts/crear-dasp-smr.mjs --commit   # aplica los cambios
 *   node scripts/crear-dasp-smr.mjs --probe    # solo muestra el esquema detectado
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

  curso: '2025-2026',                 // curso académico del cuaderno

  cicloAbreviatura: 'SMR',
  cicloNombre: 'Sistemas Microinformáticos y Redes',

  grupoNombre: 'SM1',                 // grupo de 1º de Grado Medio
  grupoCurso: 'Primer Curso',

  moduloAbreviatura: 'DASP',
  moduloNombre: 'Digitalización aplicada a los sectores productivos',
  horasSemanales: 1,
  horasTotales: 32,

  // Si lo dejas null, se intenta detectar del ciclo SMR; si no, usa el admin.
  profesorId: '21m6mMuCAieZ7ZpcR2xfm9kH9yc2',

  // Límites ISO de cada trimestre para repartir las UD (ajústalos a tu calendario).
  trimestres: {
    1: ['2025-09-15', '2025-12-19'],
    2: ['2026-01-08', '2026-03-27'],
    3: ['2026-04-07', '2026-06-19'],
  },

  // Paleta de bandas de UD (estilo PALETA_TEMA de la programación visual).
  colores: ['#1565C0', '#2E7D32', '#EF6C00', '#6A1B9A', '#00838F'],
};

// ──────────────── DATOS DE LA PROGRAMACIÓN (DASP) ─────────────────
// Pesos: cada RA vale 20 % de la nota final del módulo. Dentro de cada RA,
// los CE reparten el 100 % a partes iguales (6 CE → 16,67 %; 5 → 20 %; 8 → 12,50 %).

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

// Unidades didácticas → RA asociado, trimestre, nº de sesiones y contenidos.
const UNIDADES = [
  {
    n: 1, titulo: 'Digitalización y sostenibilidad', ra: 'RA1', trimestre: 1, sesiones: 7,
    contenidos: [
      '1.1 Economías lineal y circular. Modelos de empresas basados en ambas.',
      '1.2 Responsabilidad social: modelos de empresas y afectación del medioambiente.',
      '1.3 Importancia del reciclaje en los modelos económicos.',
      '1.4 Procesos reales basados en la EL y en la EC.',
      '1.5 Comparativa de modelos según su impacto medioambiental y los ODS.',
    ],
  },
  {
    n: 2, titulo: 'La cuarta revolución industrial', ra: 'RA2', trimestre: 1, sesiones: 6,
    contenidos: [
      '2.1 Sistemas ciberfísicos. Relación con la evolución industrial.',
      '2.2 Sistemas automatizados. Cambios provocados por la cuarta revolución.',
      '2.3 Interrelación entre el mundo físico y el virtual.',
      '2.4 Ventajas de la migración a entornos 4.0.',
      '2.5 Ventajas de la 4.ª revolución industrial para clientes y empresas.',
    ],
  },
  {
    n: 3, titulo: 'Sistemas basados en la nube', ra: 'RA3', trimestre: 2, sesiones: 6,
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
    n: 4, titulo: 'Características de los sistemas de producción', ra: 'RA4', trimestre: 2, sesiones: 7,
    contenidos: [
      '4.1 Tecnologías habilitadoras (TDH) actuales. Características y aplicaciones.',
      '4.2 Relación entre TDH y productividad.',
      '4.3 Implantación de TDH: reducción de costes y mejora de la competitividad.',
      '4.4 Sistemas digitalizados reales. Ejemplos.',
      '4.5 Tecnología disruptiva. Ejemplos.',
      '4.6 Sistemas de almacenamiento de datos.',
    ],
  },
  {
    n: 5, titulo: 'Plan de transformación digital de una empresa', ra: 'RA5', trimestre: 3, sesiones: 6,
    contenidos: [
      '5.1 Configuración de una empresa clásica. Digitalización de la empresa o sus unidades.',
      '5.2 TDH implicadas en la digitalización de las etapas. Relación entre etapas.',
      '5.3 Configuración de la empresa digitalizada.',
      '5.4 Plan de transformación. Recursos empleados.',
    ],
  },
];

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

// Reparte el rango de un trimestre en bandas contiguas proporcionales a las sesiones.
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

// Detecta los nombres reales de campo de un RA/CE a partir de un módulo existente.
function detectarClavesRA(moduloEjemplo) {
  const def = { ra: 'resultadosAprendizaje', codigo: 'codigo', descripcion: 'descripcion',
    peso: 'peso', criterios: 'criteriosEvaluacion' };
  if (!moduloEjemplo) return def;
  const raArr = moduloEjemplo.resultadosAprendizaje || moduloEjemplo.ras;
  if (!Array.isArray(raArr) || !raArr.length) return def;
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
    const obj = {
      [claves.codigo]: ra.codigo,
      [claves.descripcion]: ra.descripcion,
      [claves.peso]: ra.peso,
      [claves.criterios]: ra.criterios.map(([cod, desc]) => ({
        [claves.ceCodigo]: cod,
        [claves.ceDescripcion]: desc,
        [claves.cePeso]: pesoCE,
      })),
    };
    return obj;
  });
}

// ───────────────────────────── EJECUCIÓN ─────────────────────────────
async function run() {
  const sa = cargarServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa.json) });
  const db = admin.firestore();

  log(c.azul('\n══════════════════════════════════════════════════════════'));
  log(c.azul('  SEMBRADO DEL MÓDULO DASP (SMR · Grado Medio)'));
  log(c.azul('══════════════════════════════════════════════════════════'));
  log(`  Proyecto:        cuaderno-digital-fp`);
  log(`  Clave:           ${sa.path}`);
  log(`  Modo:            ${COMMIT ? c.verde('COMMIT (escribe)') : c.ama('DRY-RUN (no escribe)')}`);
  log(`  Curso académico: ${CONFIG.curso}\n`);

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
  log('  · Plantilla eventos_programacion: ' +
    (eventoTpl ? c.gris('campos → ' + Object.keys(eventoTpl).join(', ')) : c.ama('no hay eventos previos; se usará forma por defecto')));

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
  log('  · profesorId: ' + c.gris(profesorId) + '  ·  centroId: ' + c.gris(centroId));

  // ── FASE 2: Grupo 1º (SM1) ────────────────────────────────────────
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

  // ── FASE 4: Programación (bandas de UD) ───────────────────────────
  log(c.azul('\nFASE 4 · Programación (5 UD · 32 sesiones)'));
  const porTrimestre = { 1: [], 2: [], 3: [] };
  for (const u of UNIDADES) porTrimestre[u.trimestre].push(u);
  let eventos = [];
  for (const t of [1, 2, 3]) {
    const bandas = repartirBandas(CONFIG.trimestres[t], porTrimestre[t]);
    for (const b of bandas) {
      const base = eventoTpl ? { ...eventoTpl } : {};
      // limpiamos cualquier id/fecha heredados de la plantilla
      delete base.id;
      eventos.push({
        ...base,
        tipo: 'tema',
        titulo: `UD${b.n}. ${b.titulo}`,
        descripcion: b.contenidos.join('\n'),
        contenidos: b.contenidos,
        unidadId: `dasp-ud${b.n}`,
        udNumero: b.n,
        raAsociado: b.ra,
        trimestre: t,
        order: 1,
        color: CONFIG.colores[(b.n - 1) % CONFIG.colores.length],
        fechaInicio: ts(b.fechaInicio),
        fechaFin: ts(b.fechaFin),
        moduloId, grupoId, cicloId, centroId,
        origen: 'seed-dasp',
      });
      log(`  · UD${b.n} (${b.ra}, T${t}) ` +
        c.gris(`${b.fechaInicio.toISOString().slice(0, 10)} → ${b.fechaFin.toISOString().slice(0, 10)}`));
    }
  }

  // Eventos previos creados por este script (para reemplazo limpio).
  const previosSeed = await db.collection('eventos_programacion')
    .where('moduloId', '==', moduloId).where('origen', '==', 'seed-dasp').get().catch(() => ({ docs: [] }));
  log(`  · Eventos seed-dasp previos a reemplazar: ${previosSeed.docs.length}`);

  // ── BACKUP de lo que ya existe ────────────────────────────────────
  const backup = {
    generado: new Date().toISOString(),
    moduloPrevio: moduloPrevio || null,
    eventosPrevios: previosSeed.docs.map(d => ({ id: d.id, ...d.data() })),
  };
  if (moduloPrevio || backup.eventosPrevios.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bpath = join(__dirname, `backup-dasp-${stamp}.json`);
    if (COMMIT) writeFileSync(bpath, JSON.stringify(backup, null, 2));
    log('  · Backup ' + (COMMIT ? c.verde('guardado') : c.ama('(se guardaría)')) + ': ' + c.gris(bpath));
  }

  // ── ESCRITURA ─────────────────────────────────────────────────────
  if (!COMMIT) {
    log(c.ama('\n────────────────────────────────────────────'));
    log(c.ama('  DRY-RUN: no se ha escrito nada en Firestore.'));
    log(c.ama('  Repite con --commit para aplicar los cambios.'));
    log(c.ama('────────────────────────────────────────────\n'));
    await admin.app().delete();
    return;
  }

  const batch = db.batch();

  if (cicloQ.empty) {
    batch.set(cicloRef, {
      nombre: CONFIG.cicloNombre, abreviatura: CONFIG.cicloAbreviatura,
      grado: 'medio', centroId, profesorId,
    });
  }

  if (grupoQ.empty) {
    batch.set(grupoRef, {
      nombre: CONFIG.grupoNombre, curso: CONFIG.grupoCurso, cursoAcademico: CONFIG.curso,
      cicloId, centroId, tutorId: profesorId, alumnosIds: [],
    });
  }

  const moduloDoc = {
    nombre: CONFIG.moduloNombre, abreviatura: CONFIG.moduloAbreviatura,
    cicloId, centroId, profesorId,
    horasSemanales: CONFIG.horasSemanales, horasTotales: CONFIG.horasTotales,
    cursoAcademico: CONFIG.curso,
    [claves.ra]: rasConstruidos,
  };
  if (moduloPrevio) batch.set(moduloRef, moduloDoc, { merge: true });
  else batch.set(moduloRef, moduloDoc);

  for (const d of previosSeed.docs) batch.delete(d.ref);
  for (const ev of eventos) batch.set(db.collection('eventos_programacion').doc(), ev);

  await batch.commit();

  log(c.verde('\n────────────────────────────────────────────'));
  log(c.verde('  ✅ HECHO'));
  log(`  · Ciclo  ${CONFIG.cicloAbreviatura}: ${cicloId}`);
  log(`  · Grupo  ${CONFIG.grupoNombre}: ${grupoId}`);
  log(`  · Módulo ${CONFIG.moduloAbreviatura}: ${moduloId}  (${rasConstruidos.length} RA)`);
  log(`  · Programación: ${eventos.length} bandas de UD`);
  log(c.verde('────────────────────────────────────────────'));
  log('  Recarga el Dashboard para ver el cuaderno de DASP.\n');

  await admin.app().delete();
}

run().catch(e => { console.error(c.rojo('\n❌ Error: ' + (e.message || e))); process.exit(1); });
