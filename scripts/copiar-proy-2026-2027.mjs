#!/usr/bin/env node
/**
 * copiar-proy-2026-2027.mjs
 * ========================================================================
 * PROY · Dos tareas:
 *
 *  FASE A · Añade al curso 2025-2026 la convocatoria de junio:
 *           "Defensa del Proyecto (Convocatoria Ordinaria)" en la
 *           2ª Evaluación Final (22 junio 2026) + su evento de programación.
 *           (Si ya existe una defensa en junio, no la duplica.)
 *
 *  FASE B · Copia TODO lo de PROY del curso 2025-2026 al 2026-2027:
 *           eventos_programacion, tareas, examenes, recuperaciones y
 *           calificaciones — CON las notas/entregas del año anterior —
 *           desplazando todas las fechas +1 año.
 *           Antes de copiar, BORRA lo que hubiera de PROY en 2026-2027
 *           (evita duplicados).
 *
 * USO:
 *   node scripts/copiar-proy-2026-2027.mjs            # DRY-RUN
 *   node scripts/copiar-proy-2026-2027.mjs --commit    # ESCRIBE
 * ========================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

const CURSO_ORIGEN = '2025-2026';
const CURSO_DESTINO = '2026-2027';
const ANIOS = 1; // desplazamiento de fechas
const EVAL_2F = '2ª Evaluación Final';
const COLOR_EXAMEN = '#c62828';
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();

// Colecciones de PROY que se copian
const COLECCIONES = ['eventos_programacion', 'tareas', 'examenes', 'recuperaciones', 'calificaciones'];

let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

// Desplaza +N años cualquier campo cuyo nombre contenga "fecha" (recursivo).
// createdAt / updatedAt NO se tocan (no contienen "fecha").
function desplazarFechas(obj, anios) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj?.toDate === 'function') return obj; // Timestamp suelto sin nombre → no tocar
  if (Array.isArray(obj)) return obj.map(x => desplazarFechas(x, anios));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/fecha/i.test(k) && v && typeof v.toDate === 'function') {
        const d = v.toDate();
        d.setFullYear(d.getFullYear() + anios);
        out[k] = Timestamp.fromDate(d);
      } else if (v && typeof v === 'object') {
        out[k] = desplazarFechas(v, anios);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return obj;
}

async function run() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  COPIAR PROY · ${CURSO_ORIGEN} → ${CURSO_DESTINO}`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT (escribe)' : '🔍 DRY-RUN (no escribe)'}`);
  console.log(`${'═'.repeat(64)}`);
  initFirebase();

  // ── Localizar PROY ──
  let proy = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!proy && norm(m.abreviatura) === 'proy') proy = { id: d.id, ...m };
  });
  if (!proy) { console.error('❌ No se encontró el módulo PROY'); process.exit(1); }
  const profesorId = proy.profesorId || '';
  console.log(`\n✓ PROY: ${proy.id}`);

  // ── Localizar grupos DAW2 origen y destino ──
  const daw2 = {};
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (norm(g.nombre) === 'daw2') daw2[g.cursoAcademico] = { id: d.id, ref: d.ref, ...g };
  });
  const grupoOrigen = daw2[CURSO_ORIGEN];
  const grupoDestino = daw2[CURSO_DESTINO];
  if (!grupoOrigen) { console.error(`❌ No hay grupo DAW2 de ${CURSO_ORIGEN}`); process.exit(1); }
  if (!grupoDestino) { console.error(`❌ No hay grupo DAW2 de ${CURSO_DESTINO}. Créalo desde el dashboard primero.`); process.exit(1); }
  console.log(`✓ DAW2 ${CURSO_ORIGEN}: ${grupoOrigen.id} (origen)`);
  console.log(`✓ DAW2 ${CURSO_DESTINO}: ${grupoDestino.id} (destino)`);

  // ════════════════════════════════════════════════════════════
  //  FASE A · Convocatoria de defensa (junio 2026) en el ORIGEN
  // ════════════════════════════════════════════════════════════
  console.log(`\n── FASE A · Defensa ordinaria junio 2026 (${CURSO_ORIGEN}) ──`);
  const exSnap = await db.collection('examenes')
    .where('moduloId', '==', proy.id).where('grupoId', '==', grupoOrigen.id).get();
  const yaHayDefensa = exSnap.docs.some(d => {
    const e = d.data();
    return e.evaluacion === EVAL_2F && /defensa/i.test(e.titulo || '');
  });

  if (yaHayDefensa) {
    console.log('   Ya existe una defensa en 2ª Evaluación Final. No se duplica.');
  } else {
    const fDefensa = new Date(2026, 5, 22, 9, 0, 0); // 22 junio 2026
    const examenDefensa = {
      moduloId: proy.id, grupoId: grupoOrigen.id, profesorId,
      titulo: 'Defensa del Proyecto (Convocatoria Ordinaria)',
      descripcion: 'Presentación y defensa oral del proyecto intermodular ante tribunal.',
      tipo: 'final', evaluacion: EVAL_2F,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(fDefensa), horaInicio: '09:00', horaFin: '13:00',
      aula: 'Aula de Grados', duracionMinutos: 240, puntuacionMaxima: 10,
      porcentajeNotaFinal: 0, // no afecta al cálculo automático; ajústalo a tu criterio
      notaMinimaAprobado: 5, tienePonderacion: false,
      publicado: true, resultadosPublicados: false, permiteRecuperacion: true,
      calificaciones: [], cursoAcademico: CURSO_ORIGEN,
      createdAt: nowTs(), updatedAt: nowTs(),
    };
    const eventoDefensa = {
      moduloId: proy.id, grupoId: grupoOrigen.id, profesorId,
      cursoAcademico: CURSO_ORIGEN, evaluacion: EVAL_2F, tipo: 'examen',
      titulo: 'Defensa del Proyecto (Convocatoria Ordinaria)',
      descripcion: 'final · Defensa oral ante tribunal · Aula de Grados',
      fechaInicio: Timestamp.fromDate(fDefensa),
      color: COLOR_EXAMEN, createdAt: nowTs(), updatedAt: nowTs(),
    };
    console.log('   + Defensa del Proyecto (Convocatoria Ordinaria) · 22 jun 2026');
    if (COMMIT) {
      await db.collection('examenes').add(examenDefensa);
      await db.collection('eventos_programacion').add(eventoDefensa);
      console.log('   ✓ Examen + evento creados');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  FASE B · Copiar TODO de PROY al curso destino
  // ════════════════════════════════════════════════════════════
  console.log(`\n── FASE B · Copia ${CURSO_ORIGEN} → ${CURSO_DESTINO} ──`);

  for (const col of COLECCIONES) {
    // Leer origen
    const srcSnap = await db.collection(col)
      .where('moduloId', '==', proy.id).where('grupoId', '==', grupoOrigen.id).get();

    // Contar/borrar destino previo
    const dstSnap = await db.collection(col)
      .where('moduloId', '==', proy.id).where('grupoId', '==', grupoDestino.id).get();

    console.log(`\n   ${col}: ${srcSnap.size} en origen, ${dstSnap.size} en destino (se borrarán)`);

    if (COMMIT) {
      // Borrar destino
      if (!dstSnap.empty) {
        let b = db.batch(), n = 0;
        for (const d of dstSnap.docs) {
          b.delete(d.ref); n++;
          if (n % 400 === 0) { await b.commit(); b = db.batch(); }
        }
        if (n % 400 !== 0) await b.commit();
      }
      // Copiar origen → destino con fechas +1 año
      let b = db.batch(), n = 0;
      for (const d of srcSnap.docs) {
        const data = d.data();
        const copia = desplazarFechas(data, ANIOS);
        copia.grupoId = grupoDestino.id;
        copia.cursoAcademico = CURSO_DESTINO;
        copia.updatedAt = nowTs();
        copia.createdAt = data.createdAt || nowTs();
        b.set(db.collection(col).doc(), copia);
        n++;
        if (n % 400 === 0) { await b.commit(); b = db.batch(); }
      }
      if (n % 400 !== 0) await b.commit();
      console.log(`      ✓ ${srcSnap.size} copiados a ${CURSO_DESTINO}`);
    }
  }

  console.log(`\n${'═'.repeat(64)}`);
  if (!COMMIT) {
    console.log('  🔍 DRY-RUN: no se ha escrito nada.');
    console.log('  Revisa los recuentos de arriba y ejecuta con --commit.\n');
  } else {
    console.log('  ✅ PROY copiado a 2026-2027 (con notas) + defensa de junio 2026.');
    console.log('  Las fechas del curso destino están desplazadas +1 año.');
    console.log('  Nota: la defensa se crea con peso 0% para no descuadrar la nota');
    console.log('        final; ajusta su porcentaje en Exámenes según tu criterio.\n');
  }
}

run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
