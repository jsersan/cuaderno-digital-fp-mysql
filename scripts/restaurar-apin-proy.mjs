#!/usr/bin/env node
/**
 * restaurar-apin-proy.mjs
 * ========================================================================
 * Restaura los módulos PROY (DAW2) y APIN (SM2) con todos sus datos:
 *   FASE 1 · Detectar DWEC/DAW2 existentes (para obtener cicloId, profesorId)
 *   FASE 2 · Crear módulo PROY para DAW2 + programación + tareas
 *   FASE 3 · Crear ciclo SMR + grupo SM2 + módulo APIN
 *   FASE 4 · Crear módulos SMR adicionales (SERED, SEGI, SGBD, EIE, HLC)
 *   FASE 5 · Importar 20 alumnos SMR
 *   FASE 6 · Crear programación APIN (12 UDs) + tareas + exámenes
 *   FASE 7 · Escribir horario en el grupo SM2
 *
 * USO:
 *   node scripts/restaurar-apin-proy.mjs              # DRY-RUN
 *   node scripts/restaurar-apin-proy.mjs --commit      # ESCRIBE
 * ========================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const CURSO = '2025-2026';
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';
const EVAL_1F = '1ª Evaluación Final';
const EVAL_2F = '2ª Evaluación Final';
const COLOR = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };
const MS_DIA = 24 * 3600 * 1000;
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();

// ── Firebase init ──
let db;
function initFirebase() {
  const saPath = join(__dirname, 'serviceAccount.json');
  let sa;
  try { sa = JSON.parse(readFileSync(saPath, 'utf8')); }
  catch {
    console.error(`\n❌ No se encontró ${saPath}`);
    console.error('   Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave\n');
    process.exit(1);
  }
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

// ── Helpers ──
function fechaProporcional(inicio, fin, fraccion) {
  const d = new Date(inicio.getTime() + fraccion * (fin.getTime() - inicio.getTime()));
  d.setHours(9, 0, 0, 0);
  return d;
}

async function escribirBatch(coleccion, docs) {
  let batch = db.batch(), count = 0, ids = [];
  for (const doc of docs) {
    const ref = db.collection(coleccion).doc();
    batch.set(ref, doc);
    ids.push(ref.id);
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`   · ${coleccion}: ${docs.length} creados`);
  return ids;
}

// ========================================================================
//  DATOS DEL MÓDULO PROY (Proyecto - DAW2)
// ========================================================================
const PROY_UDS = [
  { n: 0, titulo: 'UD0: Presentación del módulo de Proyecto', horas: 2, eval: EVAL_1 },
  { n: 1, titulo: 'UD1: Análisis de requisitos y planificación', horas: 20, eval: EVAL_1 },
  { n: 2, titulo: 'UD2: Diseño técnico y arquitectura', horas: 20, eval: EVAL_1 },
  { n: 3, titulo: 'UD3: Desarrollo del backend', horas: 30, eval: EVAL_1 },
  { n: 4, titulo: 'UD4: Desarrollo del frontend', horas: 30, eval: EVAL_2 },
  { n: 5, titulo: 'UD5: Integración, testing y despliegue', horas: 20, eval: EVAL_2 },
  { n: 6, titulo: 'UD6: Documentación y presentación final', horas: 18, eval: EVAL_2 },
];
const PROY_TAREAS = [
  { titulo: 'Entrega 1: Documento de análisis de requisitos', desc: 'Identificación de requisitos funcionales y no funcionales, historias de usuario y casos de uso.', udRef: 1, eval: EVAL_1, peso: 10 },
  { titulo: 'Entrega 2: Planificación y diagramas', desc: 'Diagrama de Gantt, reparto de tareas y plan de sprints.', udRef: 1, eval: EVAL_1, peso: 10 },
  { titulo: 'Entrega 3: Diseño de la base de datos y API', desc: 'Modelo ER, esquema de base de datos y diseño de endpoints REST.', udRef: 2, eval: EVAL_1, peso: 15 },
  { titulo: 'Entrega 4: Prototipo de interfaz (mockups)', desc: 'Wireframes y prototipo navegable con Figma o herramienta equivalente.', udRef: 2, eval: EVAL_1, peso: 10 },
  { titulo: 'Entrega 5: Backend funcional con API REST', desc: 'Servidor con rutas, controladores, modelos y autenticación implementados.', udRef: 3, eval: EVAL_1, peso: 15 },
  { titulo: 'Entrega 6: Frontend integrado', desc: 'Aplicación frontend conectada al backend con las funcionalidades principales.', udRef: 4, eval: EVAL_2, peso: 15 },
  { titulo: 'Entrega 7: Tests y despliegue', desc: 'Tests unitarios/e2e y despliegue en entorno de producción (Render, Vercel, etc.).', udRef: 5, eval: EVAL_2, peso: 10 },
  { titulo: 'Entrega final: Memoria y presentación', desc: 'Documentación técnica completa y presentación oral del proyecto ante tribunal.', udRef: 6, eval: EVAL_2, peso: 15 },
];
// PROY no tiene exámenes

// ========================================================================
//  DATOS DEL MÓDULO APIN (Aplicaciones Ofimáticas - SM2)
// ========================================================================
const APIN_UDS = [
  { n: 0,  titulo: 'UD0: Presentación del módulo', horas: 1,  eval: EVAL_1 },
  { n: 1,  titulo: 'UD1: Instalación de aplicaciones ofimáticas', horas: 6,  eval: EVAL_1 },
  { n: 2,  titulo: 'UD2: Elaboración de documentos y plantillas', horas: 21, eval: EVAL_1 },
  { n: 3,  titulo: 'UD3: Elaboración de hojas de cálculo', horas: 28, eval: EVAL_1 },
  { n: 4,  titulo: 'UD4: Elaboración de presentaciones', horas: 14, eval: EVAL_1 },
  { n: 5,  titulo: 'UD5: Gestión de correo y agenda electrónica', horas: 7,  eval: EVAL_1 },
  { n: 6,  titulo: 'UD6: Diseño de una base de datos relacional', horas: 21, eval: EVAL_1 },
  { n: 7,  titulo: 'UD7: Definición y manipulación de bases de datos (I)', horas: 28, eval: EVAL_1 },
  { n: 8,  titulo: 'UD8: Definición y manipulación de bases de datos (II)', horas: 28, eval: EVAL_2 },
  { n: 9,  titulo: 'UD9: Manipulación básica de imágenes', horas: 28, eval: EVAL_2 },
  { n: 10, titulo: 'UD10: Manipulación avanzada de imágenes', horas: 21, eval: EVAL_2 },
  { n: 11, titulo: 'UD11: Manipulación de secuencias de vídeo', horas: 28, eval: EVAL_2 },
];
const APIN_TAREAS = [
  { titulo: 'Práctica 1: Instalación y configuración de la suite ofimática', desc: 'Instalación, actualización y configuración de aplicaciones ofimáticas.', udRef: 1, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 2: Documento con estilos, índices y plantillas', desc: 'Documento extenso con estilos, tablas, índices y plantillas.', udRef: 2, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 3: Hoja de cálculo con fórmulas y gráficos', desc: 'Funciones avanzadas, referencias, gráficos y formato condicional.', udRef: 3, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 4: Presentación multimedia', desc: 'Presentación con normas de composición, transiciones y multimedia.', udRef: 4, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 5: Gestión de correo y agenda', desc: 'Configuración de cuentas de correo, reglas, contactos y agenda.', udRef: 5, eval: EVAL_1, peso: 5 },
  { titulo: 'Práctica 6: Diseño de base de datos relacional', desc: 'Modelo entidad-relación y creación de tablas con relaciones.', udRef: 6, eval: EVAL_1, peso: 10 },
  { titulo: 'Práctica 7: Consultas, formularios e informes', desc: 'Manipulación con consultas, formularios e informes.', udRef: 8, eval: EVAL_2, peso: 15 },
  { titulo: 'Práctica 8: Retoque de imágenes digitales', desc: 'Manipulación básica y avanzada: capas, máscaras y filtros.', udRef: 10, eval: EVAL_2, peso: 10 },
  { titulo: 'Proyecto final: Edición de secuencias de vídeo', desc: 'Captura y edición de vídeo con transiciones, audio y exportación.', udRef: 11, eval: EVAL_2, peso: 15 },
];
const APIN_EXAMENES = [
  { titulo: 'Examen 1ª Eval: Procesador de textos y hoja de cálculo', desc: 'Documentos, plantillas, hojas de cálculo con funciones y gráficos.', udRef: 3, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen 1ª Eval: Presentaciones, correo y bases de datos', desc: 'Presentaciones multimedia, gestión de correo y diseño de BD.', udRef: 7, eval: EVAL_1, tipo: 'parcial' },
  { titulo: 'Examen final: Bases de datos, imagen y vídeo', desc: 'BD, imágenes digitales y secuencias de vídeo.', udRef: 11, eval: EVAL_2, tipo: 'final', esFinal: true },
];

// ========================================================================
//  ALUMNOS SMR (20 del Excel)
// ========================================================================
const ALUMNOS_SMR = [
  { nombre: "Hodei", apellidos: "Agirrezabala Iriondo", email: "hodei.agirrezabala@ikasle.eus" },
  { nombre: "Laia", apellidos: "Azkarate Mendiburu", email: "laia.azkarate@ikasle.eus" },
  { nombre: "Asier", apellidos: "Badiola Egiguren", email: "asier.badiola@ikasle.eus" },
  { nombre: "June", apellidos: "Diaz de Gereñu Altuna", email: "june.diaz@ikasle.eus" },
  { nombre: "Beñat", apellidos: "Elustondo Zubimendi", email: "benat.elustondo@ikasle.eus" },
  { nombre: "Ane", apellidos: "Fernandez Gorostidi", email: "ane.fernandez@ikasle.eus" },
  { nombre: "Oihan", apellidos: "Gaztañaga Rezola", email: "oihan.gaztanaga@ikasle.eus" },
  { nombre: "Maddi", apellidos: "Harreguy Lazkano", email: "maddi.harreguy@ikasle.eus" },
  { nombre: "Julen", apellidos: "Irazusta Olaziregi", email: "julen.irazusta@ikasle.eus" },
  { nombre: "Nora", apellidos: "Jauregui Sasiain", email: "nora.jauregui@ikasle.eus" },
  { nombre: "Iker", apellidos: "Kortajarena Urbieta", email: "iker.kortajarena@ikasle.eus" },
  { nombre: "Eider", apellidos: "Lertxundi Amezaga", email: "eider.lertxundi@ikasle.eus" },
  { nombre: "Aimar", apellidos: "Mitxelena Garmendia", email: "aimar.mitxelena@ikasle.eus" },
  { nombre: "Haizea", apellidos: "Noain Etxeberria", email: "haizea.noain@ikasle.eus" },
  { nombre: "Danel", apellidos: "Olaskoaga Pikabea", email: "danel.olaskoaga@ikasle.eus" },
  { nombre: "Saioa", apellidos: "Pagola Intxausti", email: "saioa.pagola@ikasle.eus" },
  { nombre: "Telmo", apellidos: "Rezabal Urretabizkaia", email: "telmo.rezabal@ikasle.eus" },
  { nombre: "Izadi", apellidos: "Soraluze Artetxe", email: "izadi.soraluze@ikasle.eus" },
  { nombre: "Peio", apellidos: "Txoperena Aizpuru", email: "peio.txoperena@ikasle.eus" },
  { nombre: "Alazne", apellidos: "Zubizarreta Otaño", email: "alazne.zubizarreta@ikasle.eus" },
];

// ========================================================================
//  MÓDULOS SMR ADICIONALES
// ========================================================================
const MODULOS_SMR = [
  { abreviatura: 'SERED', nombre: 'Servicios en Red', horasSemanales: 6 },
  { abreviatura: 'SEGI',  nombre: 'Seguridad Informática', horasSemanales: 5 },
  { abreviatura: 'SGBD',  nombre: 'Aplicaciones Web', horasSemanales: 6 },
  { abreviatura: 'EIE',   nombre: 'Empresa e Iniciativa Emprendedora', horasSemanales: 3 },
  { abreviatura: 'HLC',   nombre: 'Horas de Libre Configuración', horasSemanales: 3 },
];

// Franjas horario
const FRANJAS = ['08:30-09:25','09:25-10:20','10:20-11:15','11:45-12:40','12:40-13:35','13:35-14:30'];
const DIAS = ['lunes','martes','miercoles','jueves','viernes'];

// ========================================================================
//  GENERADOR DE PROGRAMACIÓN (reutilizable para ambos módulos)
// ========================================================================
function generarProgramacion(uds, tareas, examenes, moduloId, grupoId, profesorId, fechaInicio, fechaFin) {
  const base = { moduloId, grupoId, profesorId };
  const horasTotal = uds.reduce((s, u) => s + u.horas, 0);
  const diasTotales = Math.round((fechaFin - fechaInicio) / MS_DIA);

  // Calcular tramos por UD
  const tramo = {};
  let acum = 0;
  for (const ud of uds) {
    const fInicio = fechaProporcional(fechaInicio, fechaFin, acum / horasTotal);
    acum += ud.horas;
    const fFin = fechaProporcional(fechaInicio, fechaFin, acum / horasTotal);
    tramo[ud.n] = { inicio: fInicio, fin: fFin };
  }

  // 1. Eventos TEMA
  const eventos = uds.map(ud => ({
    ...base, cursoAcademico: CURSO, evaluacion: ud.eval, tipo: 'tema',
    titulo: ud.titulo, descripcion: `${ud.horas}h`,
    fechaInicio: Timestamp.fromDate(tramo[ud.n].inicio),
    fechaFin: Timestamp.fromDate(tramo[ud.n].fin),
    color: COLOR.tema, createdAt: nowTs(), updatedAt: nowTs(),
  }));

  // 2. Tareas + eventos actividad
  const tareasDocs = [], eventosTareas = [];
  for (const t of tareas) {
    const tr = tramo[t.udRef] || tramo[0];
    const fEntrega = new Date(tr.fin); fEntrega.setHours(9, 0, 0, 0);
    const fPub = new Date(tr.inicio);
    tareasDocs.push({
      ...base, titulo: t.titulo, descripcion: t.desc,
      resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fechaPublicacion: Timestamp.fromDate(fPub),
      fechaEntrega: Timestamp.fromDate(fEntrega),
      puntuacionMaxima: 10, porcentajeNotaFinal: t.peso,
      penalizacionRetraso: 20, permiteEntregaTardia: true,
      esGrupal: false, requiereArchivo: true,
      evaluacion: t.eval, publicada: true, archivada: false,
      entregas: [], adjuntos: [], createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosTareas.push({
      ...base, cursoAcademico: CURSO, evaluacion: t.eval, tipo: 'actividad',
      titulo: t.titulo, descripcion: `Entrega · ${t.peso}% · ${t.desc}`,
      fechaInicio: Timestamp.fromDate(fEntrega),
      color: COLOR.actividad, createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  // 3. Exámenes + eventos examen
  const examenesDocs = [], eventosExamenes = [];
  for (const ex of (examenes || [])) {
    let fEx;
    if (ex.esFinal) { fEx = new Date(fechaFin); }
    else { fEx = new Date((tramo[ex.udRef] || tramo[0]).fin); }
    fEx.setHours(9, 0, 0, 0);
    examenesDocs.push({
      ...base, titulo: ex.titulo, descripcion: ex.desc, tipo: ex.tipo,
      evaluacion: ex.eval, resultadosAprendizajeIds: [], criteriosEvaluacionIds: [],
      fecha: Timestamp.fromDate(fEx), horaInicio: '09:00', horaFin: '11:00',
      aula: 'Aula SMR', duracionMinutos: 120, puntuacionMaxima: 10,
      porcentajeNotaFinal: ex.tipo === 'final' ? 40 : 30,
      notaMinimaAprobado: 5, tienePonderacion: false,
      publicado: true, resultadosPublicados: false,
      permiteRecuperacion: true, calificaciones: [],
      createdAt: nowTs(), updatedAt: nowTs(),
    });
    eventosExamenes.push({
      ...base, cursoAcademico: CURSO, evaluacion: ex.eval, tipo: 'examen',
      titulo: ex.titulo, descripcion: `${ex.tipo} · 10 pts`,
      fechaInicio: Timestamp.fromDate(fEx),
      color: COLOR.examen, createdAt: nowTs(), updatedAt: nowTs(),
    });
  }

  return {
    eventos: [...eventos, ...eventosTareas, ...eventosExamenes],
    tareas: tareasDocs,
    examenes: examenesDocs,
  };
}

// ========================================================================
//  MAIN
// ========================================================================
async function run() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  RESTAURAR APIN + PROY · DATOS COMPLETOS`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT (escribe en Firestore)' : '🔍 DRY-RUN (solo simula)'}`);
  console.log(`${'═'.repeat(64)}`);
  initFirebase();

  // ══════════════════════════════════════════════════════════════
  //  FASE 1 · Detectar DWEC / DAW2
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 1 · Detectar DWEC y DAW2 ──');
  let dwec = null, daw2 = null;
  const modsSnap = await db.collection('modulos').get();
  modsSnap.forEach(d => {
    const m = d.data();
    if (!dwec && norm(m.abreviatura) === 'dwec') dwec = { id: d.id, ...m };
  });
  const gruposSnap = await db.collection('grupos').get();
  gruposSnap.forEach(d => {
    const g = d.data();
    if (!daw2 && norm(g.nombre) === 'daw2') daw2 = { id: d.id, ...g };
  });
  if (!dwec) { console.error('❌ No se encontró DWEC. ¿Restauraste la copia de seguridad?'); process.exit(1); }
  if (!daw2) { console.error('❌ No se encontró el grupo DAW2.'); process.exit(1); }
  const profesorId = dwec.profesorId || '';
  const centroId = dwec.centroId || daw2.centroId || '';
  const dawCicloId = dwec.cicloId || daw2.cicloId || '';
  console.log(`   ✓ DWEC: ${dwec.id} (cicloId: ${dawCicloId})`);
  console.log(`   ✓ DAW2: ${daw2.id} (profesorId: ${profesorId})`);

  // Verificar que PROY no existe ya
  let proyExiste = null;
  modsSnap.forEach(d => {
    const m = d.data();
    if (!proyExiste && norm(m.abreviatura) === 'proy') proyExiste = { id: d.id, ...m };
  });
  // Verificar que APIN no existe ya
  let apinExiste = null;
  modsSnap.forEach(d => {
    const m = d.data();
    if (!apinExiste && norm(m.abreviatura) === 'apin') apinExiste = { id: d.id, ...m };
  });

  // ══════════════════════════════════════════════════════════════
  //  FASE 2 · Crear PROY + programación + tareas
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 2 · Módulo PROY para DAW2 ──');
  let proyId;
  if (proyExiste) {
    proyId = proyExiste.id;
    console.log(`   ✓ PROY ya existe (${proyId}), no se recrea.`);
  } else {
    console.log('   Creando módulo PROY...');
    if (COMMIT) {
      const ref = await db.collection('modulos').add({
        abreviatura: 'PROY', nombre: 'Proyecto', horasSemanales: 5,
        cicloId: dawCicloId, centroId, profesorId, curso: 2,
        descripcion: 'Proyecto fin de ciclo DAW', activo: true,
        cursoAcademico: CURSO, createdAt: nowTs(), updatedAt: nowTs(),
      });
      proyId = ref.id;
      console.log(`   ✓ PROY creado (${proyId})`);
    } else {
      proyId = '(nuevo-proy)';
      console.log(`   [DRY] Se crearía PROY con cicloId=${dawCicloId}`);
    }
  }

  // Programación PROY
  const proyInicio = new Date(2025, 8, 7); // 7 sept 2025
  const proyFin = new Date(2026, 1, 28);   // 28 feb 2026
  const proyData = generarProgramacion(PROY_UDS, PROY_TAREAS, [], proyId, daw2.id, profesorId, proyInicio, proyFin);
  console.log(`   Eventos: ${proyData.eventos.length}, Tareas: ${proyData.tareas.length}`);
  if (COMMIT) {
    await escribirBatch('eventos_programacion', proyData.eventos);
    await escribirBatch('tareas', proyData.tareas);
  }

  // ══════════════════════════════════════════════════════════════
  //  FASE 3 · Crear ciclo SMR + grupo SM2 + módulo APIN
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 3 · Ciclo SMR + Grupo SM2 + APIN ──');

  // Crear ciclo SMR (o reusar si existe)
  let smrCicloId = null;
  const ciclosSnap = await db.collection('ciclos').get();
  ciclosSnap.forEach(d => {
    const c = d.data();
    if (!smrCicloId && norm(c.nombre || c.abreviatura || '').includes('smr'))
      smrCicloId = d.id;
  });
  if (!smrCicloId) {
    console.log('   Creando ciclo SMR...');
    if (COMMIT) {
      const ref = await db.collection('ciclos').add({
        nombre: 'Sistemas Microinformáticos y Redes',
        abreviatura: 'SMR', grado: 'medio', familia: 'Informática y Comunicaciones',
        centroId, activo: true, createdAt: nowTs(), updatedAt: nowTs(),
      });
      smrCicloId = ref.id;
      console.log(`   ✓ Ciclo SMR creado (${smrCicloId})`);
    } else {
      smrCicloId = '(nuevo-ciclo-smr)';
      console.log('   [DRY] Se crearía ciclo SMR');
    }
  } else {
    console.log(`   ✓ Ciclo SMR ya existe (${smrCicloId})`);
  }

  // Crear grupo SM2 (o reusar)
  let sm2 = null;
  gruposSnap.forEach(d => {
    const g = d.data();
    if (!sm2 && (norm(g.nombre) === 'sm2' || norm(g.nombre) === 'sm1'))
      sm2 = { id: d.id, ref: d.ref, ...g };
  });
  let sm2Id;
  if (sm2) {
    sm2Id = sm2.id;
    console.log(`   ✓ Grupo ${sm2.nombre} ya existe (${sm2Id})`);
    // Asegurar nombre y cicloId
    if (COMMIT && (sm2.nombre !== 'SM2' || sm2.cicloId !== smrCicloId)) {
      await db.collection('grupos').doc(sm2Id).update({
        nombre: 'SM2', cicloId: smrCicloId, updatedAt: nowTs()
      });
      console.log('   ✓ Actualizado nombre→SM2, cicloId→' + smrCicloId);
    }
  } else {
    console.log('   Creando grupo SM2...');
    if (COMMIT) {
      const ref = await db.collection('grupos').add({
        nombre: 'SM2', curso: 2, letra: '', cicloId: smrCicloId,
        cicloNombre: 'Sistemas Microinformáticos y Redes',
        centroId, tutorId: profesorId, cursoAcademico: CURSO,
        turno: 'mañana', aula: 'Aula SMR', alumnosIds: [],
        modulosIds: [], activo: true,
        createdAt: nowTs(), updatedAt: nowTs(),
      });
      sm2Id = ref.id;
      console.log(`   ✓ Grupo SM2 creado (${sm2Id})`);
    } else {
      sm2Id = '(nuevo-sm2)';
      console.log('   [DRY] Se crearía grupo SM2');
    }
  }

  // Crear módulo APIN
  let apinId;
  if (apinExiste) {
    apinId = apinExiste.id;
    console.log(`   ✓ APIN ya existe (${apinId})`);
    if (COMMIT && apinExiste.cicloId !== smrCicloId) {
      await db.collection('modulos').doc(apinId).update({ cicloId: smrCicloId, updatedAt: nowTs() });
      console.log('   ✓ cicloId de APIN ajustado');
    }
  } else {
    console.log('   Creando módulo APIN...');
    if (COMMIT) {
      const ref = await db.collection('modulos').add({
        abreviatura: 'APIN', nombre: 'Aplicaciones Ofimáticas', horasSemanales: 7,
        cicloId: smrCicloId, centroId, profesorId, curso: 2,
        descripcion: 'Aplicaciones informáticas para la gestión ofimática',
        activo: true, cursoAcademico: CURSO,
        createdAt: nowTs(), updatedAt: nowTs(),
      });
      apinId = ref.id;
      console.log(`   ✓ APIN creado (${apinId})`);
    } else {
      apinId = '(nuevo-apin)';
      console.log('   [DRY] Se crearía APIN');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  FASE 4 · Módulos SMR adicionales
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 4 · Módulos SMR adicionales ──');
  const moduloIdPorAbrev = { APIN: apinId };
  for (const m of MODULOS_SMR) {
    let existe = null;
    modsSnap.forEach(d => {
      const x = d.data();
      if (!existe && norm(x.abreviatura) === norm(m.abreviatura)) existe = { id: d.id, ...x };
    });
    if (existe) {
      moduloIdPorAbrev[m.abreviatura] = existe.id;
      console.log(`   ✓ ${m.abreviatura}: existe (${existe.id})`);
      if (COMMIT && existe.cicloId !== smrCicloId) {
        await db.collection('modulos').doc(existe.id).update({ cicloId: smrCicloId, updatedAt: nowTs() });
      }
    } else {
      console.log(`   + ${m.abreviatura}: ${m.nombre} (${m.horasSemanales}h)`);
      if (COMMIT) {
        const ref = await db.collection('modulos').add({
          abreviatura: m.abreviatura, nombre: m.nombre,
          horasSemanales: m.horasSemanales, cicloId: smrCicloId,
          centroId, profesorId, descripcion: '', activo: true,
          cursoAcademico: CURSO, createdAt: nowTs(), updatedAt: nowTs(),
        });
        moduloIdPorAbrev[m.abreviatura] = ref.id;
        console.log(`     ✓ ${m.abreviatura} creado (${ref.id})`);
      } else { moduloIdPorAbrev[m.abreviatura] = `(nuevo-${m.abreviatura})`; }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  FASE 5 · Importar 20 alumnos SMR
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 5 · Alumnos SMR ──');
  // Verificar si ya existen alumnos en SM2
  const alExistSnap = await db.collection('alumnos').where('grupoId', '==', sm2Id).get();
  if (alExistSnap.size > 0) {
    console.log(`   Ya hay ${alExistSnap.size} alumnos en el grupo. No se importan más.`);
  } else {
    const alumnosDocs = ALUMNOS_SMR.map(a => ({
      nombre: a.nombre, apellidos: a.apellidos, email: a.email,
      grupoId: sm2Id, centroId, cursoAcademico: CURSO,
      estado: 'activo', fotoUrl: '',
      createdAt: nowTs(), updatedAt: nowTs(),
    }));
    console.log(`   Importando ${alumnosDocs.length} alumnos...`);
    if (COMMIT) {
      const ids = await escribirBatch('alumnos', alumnosDocs);
      // Actualizar alumnosIds en el grupo
      await db.collection('grupos').doc(sm2Id).update({ alumnosIds: ids, updatedAt: nowTs() });
      console.log(`   ✓ alumnosIds actualizado en grupo SM2`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  FASE 6 · Programación APIN (12 UDs + tareas + exámenes)
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 6 · Programación APIN ──');
  const apinInicio = new Date(2025, 8, 7);  // 7 sept 2025
  const apinFin = new Date(2026, 1, 15);    // 15 feb 2026
  const apinData = generarProgramacion(APIN_UDS, APIN_TAREAS, APIN_EXAMENES, apinId, sm2Id, profesorId, apinInicio, apinFin);
  console.log(`   Eventos: ${apinData.eventos.length}, Tareas: ${apinData.tareas.length}, Exámenes: ${apinData.examenes.length}`);
  if (COMMIT) {
    await escribirBatch('eventos_programacion', apinData.eventos);
    await escribirBatch('tareas', apinData.tareas);
    await escribirBatch('examenes', apinData.examenes);
  }

  // ══════════════════════════════════════════════════════════════
  //  FASE 7 · Horario embebido en SM2
  // ══════════════════════════════════════════════════════════════
  console.log('\n── FASE 7 · Horario SM2 ──');
  const bolsa = [];
  bolsa.push(...Array(7).fill('APIN'));
  for (const m of MODULOS_SMR) bolsa.push(...Array(m.horasSemanales).fill(m.abreviatura));
  // Barajar determinista
  let seed = 2026;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = bolsa.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
  }
  const horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
  let k = 0;
  for (const dia of DIAS) {
    for (const franja of FRANJAS) {
      if (k >= bolsa.length) break;
      const abrev = bolsa[k++];
      const [hi, hf] = franja.split('-');
      horario[dia].push({
        horaInicio: hi, horaFin: hf,
        moduloId: moduloIdPorAbrev[abrev] || '',
        moduloAbreviatura: abrev, profesorId, aula: 'Aula SMR'
      });
    }
  }
  for (const dia of DIAS) {
    console.log(`   ${dia.padEnd(10)}: ${horario[dia].map(f => f.moduloAbreviatura).join(' · ')}`);
  }
  if (COMMIT) {
    await db.collection('grupos').doc(sm2Id).update({ horario, updatedAt: nowTs() });
    console.log('   ✓ Horario escrito en SM2');
  }

  // ══════════════════════════════════════════════════════════════
  //  RESUMEN
  // ══════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(64)}`);
  if (!COMMIT) {
    console.log('  🔍 DRY-RUN: no se ha escrito nada.');
    console.log('  Ejecuta con --commit para crear todos los datos.\n');
  } else {
    console.log('  ✅ RESTAURACIÓN COMPLETADA');
    console.log('  · Módulo PROY (DAW2): programación + tareas');
    console.log('  · Ciclo SMR + Grupo SM2 + 20 alumnos');
    console.log('  · Módulo APIN: programación + tareas + exámenes');
    console.log('  · Módulos SMR: SERED, SEGI, SGBD, EIE, HLC');
    console.log('  · Horario SM2 completo');
    console.log('\n  Recarga el Dashboard para ver los cuadernos.\n');
  }
}

run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
