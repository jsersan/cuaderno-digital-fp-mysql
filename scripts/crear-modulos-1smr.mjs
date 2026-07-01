// scripts/crear-modulos-1smr.mjs
// -----------------------------------------------------------------------------
// Crea los módulos de 1º de SMR que faltan para que el horario de 1SM2 pueda
// reflejar el DCB oficial. El horario solo coloca módulos que EXISTEN como
// registro en el ciclo (igual que en 2º con SVR/SOR/AW/FOL/EIE); ahora mismo en
// 1º solo existen APIN y SEG, por eso al cargar la propuesta el resto de celdas
// se rellenaban con el módulo activo (DASP).
//
// Uso:
//   node --check scripts/crear-modulos-1smr.mjs    → validar sintaxis
//   node scripts/crear-modulos-1smr.mjs            → DRY-RUN (no escribe nada)
//   node scripts/crear-modulos-1smr.mjs --commit   → aplica los cambios
//
// Idempotente: no crea un módulo si ya existe uno con esa abreviatura o cuyo
// nombre contenga la palabra clave, dentro del MISMO ciclo del grupo 1SM2.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');

// Grupo de 1º cuyo cicloId se usará. El horario carga los módulos por grupo.cicloId,
// así que es IMPRESCINDIBLE crear los módulos en ese mismo ciclo.
const GRUPO_1_NOMBRE = '1SM2';

// Propietario de los módulos nuevos. Por defecto se hereda de otro módulo del ciclo
// que NO sea de Txema (para que NO aparezcan como tarjetas en su panel, solo en el
// horario). Pon aquí un UID si quieres forzar el propietario; deja null para auto.
const FORZAR_PROFESOR_ID = null;
const TXEMA_UID = '21m6mMuCAieZ7ZpcR2xfm9kH9yc2';

// Localiza serviceAccount.json: 1) argumento explícito, 2) junto al script, 3) raíz
// del proyecto, 4) carpeta scripts/. Así funciona lo lances desde donde lo lances.
const __dirname = dirname(fileURLToPath(import.meta.url));
const argPath = process.argv.slice(2).find(a => !a.startsWith('--'));
const candidatos = [
  argPath && (isAbsolute(argPath) ? argPath : resolve(process.cwd(), argPath)),
  resolve(__dirname, 'serviceAccount.json'),
  resolve(process.cwd(), 'serviceAccount.json'),
  resolve(process.cwd(), 'scripts/serviceAccount.json'),
].filter(Boolean);
const saPath = candidatos.find(p => existsSync(p));
if (!saPath) {
  console.error('✗ No encuentro serviceAccount.json. Rutas probadas:\n  ' + candidatos.join('\n  '));
  console.error('Pásalo como argumento, p.ej.:  node scripts/crear-modulos-1smr.mjs scripts/serviceAccount.json --commit');
  process.exit(1);
}
console.log(`serviceAccount: ${saPath}`);
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
console.log(`Proyecto de la clave: ${serviceAccount.project_id || '(sin project_id)'} · cuenta: ${serviceAccount.client_email || '(sin client_email)'}`);
console.log('→ Comprueba que ese "Proyecto" coincide con el firebaseConfig.projectId de tu app.');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Módulos de 1º SMR según el DCB (los de 2º NO se tocan).
//   Horas/semana ≈ horasTotales / 33 semanas.
const MODULOS_1SMR = [
  { abrev: 'MOME',  nombre: 'Montaje y mantenimiento de equipos', horasTotales: 231, horasSemanales: 7, nameKey: 'montaje' },
  { abrev: 'SOMO',  nombre: 'Sistemas operativos monopuesto',     horasTotales: 165, horasSemanales: 5, nameKey: 'monopuesto' },
  { abrev: 'APIN', nombre: 'Aplicaciones ofimáticas',            horasTotales: 231, horasSemanales: 7, nameKey: 'ofim' },
  { abrev: 'RELO',   nombre: 'Redes locales',                      horasTotales: 231, horasSemanales: 7, nameKey: 'redes local' },
  { abrev: 'SEG',  nombre: 'Seguridad informática',              horasTotales: 99,  horasSemanales: 3, nameKey: 'seguridad' },
  { abrev: 'ING',  nombre: 'Inglés técnico',                     horasTotales: 33,  horasSemanales: 1, nameKey: 'ingl' },
];

const criteriosCalificacion = {
  porcentajeExamenes: 60, porcentajeTareas: 20, porcentajeActitud: 10, porcentajeAsistencia: 10,
  notaMinimaAprobado: 5, porcentajeMinimoAsistencia: 85, requiereAprobadoExamen: false, recuperacionDisponible: true,
};

async function main() {
  console.log(COMMIT
    ? '== MODO COMMIT: se escribirá en Firestore =='
    : '== DRY-RUN: no se escribe nada. Repite con --commit para aplicar ==');

  // 1) Localizar el grupo de 1º y su ciclo
  const gruposSnap = await db.collection('grupos').where('nombre', '==', GRUPO_1_NOMBRE).get();
  if (gruposSnap.empty) {
    console.error(`✗ No se encontró ningún grupo "${GRUPO_1_NOMBRE}".`);
    process.exit(1);
  }
  const grupoDoc = gruposSnap.docs.find(d => d.data().activo !== false) || gruposSnap.docs[0];
  const grupo = grupoDoc.data();
  const cicloId = grupo.cicloId;
  const cicloNombre = grupo.cicloNombre || '';
  if (!cicloId) {
    console.error(`✗ El grupo "${GRUPO_1_NOMBRE}" (${grupoDoc.id}) no tiene cicloId.`);
    process.exit(1);
  }
  console.log(`Grupo "${GRUPO_1_NOMBRE}" (${grupoDoc.id}) → cicloId=${cicloId} ${cicloNombre ? `(${cicloNombre})` : ''}`);
  if (gruposSnap.size > 1) console.log(`  (ojo: hay ${gruposSnap.size} grupos con ese nombre; se usa ${grupoDoc.id})`);

  // 2) Módulos ya existentes en ese ciclo
  const modSnap = await db.collection('modulos').where('cicloId', '==', cicloId).get();
  const existentes = modSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Módulos existentes en el ciclo: ${existentes.length} → ${existentes.map(e => e.abreviatura).join(', ') || '(ninguno)'}`);

  const yaExiste = (m) => existentes.some(e =>
    norm(e.abreviatura) === norm(m.abrev) ||
    (e.nombre || '').toLowerCase().includes(m.nameKey)
  );

  // 3) profesorId para los nuevos: forzado, o el de un módulo ajeno a Txema, o vacío
  const ajeno = existentes.find(e => e.profesorId && e.profesorId !== TXEMA_UID);
  const profesorIdNuevo = FORZAR_PROFESOR_ID ?? (ajeno?.profesorId || '');
  console.log(`profesorId para los nuevos módulos: "${profesorIdNuevo}"`
    + (profesorIdNuevo ? '' : ' (sin propietario: no saldrán como tarjetas en el panel de Txema, sí en el horario)'));

  // 4) Crear los que falten
  const aCrear = MODULOS_1SMR.filter(m => !yaExiste(m));
  const yaHay = MODULOS_1SMR.filter(m => yaExiste(m)).map(m => m.abrev);
  if (yaHay.length) console.log(`Ya existen (se omiten): ${yaHay.join(', ')}`);

  if (aCrear.length === 0) {
    console.log('✓ Todos los módulos de 1º SMR ya existen. Nada que crear.');
    return;
  }

  console.log(`\nMódulos a crear (${aCrear.length}):`);
  for (const m of aCrear) console.log(`  • ${m.abrev} — ${m.nombre} (${m.horasSemanales} h/sem · ${m.horasTotales} h)`);

  if (!COMMIT) {
    console.log('\nDRY-RUN: no se ha creado nada. Repite con --commit para aplicarlo.');
    return;
  }

  const batch = db.batch();
  for (const m of aCrear) {
    const ref = db.collection('modulos').doc();
    batch.set(ref, {
      nombre: m.nombre,
      abreviatura: m.abrev,
      cicloId,
      cicloNombre,
      curso: 1,
      horasSemanales: m.horasSemanales,
      horasTotales: m.horasTotales,
      profesorId: profesorIdNuevo,
      resultadosAprendizaje: [],
      ponderacionRA: {},
      criteriosCalificacion,
      activo: true,
      esFCT: false,
      esProyecto: false,
    });
  }
  await batch.commit();
  console.log(`\n✓ Creados ${aCrear.length} módulos de 1º SMR en el ciclo ${cicloId}.`);
  console.log('Siguiente paso: abre el cuaderno de 1º → Horario → "Cargar propuesta 1º SMR" → revisa → "Guardar horario".');
}

main().catch(e => {
  if (e && (e.code === 16 || /UNAUTHENTICATED/.test(e.message || ''))) {
    console.error('\n✗ Firestore RECHAZA las credenciales (UNAUTHENTICATED). La clave es inválida.');
    console.error('  Causas habituales:');
    console.error('   1) La clave está revocada/caducada → regenera una nueva (GCP Console → IAM → Cuentas de servicio → Claves → JSON).');
    console.error('   2) La clave es de otro proyecto → su project_id debe ser el de firebaseConfig.projectId de la app.');
    console.error('   3) El reloj del equipo está descuadrado → activa la hora automática (la firma del token deja de validar).');
  } else if (e && (e.code === 7 || /PERMISSION_DENIED/.test(e.message || ''))) {
    console.error('\n✗ La cuenta de servicio no tiene permisos sobre Firestore.');
    console.error('  Dale el rol "Usuario de Cloud Datastore" (o Editor) en GCP Console → IAM.');
  } else {
    console.error(e);
  }
  process.exit(1);
});
