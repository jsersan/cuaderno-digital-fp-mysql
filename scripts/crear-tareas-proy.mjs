// ============================================================
//  crear-tareas-proy.mjs   (DAW y SMR · autocontenido)
//  Da de alta las tareas/actividades del módulo de Proyecto (PROY) en la
//  colección 'tareas', alineadas con los hitos de la programación. Sin examen.
//
//  Según --ciclo:
//    --ciclo daw   → ciclo DAW, grupo 2AW3
//    --ciclo smr   → ciclo SMR (Grado Medio), grupo SM2
//
//  Uso:
//    node scripts/crear-tareas-proy.mjs --ciclo daw            (simulación)
//    node scripts/crear-tareas-proy.mjs --ciclo daw --apply    (escribe)
//    node scripts/crear-tareas-proy.mjs --ciclo smr --apply --reset
//        (borra antes las tareas previas de PROY de ese ciclo y las recrea)
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

const [Y1, Y2] = CURSO_ACADEMICO.split('-').map(Number);
function fechaCurso(mmdd) {
  const [mm, dd] = mmdd.split('-').map(Number);
  return new Date(mm >= 8 ? Y1 : Y2, mm - 1, dd);
}

// ─────────────── DEFINICIÓN POR CICLO (porcentajes suman 100 %) ───────────────
const CICLOS = {
  daw: {
    etiqueta: 'DAW',
    moduloId: 'D78x947gcFQnmcr66bz5',   // PROY - Proyecto Intermodular DAW
    TAREAS: [
      { titulo: 'Propuesta de proyecto', evaluacion: '2ª Evaluación', pub: '03-02', ent: '03-13', pct: 10,
        descripcion: 'Documento breve con la idea seleccionada, el problema que resuelve, los objetivos y las tecnologías previstas.' },
      { titulo: 'Anteproyecto', evaluacion: '2ª Evaluación', pub: '03-16', ent: '04-10', pct: 15,
        descripcion: 'Análisis de requisitos, casos de uso, alcance y planificación inicial del proyecto.' },
      { titulo: 'Diseño técnico', evaluacion: '2ª Evaluación', pub: '04-13', ent: '04-24', pct: 15,
        descripcion: 'Arquitectura de la solución, modelo de datos, diagramas y diseño de la interfaz (wireframes/prototipos).' },
      { titulo: 'Avance intermedio del desarrollo', evaluacion: '2ª Evaluación', pub: '05-11', ent: '05-29', pct: 20,
        descripcion: 'Entrega del núcleo funcional (iteración 1) con repositorio de control de versiones y demo.' },
      { titulo: 'Memoria del proyecto', evaluacion: '2ª Evaluación Final', pub: '05-25', ent: '06-23', pct: 25,
        descripcion: 'Memoria completa: introducción, análisis, diseño, implementación, pruebas, manual de usuario y manual técnico.' },
      { titulo: 'Entrega final del proyecto (código + presentación)', evaluacion: '2ª Evaluación Final', pub: '06-08', ent: '06-25', pct: 15,
        descripcion: 'Entrega del proyecto terminado: código fuente, despliegue/instalación y material de la presentación.' },
      // ── Copia en 1ª Evaluación Final (convocatoria ordinaria). pct 0 para no contar doble la nota. ──
      { titulo: 'Memoria del proyecto', evaluacion: '1ª Evaluación Final', pub: '06-01', ent: '06-20', pct: 0,
        descripcion: 'Memoria completa: introducción, análisis, diseño, implementación, pruebas, manual de usuario y manual técnico.' },
      { titulo: 'Entrega final del proyecto (código + presentación)', evaluacion: '1ª Evaluación Final', pub: '06-01', ent: '06-04', pct: 0,
        descripcion: 'Entrega del proyecto terminado: código fuente, despliegue/instalación y material de la presentación.' },
    ],
  },

  smr: {
    etiqueta: 'SMR',
    moduloId: 'qjhDxHpiyGQcoTWHyNXJ',   // PROI - Proyecto Intermodular SM2
    TAREAS: [
      { titulo: 'Propuesta del proyecto', evaluacion: '2ª Evaluación', pub: '03-02', ent: '03-13', pct: 10,
        descripcion: 'Documento breve con el proyecto elegido (montaje, red o servicio), el problema que resuelve y los objetivos.' },
      { titulo: 'Anteproyecto', evaluacion: '2ª Evaluación', pub: '03-16', ent: '04-10', pct: 15,
        descripcion: 'Análisis de necesidades y requisitos del sistema, alcance, recursos previstos y planificación inicial.' },
      { titulo: 'Diseño de la solución (red y equipos)', evaluacion: '2ª Evaluación', pub: '04-13', ent: '04-24', pct: 15,
        descripcion: 'Topología de red, esquema de equipos, direccionamiento IP, servicios, selección de hardware/software y presupuesto.' },
      { titulo: 'Montaje e instalación (avance)', evaluacion: '2ª Evaluación', pub: '05-11', ent: '05-29', pct: 20,
        descripcion: 'Montaje del equipamiento, instalación de SO y configuración básica de red/servicios, con evidencias.' },
      { titulo: 'Memoria del proyecto', evaluacion: '2ª Evaluación Final', pub: '05-25', ent: '06-23', pct: 25,
        descripcion: 'Memoria completa: análisis, diseño, montaje, configuración, pruebas, manual de usuario y manual técnico.' },
      { titulo: 'Entrega final (configuración + presentación)', evaluacion: '2ª Evaluación Final', pub: '06-08', ent: '06-25', pct: 15,
        descripcion: 'Entrega del proyecto terminado: configuración, documentación de despliegue y material de la presentación.' },
      // ── Copia en 1ª Evaluación Final (convocatoria ordinaria). pct 0 para no contar doble la nota. ──
      { titulo: 'Memoria del proyecto', evaluacion: '1ª Evaluación Final', pub: '06-01', ent: '06-20', pct: 0,
        descripcion: 'Memoria completa: análisis, diseño, montaje, configuración, pruebas, manual de usuario y manual técnico.' },
      { titulo: 'Entrega final (configuración + presentación)', evaluacion: '1ª Evaluación Final', pub: '06-01', ent: '06-04', pct: 0,
        descripcion: 'Entrega del proyecto terminado: configuración, documentación de despliegue y material de la presentación.' },
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
  console.log(`\n=== Tareas PROY · ${cfg.etiqueta} · ${CURSO_ACADEMICO} · ${APPLY ? 'APPLY' : 'SIMULACIÓN'} ===`);

  const modulo = await resolverModuloPorId(cfg.moduloId);
  const grupo = await resolverGrupoDeModulo(cfg.moduloId, CURSO_ACADEMICO);
  const profesorId = modulo.profesorId || grupo.tutorId || '';

  console.log(`Ciclo:  ${cfg.etiqueta} (${modulo.cicloId})`);
  console.log(`Módulo: ${modulo.abreviatura || modulo.nombre} (${modulo.id})`);
  console.log(`Grupo:  ${grupo.nombre} (${grupo.id})`);
  console.log(`ProfesorId: ${profesorId || '(vacío)'}`);
  const suma = cfg.TAREAS.reduce((s, t) => s + t.pct, 0);
  console.log(`Tareas a crear: ${cfg.TAREAS.length}  ·  Suma de porcentajes: ${suma}%`);
  if (suma !== 100) console.log(`  ⚠ Los porcentajes no suman 100% (${suma}%). Revisa el reparto.`);
  console.log('-----------------------------------------------------------');

  if (RESET) {
    const previas = await db.collection('tareas')
      .where('moduloId', '==', modulo.id).where('grupoId', '==', grupo.id).get();
    console.log(`[RESET] Tareas previas de PROY/${cfg.etiqueta}: ${previas.size}`);
    if (APPLY && !previas.empty) {
      const b = db.batch();
      previas.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      console.log(`[RESET] Eliminadas ${previas.size} tareas previas.`);
    }
  }

  cfg.TAREAS.forEach(t => {
    console.log(`  ${t.evaluacion.padEnd(20)} entrega ${fechaCurso(t.ent).toISOString().slice(0, 10)}  (${t.pct}%)  ${t.titulo}`);
  });

  if (!APPLY) {
    console.log('\n[SIMULACIÓN] No se ha escrito nada. Ejecuta con --apply para crear las tareas.');
    await admin.app().delete();
    return;
  }

  const batch = db.batch();
  const col = db.collection('tareas');
  const now = new Date();
  for (const t of cfg.TAREAS) {
    batch.set(col.doc(), {
      titulo: t.titulo,
      descripcion: t.descripcion,
      moduloId: modulo.id,
      grupoId: grupo.id,
      profesorId,
      resultadosAprendizajeIds: [],
      criteriosEvaluacionIds: [],
      fechaPublicacion: ts(fechaCurso(t.pub)),
      fechaEntrega: ts(fechaCurso(t.ent)),
      puntuacionMaxima: 10,
      porcentajeNotaFinal: t.pct,
      penalizacionRetraso: 10,
      permiteEntregaTardia: true,
      esGrupal: false,
      requiereArchivo: true,
      evaluacion: t.evaluacion,
      publicada: true,
      archivada: false,
      entregas: [],
      adjuntos: [],
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`\n✓ Creadas ${cfg.TAREAS.length} tareas para PROY/${cfg.etiqueta}.`);
  await admin.app().delete();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
