#!/usr/bin/env node
/**
 * ============================================================================
 *  Simula un curso completo de ASISTENCIA (septiembre → febrero) para el
 *  módulo DIGA (Digitalización aplicada a los sectores productivos).
 *
 *  Escribe en AMBAS colecciones para que cuadren la tabla mensual y el
 *  resumen combinado:
 *    - asistencia_mensual : documento por grupo/módulo/mes con faltas I/J por día
 *    - asistencia         : un registro de "pasar lista" por día lectivo y franja
 *
 *  NO crea alumnos. Usa los que ya están MATRICULADOS en DIGA.
 *
 *  DIFERENCIA CLAVE respecto al de DWEC:
 *    Solo UN alumno supera el 10% de faltas (queda por debajo del 90% de
 *    asistencia). El resto se mantiene claramente por encima del 90%.
 *    El reparto es DETERMINISTA: se elige explícitamente al alumno en riesgo.
 * ============================================================================
 *
 *  REQUISITOS:
 *    - npm install firebase-admin
 *    - scripts/serviceAccount.json con tu clave de servicio
 *
 *  USO:
 *    node scripts/simular-asistencia-diga.mjs            (simulación / dry-run)
 *    node scripts/simular-asistencia-diga.mjs --commit   (escribe en Firestore)
 *
 *  OPCIONES:
 *    --commit         Escribe de verdad (por defecto solo simula).
 *    --limpiar        Antes de escribir, borra la asistencia previa de DIGA
 *                     en el rango sept-feb (evita acumular ejecuciones).
 *    --seed=NNN       Semilla para reproducibilidad (por defecto 2026).
 *    --grupo=NOMBRE   Nombre del grupo (si no se pasa, se detecta por el módulo).
 *    --riesgo=N       Índice (0-based, por apellidos) del alumno en riesgo.
 *                     Por defecto 0 = el primero de la lista.
 * ============================================================================
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = join(__dirname, 'serviceAccount.json');

// ----------------------------------------------------------------------------
// CONFIGURACIÓN
// ----------------------------------------------------------------------------
const ABREV_MODULO = 'DIGA';        // módulo objetivo
const CURSO_ACADEMICO = '2025-2026';

// Curso: septiembre 2025 → febrero 2026 (mes en base 0)
const MESES = [
  { anio: 2025, mes: 8 },  // Septiembre
  { anio: 2025, mes: 9 },  // Octubre
  { anio: 2025, mes: 10 }, // Noviembre
  { anio: 2025, mes: 11 }, // Diciembre
  { anio: 2026, mes: 0 },  // Enero
  { anio: 2026, mes: 1 }   // Febrero
];

// Franjas en las que DIGA se imparte (3 h/semana). Se generará un registro de
// "pasar lista" por cada franja y día lectivo en que toque clase.
const FRANJAS_DIGA = ['10:20-11:15'];

// Días de la semana en que se imparte DIGA (1=lunes ... 5=viernes).
// 3 h/semana repartidas en 3 días distintos (lun, mié, vie).
const DIAS_CLASE = [1, 3, 5];

// Perfiles de absentismo (probabilidad de falta por día de clase):
//   - EN RIESGO: ~18% de faltas → queda holgadamente por debajo del 90% de asistencia.
//   - NORMAL:    ~2.5% de faltas → muy por encima del 90%, sin acercarse al 10%.
const PERFIL_RIESGO = { pFalta: 0.18, pJustif: 0.4 };
const PERFIL_NORMAL = { pFalta: 0.025, pJustif: 0.7 };

const COMMIT = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');
const SEED = (() => {
  const a = process.argv.find(x => x.startsWith('--seed='));
  return a ? parseInt(a.split('=')[1], 10) || 2026 : 2026;
})();
const GRUPO_ARG = (() => {
  const a = process.argv.find(x => x.startsWith('--grupo='));
  return a ? a.split('=')[1] : null;
})();
const RIESGO_IDX = (() => {
  const a = process.argv.find(x => x.startsWith('--riesgo='));
  return a ? Math.max(0, parseInt(a.split('=')[1], 10) || 0) : 0;
})();

const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// PRNG determinista (mulberry32) para resultados reproducibles
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Días lectivos del mes que además son días de clase de DIGA
function diasClaseDelMes(anio, mes) {
  const numDias = new Date(anio, mes + 1, 0).getDate();
  const dias = [];
  for (let d = 1; d <= numDias; d++) {
    const dow = new Date(anio, mes, d).getDay();
    if (DIAS_CLASE.includes(dow)) dias.push(d);
  }
  return dias;
}

async function main() {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch {
    console.error(`\n❌ No se pudo leer la clave en ${SERVICE_ACCOUNT_PATH}\n`);
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  console.log(`\n🔌 Conectado al proyecto: ${serviceAccount.project_id}`);
  console.log(COMMIT ? '✍️  MODO ESCRITURA (--commit).' : '🧪 MODO SIMULACIÓN (dry-run). Usa --commit para guardar.');
  console.log(`🎲 Semilla: ${SEED}`);

  // 1) Localizar el módulo DIGA
  const modsSnap = await db.collection('modulos').get();
  const modulo = modsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(m => norm(m.abreviatura) === norm(ABREV_MODULO));
  if (!modulo) {
    console.error(`\n❌ No existe ningún módulo con abreviatura "${ABREV_MODULO}".`);
    console.error(`   Módulos disponibles: ${modsSnap.docs.map(d => d.data().abreviatura).join(', ') || '(ninguno)'}`);
    process.exit(1);
  }
  console.log(`\n📘 Módulo: ${modulo.abreviatura} — ${modulo.nombre} (id: ${modulo.id})`);

  // 2) Localizar el grupo: por --grupo=, o por el grupo que tiene matriculados
  //    alumnos en DIGA (autodetección).
  const gruposSnap = await db.collection('grupos').get();
  const grupos = gruposSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let grupo = null;
  if (GRUPO_ARG) {
    grupo = grupos.find(g => norm(g.nombre) === norm(GRUPO_ARG));
    if (!grupo) {
      console.error(`\n❌ No existe ningún grupo "${GRUPO_ARG}".`);
      console.error(`   Grupos disponibles: ${grupos.map(g => g.nombre).join(', ') || '(ninguno)'}`);
      process.exit(1);
    }
  } else {
    // Autodetección: grupo cuyo modulosIds incluya el módulo, o que tenga alumnos
    // matriculados en DIGA.
    grupo = grupos.find(g => (g.modulosIds || []).includes(modulo.id));
    if (!grupo) {
      // Buscar por matrículas de alumnos
      const alumnosTodos = await db.collection('alumnos').get();
      const conDiga = alumnosTodos.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => (a.matriculas || []).some(m => m.moduloId === modulo.id));
      if (conDiga.length > 0) {
        const grupoId = conDiga[0].grupoId;
        grupo = grupos.find(g => g.id === grupoId);
      }
    }
    if (!grupo) {
      console.error(`\n❌ No se pudo autodetectar el grupo de ${ABREV_MODULO}.`);
      console.error(`   Pásalo explícitamente con --grupo=NOMBRE.`);
      console.error(`   Grupos disponibles: ${grupos.map(g => g.nombre).join(', ') || '(ninguno)'}`);
      process.exit(1);
    }
  }
  console.log(`👥 Grupo: ${grupo.nombre} (id: ${grupo.id})`);

  // 3) Alumnos del grupo MATRICULADOS en DIGA (no se crean nuevos)
  const alumnosSnap = await db.collection('alumnos').where('grupoId', '==', grupo.id).get();
  const alumnos = alumnosSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => (a.matriculas || []).some(m => m.moduloId === modulo.id))
    .filter(a => a.estado === undefined || a.estado === 'activo')
    .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));

  if (alumnos.length === 0) {
    console.error(`\n❌ No hay alumnos del grupo ${grupo.nombre} matriculados en ${modulo.abreviatura}.`);
    console.error(`   Matricúlalos en la app (Módulo → Matricular, o Grupo → casillas) y vuelve a ejecutar.`);
    process.exit(1);
  }

  // Elegir al alumno EN RIESGO (único). Por defecto el primero por apellidos.
  const idxRiesgo = Math.min(RIESGO_IDX, alumnos.length - 1);
  const alumnoRiesgoId = alumnos[idxRiesgo].id;

  console.log(`\n🧑‍🎓 ${alumnos.length} alumno(s) matriculado(s) en ${modulo.abreviatura}:`);
  alumnos.forEach((a, i) => {
    const marca = a.id === alumnoRiesgoId ? '  ⚠️ (será el único en riesgo)' : '';
    console.log(`   ${String(i).padStart(2)}. ${a.apellidos}, ${a.nombre} (id: ${a.id})${marca}`);
  });

  // 4) Limpieza opcional de datos previos en el rango
  if (LIMPIAR) {
    console.log(`\n🧹 Limpieza de asistencia previa (sept-feb) de ${grupo.nombre}/${modulo.abreviatura}...`);
    const docIds = MESES.map(({ anio, mes }) => `${grupo.id}_${modulo.id}_${anio}-${String(mes + 1).padStart(2, '0')}`);
    for (const id of docIds) {
      if (COMMIT) { await db.collection('asistencia_mensual').doc(id).delete().catch(() => {}); }
      console.log(`   ${COMMIT ? '🗑️' : '➡️ [simulado]'} asistencia_mensual/${id}`);
    }
    const inicio = new Date(MESES[0].anio, MESES[0].mes, 1);
    const fin = new Date(MESES[MESES.length - 1].anio, MESES[MESES.length - 1].mes + 1, 1);
    const asSnap = await db.collection('asistencia').where('grupoId', '==', grupo.id).get();
    let borr = 0;
    for (const d of asSnap.docs) {
      const data = d.data();
      const s = data.fecha?.seconds || 0;
      const dt = new Date(s * 1000);
      if (data.moduloId === modulo.id && dt >= inicio && dt < fin) {
        if (COMMIT) await d.ref.delete();
        borr++;
      }
    }
    console.log(`   ${COMMIT ? '🗑️' : '➡️ [simulado]'} ${borr} registro(s) de 'asistencia' en el rango`);
  }

  // 5) Asignar perfil: SOLO el alumno en riesgo recibe PERFIL_RIESGO; el resto NORMAL.
  const perfilDe = {};
  for (const a of alumnos) {
    perfilDe[a.id] = (a.id === alumnoRiesgoId) ? PERFIL_RIESGO : PERFIL_NORMAL;
  }

  // 6) Generar, mes a mes, las faltas y los registros de pasar lista
  const rng = makeRng(SEED);
  const resumen = {};
  alumnos.forEach(a => resumen[a.id] = { lectivos: 0, I: 0, J: 0 });

  const batchOps = [];

  for (const { anio, mes } of MESES) {
    const dias = diasClaseDelMes(anio, mes);
    const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // 6a) Documento mensual de faltas
    const faltasMes = {};
    for (const a of alumnos) {
      faltasMes[a.id] = {};
      const p = perfilDe[a.id];
      for (const dia of dias) {
        resumen[a.id].lectivos++;
        if (rng() < p.pFalta) {
          const tipo = rng() < p.pJustif ? 'J' : 'I';
          faltasMes[a.id][dia] = tipo;
          resumen[a.id][tipo]++;
        }
      }
    }

    const docIdMensual = `${grupo.id}_${modulo.id}_${anio}-${String(mes + 1).padStart(2, '0')}`;
    batchOps.push({
      tipo: 'asistencia_mensual',
      ref: db.collection('asistencia_mensual').doc(docIdMensual),
      data: {
        grupoId: grupo.id, moduloId: modulo.id,
        anio, mes: mes + 1,
        faltas: faltasMes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // 6b) Un registro de 'asistencia' por día de clase y franja
    let regsMes = 0;
    for (const dia of dias) {
      for (const franja of FRANJAS_DIGA) {
        const registros = alumnos.map(a => {
          const f = faltasMes[a.id][dia];
          let estado = 'presente';
          if (f === 'I') estado = 'ausente_injustificada';
          else if (f === 'J') estado = 'ausente_justificada';
          return {
            alumnoId: a.id,
            alumnoNombre: `${a.apellidos}, ${a.nombre}`,
            estado
          };
        });
        const [hh, mm] = franja.split('-')[0].split(':').map(Number);
        batchOps.push({
          tipo: 'asistencia',
          ref: db.collection('asistencia').doc(),
          data: {
            fecha: admin.firestore.Timestamp.fromDate(new Date(anio, mes, dia, hh, mm, 0)),
            moduloId: modulo.id,
            moduloAbreviatura: modulo.abreviatura,
            grupoId: grupo.id,
            profesorId: modulo.profesorId || 'sin-asignar',
            franjaHoraria: franja,
            registros,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });
        regsMes++;
      }
    }
    console.log(`   📅 ${nombreMes}: ${dias.length} días de clase · ${regsMes} registros de franja`);
  }

  // 7) Escribir (o simular)
  const nMensual = batchOps.filter(o => o.tipo === 'asistencia_mensual').length;
  const nFranja = batchOps.filter(o => o.tipo === 'asistencia').length;
  console.log(`\n📦 A escribir: ${nMensual} documento(s) mensuales + ${nFranja} registro(s) de franja.`);

  if (COMMIT) {
    let i = 0;
    while (i < batchOps.length) {
      const batch = db.batch();
      const trozo = batchOps.slice(i, i + 450);
      for (const op of trozo) batch.set(op.ref, op.data, { merge: true });
      await batch.commit();
      i += trozo.length;
      console.log(`   💾 Escrito lote ${Math.ceil(i / 450)} (${i}/${batchOps.length})`);
    }
  }

  // 8) Resumen final por alumno (% sobre días de clase del curso simulado)
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Resumen ${COMMIT ? '(escrito)' : '(simulado)'} — % asistencia por alumno:\n`);
  let masDel10 = 0;
  let sumaPct = 0;
  for (const a of alumnos) {
    const r = resumen[a.id];
    const presencias = r.lectivos - r.I - r.J;
    const pct = r.lectivos > 0 ? Math.round((presencias / r.lectivos) * 10000) / 100 : 100;
    const pctFaltas = Math.round((100 - pct) * 100) / 100;
    sumaPct += pct;
    const faltasTot = r.I + r.J;
    const flag = pctFaltas > 10 ? '  ⚠️ >10% FALTAS' : '';
    if (pctFaltas > 10) masDel10++;
    console.log(`   ${(a.apellidos + ', ' + a.nombre).padEnd(32)} ${String(pct).padStart(6)}% asist · ${String(pctFaltas).padStart(5)}% faltas · ${faltasTot} (I:${r.I} J:${r.J})${flag}`);
  }
  const media = alumnos.length ? Math.round((sumaPct / alumnos.length) * 100) / 100 : 0;
  console.log(`\n   📊 Media de asistencia de la clase: ${media}%`);
  console.log(`   ⚠️  Con más del 10% de faltas: ${masDel10} de ${alumnos.length}`);
  if (masDel10 !== 1) {
    console.log(`\n   ⚠️ AVISO: se esperaba exactamente 1 alumno con >10% de faltas, pero hay ${masDel10}.`);
    console.log(`      Ajusta la semilla con --seed=NNN o el alumno con --riesgo=N y vuelve a simular.`);
  } else {
    console.log(`   ✅ Correcto: exactamente 1 alumno supera el 10% de faltas.`);
  }

  if (!COMMIT) console.log(`\n👉 Si te cuadra, ejecútalo de nuevo con --commit (y --limpiar si repites).`);
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
