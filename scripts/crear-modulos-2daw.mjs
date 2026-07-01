#!/usr/bin/env node
/**
 * ============================================================================
 *  Script para crear los módulos de 2º de Desarrollo de Aplicaciones Web (DAW)
 *  Currículo LOMLOP (Euskadi) — colección "modulos" de Firestore
 * ============================================================================
 *
 *  Crea los 6 módulos que faltan para poder completar el horario del grupo:
 *    DWES, DIW, DESP, ING, IPE2, PROY
 *  (DWEC ya lo tienes creado, así que por defecto NO se vuelve a crear.)
 *
 *  Las ABREVIATURAS coinciden EXACTAMENTE con las que busca el botón
 *  "Cargar propuesta 2º DAW" del editor de horario.
 *
 *  --------------------------------------------------------------------------
 *  REQUISITOS
 *  --------------------------------------------------------------------------
 *  1) Node.js 18 o superior.
 *  2) Instalar firebase-admin en la carpeta del proyecto:
 *         npm install firebase-admin
 *  3) Una clave de servicio (service account) de tu proyecto Firebase:
 *       - Consola Firebase → Configuración del proyecto → Cuentas de servicio
 *       - "Generar nueva clave privada" → descarga un archivo .json
 *       - Guárdalo como  serviceAccount.json  junto a este script
 *         (o ajusta la ruta en SERVICE_ACCOUNT_PATH más abajo)
 *
 *  --------------------------------------------------------------------------
 *  USO
 *  --------------------------------------------------------------------------
 *      node scripts/crear-modulos-2daw.mjs
 *
 *  Por defecto hace una SIMULACIÓN (dry-run) y solo muestra lo que haría.
 *  Para escribir de verdad en Firestore, ejecútalo con --commit:
 *
 *      node scripts/crear-modulos-2daw.mjs --commit
 *
 * ============================================================================
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

// ----------------------------------------------------------------------------
// CONFIGURACIÓN — AJUSTA ESTOS VALORES
// ----------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ruta a tu clave de servicio descargada de Firebase
const SERVICE_ACCOUNT_PATH = join(__dirname, 'serviceAccount.json');

// El profesorId que se asignará a los módulos nuevos.
// Pon tu UID (lo ves en la consola de Firebase → Authentication), o déjalo
// como 'sin-asignar' y luego lo reasignas desde la app.
const PROFESOR_ID = 'sin-asignar';

// El centroId que usa tu app (por defecto 'default' según tu configuración)
const CENTRO_ID = 'default';

// Cómo localizar el ciclo de DAW al que pertenece el grupo:
//  - Si conoces el cicloId exacto, ponlo aquí y se usará directamente.
//  - Si lo dejas vacío (''), el script buscará en la colección "ciclos" uno
//    cuyo nombre/abreviatura contenga "DAW" o "Desarrollo de Aplicaciones Web".
let CICLO_ID = '';

// Curso académico (informativo)
const CURSO_ACADEMICO = '2025-2026';

// Semanas lectivas de 2º usadas para el cálculo de horas (informativo).
// horasTotales ya viene fijado abajo según el currículo.

// ----------------------------------------------------------------------------
// DATOS DE LOS MÓDULOS DE 2º DAW (currículo LOMLOP)
// ----------------------------------------------------------------------------
//
//  IMPORTANTE sobre las horas:
//  - horasTotales: horas del módulo en el currículo (valores estándar LOE/LOMLOP).
//  - horasSemanales: reparto orientativo en una semana de 2º (~22 semanas lectivas).
//  Verifica estos números con la programación oficial de TU centro, ya que en
//  Euskadi el ciclo añade horas de libre configuración y puede variar.
//
const MODULOS_2DAW = [
  {
    abreviatura: 'DWEC',
    nombre: 'Desarrollo Web en Entorno Cliente',
    codigo: '0613',
    horasTotales: 132,
    horasSemanales: 6,
    // DWEC normalmente YA lo tienes. Por eso viene desactivado por defecto.
    crear: false
  },
  {
    abreviatura: 'DWES',
    nombre: 'Desarrollo Web en Entorno Servidor',
    codigo: '0614',
    horasTotales: 154,
    horasSemanales: 7,
    crear: true
  },
  {
    abreviatura: 'DIW',
    nombre: 'Diseño de Interfaces Web',
    codigo: '0615',
    horasTotales: 110,
    horasSemanales: 5,
    crear: true
  },
  {
    abreviatura: 'DESP',
    nombre: 'Despliegue de Aplicaciones Web',
    codigo: '0616',
    horasTotales: 44,
    horasSemanales: 2,
    crear: true
  },
  {
    abreviatura: 'ING',
    nombre: 'Inglés Profesional',
    codigo: '0179',
    horasTotales: 44,
    horasSemanales: 2,
    crear: true
  },
  {
    abreviatura: 'IPE2',
    nombre: 'Itinerario Personal para la Empleabilidad II',
    codigo: 'IPE2',
    horasTotales: 66,
    horasSemanales: 3,
    crear: true
  },
  {
    abreviatura: 'PROY',
    nombre: 'Proyecto Intermodular de Desarrollo de Aplicaciones Web',
    codigo: '0617',
    horasTotales: 44,
    horasSemanales: 2,
    esProyecto: true,
    crear: true
  }
];

// Criterios de calificación por defecto (idénticos a los que usa la app)
const CRITERIOS_DEFECTO = {
  porcentajeExamenes: 50,
  porcentajeTareas: 30,
  porcentajeActitud: 10,
  porcentajeAsistencia: 10,
  notaMinimaAprobado: 5,
  porcentajeMinimoAsistencia: 85,
  requiereAprobadoExamen: false,
  recuperacionDisponible: true
};

// ----------------------------------------------------------------------------
// LÓGICA DEL SCRIPT (no suele hacer falta tocar nada de aquí abajo)
// ----------------------------------------------------------------------------

const COMMIT = process.argv.includes('--commit');

function log(...a) { console.log(...a); }
function norm(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

async function main() {
  // 1) Inicializar firebase-admin
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (e) {
    console.error(`\n❌ No se pudo leer la clave de servicio en:\n   ${SERVICE_ACCOUNT_PATH}`);
    console.error(`   Descárgala desde la consola de Firebase (Cuentas de servicio) y guárdala ahí.\n`);
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  log(`\n🔌 Conectado al proyecto: ${serviceAccount.project_id}`);
  log(COMMIT ? '✍️  MODO ESCRITURA (--commit): se guardarán los cambios.' : '🧪 MODO SIMULACIÓN (dry-run): no se escribe nada. Usa --commit para guardar.');

  // 2) Resolver el cicloId si no se ha indicado
  if (!CICLO_ID) {
    log('\n🔎 Buscando el ciclo de DAW en la colección "ciclos"...');
    const ciclosSnap = await db.collection('ciclos').get();
    const candidato = ciclosSnap.docs.find(d => {
      const c = d.data();
      const txt = norm(`${c.nombre || ''} ${c.abreviatura || ''} ${c.siglas || ''}`);
      return txt.includes('DAW') || txt.includes('DESARROLLODEAPLICACIONESWEB') || txt.includes('APLICACIONESWEB');
    });
    if (candidato) {
      CICLO_ID = candidato.id;
      log(`   ✓ Ciclo encontrado: "${candidato.data().nombre}" (id: ${CICLO_ID})`);
    } else {
      console.error('   ❌ No encontré ningún ciclo de DAW. Opciones:');
      console.error('      - Pon el cicloId a mano en la constante CICLO_ID, o');
      console.error('      - Revisa que exista el ciclo en la colección "ciclos".');
      console.error(`      Ciclos disponibles: ${ciclosSnap.docs.map(d => d.data().nombre || d.id).join(', ') || '(ninguno)'}`);
      process.exit(1);
    }
  } else {
    log(`\n📌 Usando cicloId indicado: ${CICLO_ID}`);
  }

  // 3) Leer módulos ya existentes en ese ciclo para no duplicar
  const existentesSnap = await db.collection('modulos').where('cicloId', '==', CICLO_ID).get();
  const abrevsExistentes = new Set(existentesSnap.docs.map(d => norm(d.data().abreviatura)));
  log(`\n📚 Módulos ya existentes en el ciclo: ${[...existentesSnap.docs.map(d => d.data().abreviatura)].join(', ') || '(ninguno)'}`);

  // 4) Crear los que falten
  const aCrear = MODULOS_2DAW.filter(m => m.crear);
  let creados = 0, saltados = 0;

  for (const m of aCrear) {
    if (abrevsExistentes.has(norm(m.abreviatura))) {
      log(`   ⏭️  ${m.abreviatura} ya existe en el ciclo → se omite.`);
      saltados++;
      continue;
    }

    const doc = {
      nombre: m.nombre,
      codigo: m.codigo,
      abreviatura: m.abreviatura,
      cicloId: CICLO_ID,
      centroId: CENTRO_ID,
      curso: 2,
      horasTotales: m.horasTotales,
      horasSemanales: m.horasSemanales,
      profesorId: PROFESOR_ID,
      cursoAcademico: CURSO_ACADEMICO,
      resultadosAprendizaje: [],
      ponderacionRA: {},
      criteriosCalificacion: { ...CRITERIOS_DEFECTO },
      activo: true,
      esFCT: false,
      esProyecto: m.esProyecto === true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (COMMIT) {
      const ref = await db.collection('modulos').add(doc);
      log(`   ✅ Creado ${m.abreviatura} — ${m.nombre} (id: ${ref.id})`);
    } else {
      log(`   ➕ [simulado] Crearía ${m.abreviatura} — ${m.nombre} (${m.horasSemanales} h/sem)`);
    }
    creados++;
  }

  log(`\n──────────────────────────────────────────────`);
  log(`Resumen: ${creados} ${COMMIT ? 'creados' : 'a crear'}, ${saltados} omitidos (ya existían).`);
  if (!COMMIT) log(`\n👉 Si la simulación es correcta, ejecútalo de nuevo con --commit para guardar.`);
  log('');

  process.exit(0);
}

main().catch(e => { console.error('\n❌ Error inesperado:', e); process.exit(1); });
