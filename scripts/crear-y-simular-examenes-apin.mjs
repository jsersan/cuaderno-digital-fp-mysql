#!/usr/bin/env node
/**
 * simular-notas-apin.mjs  (campos validados contra @core/models)
 * ==========================================================================
 * Simula EN CASCADA todas las notas de APIN / SM1 con distribución realista
 * (la mayoría aprueba, unos pocos suspenden y van a recuperación):
 *
 *   FASE 1 · Perfil por alumno      → bueno / medio / flojo
 *   FASE 2 · Exámenes               → calificaciones[]: CalificacionExamen
 *   FASE 3 · Tareas                 → entregas[]: EntregaTarea
 *   FASE 4 · Recuperaciones         → Recuperacion con AlumnoRecuperacion[]
 *   FASE 5 · Calificaciones finales → Calificacion (una por alumno y evaluación)
 *
 * Solo toca el módulo APIN del grupo SM1. No crea alumnos ni exámenes.
 *
 * USO:
 *   node scripts/simular-notas-apin.mjs                 # DRY-RUN (no escribe)
 *   node scripts/simular-notas-apin.mjs --commit        # escribe
 *   node scripts/simular-notas-apin.mjs --commit --limpiar   # borra notas previas
 *   node scripts/simular-notas-apin.mjs --seed=42
 * ==========================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMMIT  = process.argv.includes('--commit');
const LIMPIAR = process.argv.includes('--limpiar');
const SEED = (() => {
  const a = process.argv.find(x => x.startsWith('--seed='));
  return a ? (parseInt(a.split('=')[1], 10) || 2026) : 2026;
})();

const ABREV_MODULO = 'APIN';
const NOMBRE_GRUPO = 'SM1';
const CURSO = '2025-2026';
const EVAL_1 = '1ª Evaluación';
const EVAL_2 = '2ª Evaluación';
const NOTA_APROBADO = 5;
const NOTA_MAX_RECUP = 6;
const PESO_EXAMENES = 0.6, PESO_TAREAS = 0.3, PESO_ACTITUD = 0.1;
const ESTADO_TAREA = { CORREGIDA: 'corregida', NO_ENTREGADA: 'no_entregada' };

// ----- Catálogo de exámenes a CREAR -----
// UD evaluables (sin UD0 presentación). eval: 1=1ªEv, 2=2ªEv. Fecha = fin de su tramo.
const UD_EXAMENES = [
  { ud: 1,  titulo:'Examen UD1: Instalación de aplicaciones ofimáticas', evalNum:1 },
  { ud: 2,  titulo:'Examen UD2: Elaboración de documentos y plantillas', evalNum:1 },
  { ud: 3,  titulo:'Examen UD3: Elaboración de hojas de cálculo', evalNum:1 },
  { ud: 4,  titulo:'Examen UD4: Elaboración de presentaciones', evalNum:1 },
  { ud: 5,  titulo:'Examen UD5: Gestión de correo y agenda electrónica', evalNum:1 },
  { ud: 6,  titulo:'Examen UD6: Diseño de una base de datos relacional', evalNum:1 },
  { ud: 7,  titulo:'Examen UD7: Definición y manipulación de BBDD (I)', evalNum:1 },
  { ud: 8,  titulo:'Examen UD8: Definición y manipulación de BBDD (II)', evalNum:2 },
  { ud: 9,  titulo:'Examen UD9: Manipulación básica de imágenes', evalNum:2 },
  { ud: 10, titulo:'Examen UD10: Manipulación avanzada de imágenes', evalNum:2 },
  { ud: 11, titulo:'Examen UD11: Manipulación de secuencias de vídeo', evalNum:2 },
];
// Exámenes finales. tipo final. Fechas fijas.
const FINALES = [
  { titulo:'Examen final 1ª Evaluación', evalNum:1, fecha:new Date(2025,11,18,9,0,0), tipo:'final' },
  { titulo:'Examen final 2ª Evaluación', evalNum:2, fecha:new Date(2026,1,12,9,0,0),  tipo:'final' },
  { titulo:'Examen final ordinario del módulo', evalNum:2, fecha:new Date(2026,1,15,9,0,0), tipo:'final' },
];

// Horas por UD (para repartir fechas igual que la programación: 7-sep → 15-feb)
const HORAS_UD = { 0:1,1:6,2:21,3:28,4:14,5:7,6:21,7:28,8:28,9:28,10:21,11:28 };
const FECHA_INI = new Date(2025,8,7), FECHA_FIN = new Date(2026,1,15), MS_DIA = 864e5;
const DIAS_TOT = Math.round((FECHA_FIN-FECHA_INI)/MS_DIA);
const HORAS_TOTAL = Object.values(HORAS_UD).reduce((s,h)=>s+h,0);
function fechaFinUD(udNum){
  let acum=0; for(let i=0;i<=udNum;i++) acum+=HORAS_UD[i];
  const dias = Math.round(acum/HORAS_TOTAL*(DIAS_TOT-1));
  const f = new Date(FECHA_INI.getTime()+dias*MS_DIA); f.setHours(9,0,0,0); return f;
}

function makeRng(seed){let a=seed>>>0;return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rng = makeRng(SEED);
const rand = (min, max) => min + rng() * (max - min);
const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const media = arr => arr && arr.length ? arr.reduce((s,n)=>s+n,0)/arr.length : 0;

function perfilAleatorio(){
  const r = rng();
  if (r < 0.65) return { tipo:'bueno', media:7.5, sd:1.2 };
  if (r < 0.90) return { tipo:'medio', media:5.8, sd:1.4 };
  return { tipo:'flojo', media:3.8, sd:1.5 };
}
function notaPerfil(p){
  const u1 = Math.max(rng(),1e-9), u2 = rng();
  const z = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
  return round1(clamp(p.media + z*p.sd, 0, 10));
}

let db;
function initFirebase(){
  const saPath = join(__dirname, 'serviceAccount.json');
  let sa; try { sa = JSON.parse(readFileSync(saPath,'utf8')); }
  catch { console.error(`\n❌ No se encontró ${saPath}\n`); process.exit(1); }
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}
const norm = s => (s||'').toString().trim().toLowerCase();

async function localizar(){
  let modulo=null;
  (await db.collection('modulos').get()).forEach(d=>{const m=d.data();
    if(!modulo && (norm(m.abreviatura)===norm(ABREV_MODULO)||norm(m.nombre).includes('ofim'))) modulo={id:d.id,...m};});
  let grupo=null;
  (await db.collection('grupos').get()).forEach(d=>{const g=d.data();
    if(!grupo && norm(g.nombre)===norm(NOMBRE_GRUPO)) grupo={id:d.id,...g};});
  if(!modulo){console.error(`❌ No existe el módulo ${ABREV_MODULO}`);process.exit(1);}
  if(!grupo){console.error(`❌ No existe el grupo ${NOMBRE_GRUPO}`);process.exit(1);}
  return {modulo,grupo};
}

async function run(){
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  CREAR + SIMULAR EXÁMENES APIN / SM1  ·  semilla ${SEED}`);
  console.log(`  Modo: ${COMMIT?'COMMIT (escribe)':'DRY-RUN (no escribe)'}${LIMPIAR?' + LIMPIAR':''}`);
  console.log(`${'='.repeat(64)}`);

  initFirebase();
  const {modulo,grupo} = await localizar();
  const M=modulo.id, G=grupo.id, PROF=modulo.profesorId||'';
  console.log(`✓ Módulo APIN: ${M}\n✓ Grupo SM1:  ${G}`);

  const aSnap = await db.collection('alumnos').where('grupoId','==',G).get();
  const alumnos=[];
  aSnap.forEach(d=>{const a=d.data();
    if((a.matriculas||[]).some(m=>m.moduloId===M))
      alumnos.push({id:d.id, nombre:a.nombre, apellidos:a.apellidos, full:`${a.apellidos}, ${a.nombre}`});});
  console.log(`✓ Alumnos matriculados en APIN: ${alumnos.length}`);
  if(!alumnos.length){console.error('❌ Sin alumnos.');process.exit(1);}

  // ===== FASE 0 — CREAR EXÁMENES =====
  if(LIMPIAR && COMMIT){
    const prevEx = await db.collection('examenes').where('moduloId','==',M).where('grupoId','==',G).get();
    const b=db.batch(); prevEx.forEach(d=>b.delete(d.ref)); await b.commit();
    console.log(`\n🧹 Exámenes previos borrados: ${prevEx.size}`);
  }

  const evalNombre = n => n===1 ? EVAL_1 : EVAL_2;
  const examenesACrear = [];
  for(const e of UD_EXAMENES){
    examenesACrear.push({
      titulo:e.titulo,
      descripcion:`Prueba de la unidad didáctica ${e.ud} del módulo de Aplicaciones Ofimáticas.`,
      moduloId:M, grupoId:G, profesorId:PROF,
      tipo:'parcial', evaluacion:evalNombre(e.evalNum),
      resultadosAprendizajeIds:[], criteriosEvaluacionIds:[],
      fecha: Timestamp.fromDate(fechaFinUD(e.ud)),
      horaInicio:'09:00', horaFin:'10:00', aula:'Aula SMR', duracionMinutos:60,
      puntuacionMaxima:10, porcentajeNotaFinal:0, notaMinimaAprobado:NOTA_APROBADO,
      tienePonderacion:false, publicado:true, resultadosPublicados:false,
      permiteRecuperacion:true, calificaciones:[],
      createdAt:Timestamp.now(), updatedAt:Timestamp.now()
    });
  }
  for(const f of FINALES){
    examenesACrear.push({
      titulo:f.titulo,
      descripcion:`${f.titulo} del módulo de Aplicaciones Ofimáticas.`,
      moduloId:M, grupoId:G, profesorId:PROF,
      tipo:f.tipo, evaluacion:evalNombre(f.evalNum),
      resultadosAprendizajeIds:[], criteriosEvaluacionIds:[],
      fecha: Timestamp.fromDate(f.fecha),
      horaInicio:'09:00', horaFin:'11:00', aula:'Aula SMR', duracionMinutos:120,
      puntuacionMaxima:10, porcentajeNotaFinal:0, notaMinimaAprobado:NOTA_APROBADO,
      tienePonderacion:false, publicado:true, resultadosPublicados:false,
      permiteRecuperacion:false, calificaciones:[],
      createdAt:Timestamp.now(), updatedAt:Timestamp.now()
    });
  }
  console.log(`\n🆕 FASE 0 · Exámenes a CREAR: ${examenesACrear.length} (${UD_EXAMENES.length} de UD + ${FINALES.length} finales)`);

  if(COMMIT){
    let cb=db.batch(), cn=0;
    for(const ex of examenesACrear){ cb.set(db.collection('examenes').doc(), ex); if(++cn%400===0){await cb.commit();cb=db.batch();} }
    await cb.commit();
    console.log(`   ✓ creados ${examenesACrear.length} exámenes`);
  } else {
    console.log('   (DRY-RUN: no se crean; se simularían notas sobre estos)');
  }

  // Releer exámenes
  let examenes;
  if(COMMIT){
    const exSnap = await db.collection('examenes').where('moduloId','==',M).where('grupoId','==',G).get();
    examenes = exSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}));
  } else {
    examenes = examenesACrear.map((e,i)=>({id:`(nuevo-${i})`, ref:null, ...e}));
  }
  const tSnap = await db.collection('tareas').where('moduloId','==',M).where('grupoId','==',G).get();
  const tareas = tSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}));
  console.log(`✓ Exámenes: ${examenes.length} · Tareas: ${tareas.length}`);

  // FASE 1
  const perfil={}; for(const a of alumnos) perfil[a.id]=perfilAleatorio();
  console.log('\n📊 FASE 1 · Perfiles:',
    ['bueno','medio','flojo'].map(t=>`${t}=${Object.values(perfil).filter(p=>p.tipo===t).length}`).join('  '));

  // FASE 2 — Exámenes → CalificacionExamen
  const notaExPorEval={}, suspExPorEval={};
  const examenUpdates=[];
  for(const ex of examenes){
    const ev = ex.evaluacion||EVAL_1;
    const min = ex.notaMinimaAprobado ?? NOTA_APROBADO;
    notaExPorEval[ev] ||= {}; suspExPorEval[ev] ||= new Map();
    const calificaciones = alumnos.map(a=>{
      const nota = notaPerfil(perfil[a.id]);
      (notaExPorEval[ev][a.id] ||= []).push(nota);
      const necesitaRec = nota < min;
      if(necesitaRec){
        const prev = suspExPorEval[ev].get(a.id);
        if(prev===undefined || nota<prev) suspExPorEval[ev].set(a.id, nota);
      }
      return {
        alumnoId: a.id,
        alumnoNombre: a.full,
        nota,
        noPresente: false,
        observaciones: '',
        fechaCalificacion: Timestamp.now(),
        necesitaRecuperacion: necesitaRec
      };
    });
    examenUpdates.push({ref:ex.ref, titulo:ex.titulo, evaluacion:ev, calificaciones});
  }

  // FASE 3 — Tareas → EntregaTarea
  const notaTaPorEval={};
  const tareaUpdates=[];
  for(const t of tareas){
    const ev = t.evaluacion||EVAL_1;
    notaTaPorEval[ev] ||= {};
    const entregas = alumnos.map(a=>{
      const p = perfil[a.id];
      const noEntrega = rng() < (p.tipo==='flojo'?0.18:0.04);
      const nota = round1(clamp(notaPerfil(p)+0.5,0,10));
      (notaTaPorEval[ev][a.id] ||= []).push(noEntrega?0:nota);
      if(noEntrega){
        return { alumnoId:a.id, alumnoNombre:a.full, estado:ESTADO_TAREA.NO_ENTREGADA,
          nota:0, observaciones:'No entregada', archivos:[] };
      }
      return { alumnoId:a.id, alumnoNombre:a.full, fechaEntrega:Timestamp.now(),
        estado:ESTADO_TAREA.CORREGIDA, nota, observaciones:'', archivos:[],
        corregidoPor:PROF, fechaCorreccion:Timestamp.now() };
    });
    tareaUpdates.push({ref:t.ref, titulo:t.titulo, evaluacion:ev, entregas});
  }

  // FASE 4 — Recuperaciones → Recuperacion / AlumnoRecuperacion
  const recuperaciones=[]; const recuperoOk={};
  for(const [ev, mapa] of Object.entries(suspExPorEval)){
    if(!mapa.size) continue;
    recuperoOk[ev] ||= new Set();
    const alumnosConvocados = [...mapa.entries()].map(([aid, notaOrig])=>{
      const a = alumnos.find(x=>x.id===aid);
      const aprueba = rng() < 0.7;
      if(aprueba) recuperoOk[ev].add(aid);
      const notaRec = aprueba ? round1(rand(5, NOTA_MAX_RECUP)) : round1(rand(2.5,4.8));
      return { alumnoId:aid, alumnoNombre:a?.full||aid, notaOriginal:notaOrig,
        notaRecuperacion:notaRec, estado: aprueba?'aprobado':'suspenso', observaciones:'' };
    });
    recuperaciones.push({
      titulo:`Recuperación ${ev}: APIN`,
      descripcion:`Recuperación de la ${ev} del módulo de Aplicaciones Ofimáticas.`,
      moduloId:M, grupoId:G, profesorId:PROF,
      evaluacion:ev, tipoRecuperacion:'examen',
      resultadosAprendizajeIds:[], criteriosEvaluacionIds:[],
      fecha: Timestamp.fromDate(new Date(2026,1,18,9,0,0)),
      horaInicio:'09:00', horaFin:'11:00',
      puntuacionMaxima:10, notaMaximaRecuperacion:NOTA_MAX_RECUP, notaMinimaAprobado:NOTA_APROBADO,
      alumnosConvocados, publicada:true, resultadosPublicados:true,
      createdAt:Timestamp.now(), updatedAt:Timestamp.now()
    });
  }

  // FASE 5 — Calificaciones finales → Calificacion (por alumno y evaluación)
  const calificacionesFinales=[];
  for(const ev of [EVAL_1, EVAL_2]){
    for(const a of alumnos){
      const exs = (notaExPorEval[ev]?.[a.id]||[]).slice();
      if(recuperoOk[ev]?.has(a.id) && exs.length){
        const idxMin = exs.indexOf(Math.min(...exs));
        exs[idxMin] = NOTA_APROBADO;
      }
      const tas = notaTaPorEval[ev]?.[a.id]||[];
      const actitud = round1(clamp(perfil[a.id].media + rand(-1,1.5),0,10));
      const nExam=round1(media(exs)), nTar=round1(media(tas));
      const calc = round1(clamp(nExam*PESO_EXAMENES + nTar*PESO_TAREAS + actitud*PESO_ACTITUD,0,10));
      calificacionesFinales.push({
        alumnoId:a.id, full:a.full,
        moduloId:M, grupoId:G, profesorId:PROF, cursoAcademico:CURSO,
        evaluacion:ev,
        notaExamenes:nExam, notaTareas:nTar, notaActitud:actitud, notaAsistencia:0,
        notaCalculada:calc, notaFinal:calc, aprobado: calc>=NOTA_APROBADO,
        notasPorRA:[], observaciones:'', necesitaRecuperacion: calc<NOTA_APROBADO,
        bloqueada:false, publicada:true,
        createdAt:Timestamp.now(), updatedAt:Timestamp.now()
      });
    }
  }

  // RESUMEN
  const finOf = ev => calificacionesFinales.filter(c=>c.evaluacion===ev);
  console.log('\n📋 RESUMEN A ESCRIBIR:');
  console.log(`   · Exámenes a actualizar: ${examenUpdates.length} (${alumnos.length} notas c/u)`);
  console.log(`   · Tareas a actualizar:   ${tareaUpdates.length} (${alumnos.length} entregas c/u)`);
  console.log(`   · Recuperaciones:        ${recuperaciones.length}`);
  recuperaciones.forEach(r=>console.log(`       - ${r.titulo}: ${r.alumnosConvocados.length} convocados, ${r.alumnosConvocados.filter(x=>x.estado==='aprobado').length} aprueban`));
  console.log(`   · Calificaciones finales: ${calificacionesFinales.length} (${finOf(EVAL_1).length} en 1ªEv + ${finOf(EVAL_2).length} en 2ªEv)`);
  for(const ev of [EVAL_1,EVAL_2]){
    const f=finOf(ev), ap=f.filter(c=>c.aprobado).length;
    console.log(`       ${ev}: aprobados ${ap}/${f.length} · media ${round1(media(f.map(c=>c.notaFinal)))}`);
  }
  console.log('\n   Muestra (1ª Ev, 6 alumnos):');
  finOf(EVAL_1).slice(0,6).forEach(c=>
    console.log(`     ${c.full.padEnd(34)} ex:${c.notaExamenes} ta:${c.notaTareas} ac:${c.notaActitud} → FINAL ${c.notaFinal} ${c.aprobado?'✓':'✗'}`));

  if(!COMMIT){
    console.log('\n🔍 DRY-RUN: no se ha escrito nada.');
    console.log('   Campos validados contra @core/models. Si te cuadra: --commit (o --commit --limpiar)\n');
    return;
  }

  if(LIMPIAR){
    console.log('\n🧹 Limpiando recuperaciones y calificaciones previas de APIN/SM1...');
    for(const col of ['recuperaciones','calificaciones']){
      const prev = await db.collection(col).where('moduloId','==',M).where('grupoId','==',G).get();
      const b=db.batch(); prev.forEach(d=>b.delete(d.ref)); await b.commit();
      console.log(`   ${col}: borrados ${prev.size}`);
    }
  }

  console.log('\n✍️  Escribiendo...');
  for(const u of examenUpdates) await u.ref.update({calificaciones:u.calificaciones, resultadosPublicados:true, updatedAt:Timestamp.now()});
  console.log(`   · exámenes: ${examenUpdates.length}`);
  for(const u of tareaUpdates) await u.ref.update({entregas:u.entregas, updatedAt:Timestamp.now()});
  console.log(`   · tareas: ${tareaUpdates.length}`);
  for(const r of recuperaciones) await db.collection('recuperaciones').add(r);
  console.log(`   · recuperaciones: ${recuperaciones.length}`);
  let b=db.batch(), n=0;
  for(const c of calificacionesFinales){
    const {full, ...doc} = c;
    const ref=db.collection('calificaciones').doc();
    b.set(ref, doc);
    if(++n%400===0){await b.commit();b=db.batch();}
  }
  await b.commit();
  console.log(`   · calificaciones finales: ${calificacionesFinales.length}`);
  console.log('\n✅ Notas simuladas correctamente.\n');
}
run().catch(e=>{console.error('\n❌ Error:',e.message);process.exit(1);});
