// ============================================================
//  crear-programacion-proy.mjs   (DAW y SMR · autocontenido)
//  Crea la programación/temporalización del módulo de Proyecto (PROY) en
//  'eventos_programacion'. Sin examen: la defensa/presentación es 'actividad'.
//
//  Sirve para los dos ciclos según --ciclo:
//    --ciclo daw   → ciclo DAW (Desarrollo de Aplicaciones Web), grupo 2AW3
//    --ciclo smr   → ciclo SMR (Grado Medio, Sist. Microinf. y Redes), grupo SM2
//
//  Uso:
//    node scripts/crear-programacion-proy.mjs --ciclo daw            (simulación)
//    node scripts/crear-programacion-proy.mjs --ciclo daw --apply    (escribe)
//    node scripts/crear-programacion-proy.mjs --ciclo smr --apply --reset
//        (borra antes los eventos previos de PROY de ese ciclo y los recrea)
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ───────────────────────── CONFIG GENERAL ─────────────────────────
const CURSO_ACADEMICO = '2026-2027';   // curso académico del cuaderno PROY

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');

function getArg(name, def) {
  const i = process.argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const a = process.argv[i];
  if (a.includes('=')) return a.split('=')[1];
  const nxt = process.argv[i + 1];
  return nxt && !nxt.startsWith('--') ? nxt : def;
}
const CICLO = (getArg('ciclo', 'daw') || 'daw').toLowerCase();

// Color por tipo (igual que la leyenda de Programación). Sin examen.
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };

// Año natural de cada fecha según el curso académico (ago-dic → Y1; ene-jul → Y2).
const [Y1, Y2] = CURSO_ACADEMICO.split('-').map(Number);
function fechaCurso(mmdd) {
  const [mm, dd] = mmdd.split('-').map(Number);
  return new Date(mm >= 8 ? Y1 : Y2, mm - 1, dd);
}

// ─────────────── DEFINICIÓN POR CICLO ───────────────
const CICLOS = {
  daw: {
    etiqueta: 'DAW',
    moduloId: 'D78x947gcFQnmcr66bz5',   // PROY - Proyecto Intermodular DAW
    PROGRAMACION: [
      // ===== 2ª EVALUACIÓN (20 feb – ~17 jun): desarrollo completo del proyecto =====
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Presentación del módulo y normativa del proyecto',
        descripcion: 'Objetivos, criterios de evaluación, calendario de hitos y normativa de defensa del proyecto intermodular.', ini: '02-20', fin: '02-27' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Búsqueda y propuesta de ideas',
        descripcion: 'Lluvia de ideas, análisis de viabilidad técnica y selección del tema del proyecto.', ini: '03-02', fin: '03-13' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Análisis y especificación de requisitos',
        descripcion: 'Requisitos funcionales y no funcionales, casos de uso y alcance del proyecto.', ini: '03-16', fin: '03-27' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Entrega del anteproyecto',
        descripcion: 'Documento de anteproyecto: descripción, objetivos, tecnologías propuestas y planificación inicial.', ini: '03-30', fin: '04-10' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Diseño de la arquitectura y del modelo de datos',
        descripcion: 'Arquitectura de la solución, diseño de la base de datos y diagramas (clases, despliegue).', ini: '04-13', fin: '04-24' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Diseño de la interfaz y experiencia de usuario',
        descripcion: 'Wireframes, prototipos y guía de estilo de la aplicación.', ini: '04-27', fin: '05-08' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Desarrollo del núcleo funcional (iteración 1)',
        descripcion: 'Implementación de las funcionalidades principales y primera demo interna.', ini: '05-11', fin: '05-29' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Desarrollo final y pruebas (iteración 2)',
        descripcion: 'Finalización de funcionalidades, pruebas de integración y corrección de errores.', ini: '06-01', fin: '06-12' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Documentación técnica y memoria del proyecto',
        descripcion: 'Redacción de la memoria, manual de usuario y manual técnico/despliegue.', ini: '06-08', fin: '06-17' },
      // ===== 2ª EVALUACIÓN FINAL (21–25 jun): cierre y defensa =====
      { tipo: 'actividad', evaluacion: '2ª Evaluación Final', titulo: 'Entrega de la memoria final',
        descripcion: 'Entrega del proyecto completo: código, memoria y material de presentación.', ini: '06-22', fin: '06-23' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación Final', titulo: 'Presentación y defensa del proyecto',
        descripcion: 'Exposición y defensa oral del proyecto intermodular ante el equipo docente.', ini: '06-24', fin: '06-25' },
      // ===== 1ª EVALUACIÓN FINAL (convocatoria ordinaria): copia del cierre =====
      { tipo: 'actividad', evaluacion: '1ª Evaluación Final', titulo: 'Entrega de la memoria final',
        descripcion: 'Entrega del proyecto completo: código, memoria y material de presentación.', ini: '06-01', fin: '06-20' },
      { tipo: 'actividad', evaluacion: '1ª Evaluación Final', titulo: 'Presentación y defensa del proyecto',
        descripcion: 'Exposición y defensa oral del proyecto intermodular ante el equipo docente.', ini: '06-03', fin: '06-04' },
    ],
  },

  smr: {
    etiqueta: 'SMR',
    moduloId: 'qjhDxHpiyGQcoTWHyNXJ',   // PROI - Proyecto Intermodular SM2
    PROGRAMACION: [
      // ===== 2ª EVALUACIÓN (20 feb – ~17 jun): desarrollo completo del proyecto =====
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Presentación del módulo y normativa del proyecto',
        descripcion: 'Objetivos, criterios de evaluación, calendario de hitos y normativa de presentación del proyecto.', ini: '02-20', fin: '02-27' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Propuesta del proyecto',
        descripcion: 'Selección del proyecto (montaje, red o servicio), problema que resuelve y objetivos.', ini: '03-02', fin: '03-13' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Análisis de necesidades y requisitos del sistema',
        descripcion: 'Estudio de necesidades del cliente/escenario, requisitos del sistema y alcance del proyecto.', ini: '03-16', fin: '03-27' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Entrega del anteproyecto',
        descripcion: 'Documento de anteproyecto: descripción, objetivos, recursos previstos y planificación inicial.', ini: '03-30', fin: '04-10' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Diseño de la solución: equipos, red y direccionamiento',
        descripcion: 'Topología de red, esquema de equipos, direccionamiento IP, servicios y diagramas de la solución.', ini: '04-13', fin: '04-24' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Selección de hardware/software y presupuesto',
        descripcion: 'Elección de equipos, sistemas operativos y software; presupuesto y justificación técnica.', ini: '04-27', fin: '05-08' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Montaje e instalación (iteración 1)',
        descripcion: 'Montaje del equipamiento, instalación de SO y configuración básica de red y servicios.', ini: '05-11', fin: '05-29' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación', titulo: 'Configuración y pruebas finales',
        descripcion: 'Configuración definitiva de servicios y seguridad, pruebas de funcionamiento y corrección de fallos.', ini: '06-01', fin: '06-12' },
      { tipo: 'tema', evaluacion: '2ª Evaluación', titulo: 'Documentación: memoria y manuales',
        descripcion: 'Redacción de la memoria del proyecto, manual de usuario y manual técnico/de instalación.', ini: '06-08', fin: '06-17' },
      // ===== 2ª EVALUACIÓN FINAL (21–25 jun): cierre y presentación =====
      { tipo: 'actividad', evaluacion: '2ª Evaluación Final', titulo: 'Entrega de la memoria final',
        descripcion: 'Entrega del proyecto completo: configuración, memoria y material de presentación.', ini: '06-22', fin: '06-23' },
      { tipo: 'actividad', evaluacion: '2ª Evaluación Final', titulo: 'Presentación del proyecto',
        descripcion: 'Exposición del proyecto ante el equipo docente (sin prueba de examen).', ini: '06-24', fin: '06-25' },
      // ===== 1ª EVALUACIÓN FINAL (convocatoria ordinaria): copia del cierre =====
      { tipo: 'actividad', evaluacion: '1ª Evaluación Final', titulo: 'Entrega de la memoria final',
        descripcion: 'Entrega del proyecto completo: configuración, memoria y material de presentación.', ini: '06-01', fin: '06-20' },
      { tipo: 'actividad', evaluacion: '1ª Evaluación Final', titulo: 'Presentación del proyecto',
        descripcion: 'Exposición del proyecto ante el equipo docente (sin prueba de examen).', ini: '06-03', fin: '06-04' },
    ],
  },
};

// ───────────────────────── FIREBASE ─────────────────────────
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const ts = d => admin.firestore.Timestamp.fromDate(d instanceof Date ? d : new Date(d));

async function resolverModuloPorId(id) {
  const d = await db.collection('modulos').doc(id).get();
  if (!d.exists) throw new Error(`No existe el módulo con id "${id}".`);
  return { id: d.id, ...d.data() };
}
// El cuaderno = par (módulo, grupo) donde grupo.modulosIds incluye el módulo.
async function resolverGrupoDeModulo(moduloId, curso) {
  const q = await db.collection('grupos').where('modulosIds', 'array-contains', moduloId).get();
  if (q.empty) throw new Error(`Ningún grupo enlaza (modulosIds) con el módulo ${moduloId}.`);
  let docs = q.docs;
  const f = docs.filter(d => d.data().cursoAcademico === curso);
  if (f.length) docs = f;
  else console.log(`  ⚠ Ningún grupo enlazado tiene cursoAcademico=${curso}; uso el primero (${docs[0].id}).`);
  if (docs.length > 1) console.log(`  ⚠ Hay ${docs.length} grupos enlazados; uso ${docs[0].id}.`);
  return { id: docs[0].id, ...docs[0].data() };
}

async function main() {
  const cfg = CICLOS[CICLO];
  if (!cfg) {
    console.error(`--ciclo desconocido: "${CICLO}". Usa: ${Object.keys(CICLOS).join(' | ')}`);
    process.exit(1);
  }
  console.log(`\n=== Programación PROY · ${cfg.etiqueta} · ${CURSO_ACADEMICO} · ${APPLY ? 'APPLY' : 'SIMULACIÓN'} ===`);

  const modulo = await resolverModuloPorId(cfg.moduloId);
  const grupo = await resolverGrupoDeModulo(cfg.moduloId, CURSO_ACADEMICO);

  console.log(`Ciclo:  ${cfg.etiqueta} (${modulo.cicloId})`);
  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`Eventos a crear: ${cfg.PROGRAMACION.length}`);
  console.log('-----------------------------------------------------------');

  if (RESET) {
    const previos = await db.collection('eventos_programacion')
      .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
    console.log(`[RESET] Eventos previos de PROY/${cfg.etiqueta}: ${previos.size}`);
    if (APPLY && !previos.empty) {
      const b = db.batch();
      previos.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      console.log(`[RESET] Eliminados ${previos.size} eventos previos.`);
    }
  }

  cfg.PROGRAMACION.forEach(e => {
    const fi = fechaCurso(e.ini), ff = fechaCurso(e.fin);
    console.log(`  [${e.tipo.padEnd(9)}] ${e.evaluacion.padEnd(20)} ${fi.toISOString().slice(0, 10)} → ${ff.toISOString().slice(0, 10)}  ${e.titulo}`);
  });

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para crear los eventos.');
    await admin.app().delete();
    return;
  }

  const batch = db.batch();
  const col = db.collection('eventos_programacion');
  const now = new Date();
  for (const e of cfg.PROGRAMACION) {
    batch.set(col.doc(), {
      moduloId: modulo.id,
      grupoId: grupo.id,
      cursoAcademico: CURSO_ACADEMICO,
      evaluacion: e.evaluacion,
      tipo: e.tipo,
      titulo: e.titulo,
      descripcion: e.descripcion,
      fechaInicio: ts(fechaCurso(e.ini)),
      fechaFin: ts(fechaCurso(e.fin)),
      color: COLOR[e.tipo],
      resultadosAprendizajeIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`\n✓ Creados ${cfg.PROGRAMACION.length} eventos de programación para PROY/${cfg.etiqueta}.`);
  await admin.app().delete();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
