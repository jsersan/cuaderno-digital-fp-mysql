#!/usr/bin/env node
/**
 * crear-sm2-modulos-horario.mjs
 * ==========================================================================
 * En cascada para el grupo de 2º de SMR (validado contra horario.component.ts):
 *   FASE 1 · Renombrar el grupo SM1 → SM2
 *   FASE 2 · Crear los módulos de SMR que faltan (SERED, SEGI, SGBD, EIE, HLC)
 *            con el MISMO cicloId del grupo (clave: el horario filtra por cicloId).
 *            APIN ya existe (se le ajusta el cicloId si le falta).
 *   FASE 3 · Escribir el horario DENTRO del grupo: grupo.horario = { lunes:[...],
 *            martes:[...], ... } con objetos FranjaHoraria.
 *
 * Estructura confirmada en horario.component.ts:
 *   grupo.horario[dia] = FranjaHoraria[]
 *   FranjaHoraria = { horaInicio, horaFin, moduloId, moduloAbreviatura, profesorId, aula }
 *
 * USO:
 *   node scripts/crear-sm2-modulos-horario.mjs            # DRY-RUN
 *   node scripts/crear-sm2-modulos-horario.mjs --commit   # escribe
 * ==========================================================================
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

const CURSO = '2025-2026';
const NOMBRE_VIEJO = 'SM1';
const NOMBRE_NUEVO = 'SM2';

// Franjas (idénticas a franjasFijas del componente)
const FRANJAS = ['08:30-09:25','09:25-10:20','10:20-11:15','11:45-12:40','12:40-13:35','13:35-14:30'];
const DIAS = ['lunes','martes','miercoles','jueves','viernes'];

// Módulos SMR a crear (APIN ya existe). horas = horas semanales.
const MODULOS_SMR = [
  { abreviatura:'SERED', nombre:'Servicios en Red', horasSemanales:6 },
  { abreviatura:'SEGI',  nombre:'Seguridad Informática', horasSemanales:5 },
  { abreviatura:'SGBD',  nombre:'Aplicaciones Web', horasSemanales:6 },
  { abreviatura:'EIE',   nombre:'Empresa e Iniciativa Emprendedora', horasSemanales:3 },
  { abreviatura:'HLC',   nombre:'Horas de Libre Configuración', horasSemanales:3 },
];
const HORAS_APIN = 7; // 7+6+5+6+3+3 = 30 = 6 franjas × 5 días

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}
const norm = s => (s||'').toString().trim().toLowerCase();

async function run(){
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CREAR SM2 · MÓDULOS SMR · HORARIO`);
  console.log(`  Modo: ${COMMIT?'COMMIT (escribe)':'DRY-RUN (no escribe)'}`);
  console.log(`${'='.repeat(60)}`);
  initFirebase();

  // Localizar grupo (SM1 o ya SM2)
  let grupo=null;
  (await db.collection('grupos').get()).forEach(d=>{
    const g=d.data();
    if(!grupo && (norm(g.nombre)===norm(NOMBRE_VIEJO) || norm(g.nombre)===norm(NOMBRE_NUEVO)))
      grupo={id:d.id, ref:d.ref, ...g};
  });
  if(!grupo){ console.error(`❌ No existe el grupo ${NOMBRE_VIEJO} ni ${NOMBRE_NUEVO}`); process.exit(1); }
  const cicloId = grupo.cicloId || '';
  const aula = grupo.aula || '';
  console.log(`\n✓ Grupo: "${grupo.nombre}" (id: ${grupo.id})`);
  console.log(`  cicloId: ${cicloId || '⚠️ SIN cicloId (los módulos no se filtrarán por ciclo)'}`);

  // Localizar APIN
  let apin=null;
  (await db.collection('modulos').get()).forEach(d=>{
    const m=d.data();
    if(!apin && (norm(m.abreviatura)==='apin'||norm(m.nombre).includes('ofim'))) apin={id:d.id,ref:d.ref,...m};
  });
  if(!apin){ console.error('❌ No existe el módulo APIN'); process.exit(1); }
  console.log(`✓ Módulo APIN: ${apin.id} (cicloId actual: ${apin.cicloId||'-'})`);

  // Módulos existentes por abreviatura
  const modsExist = {};
  (await db.collection('modulos').get()).forEach(d=>{ const m=d.data(); modsExist[norm(m.abreviatura)]={id:d.id,ref:d.ref,...m}; });

  // ── FASE 1 · Renombrar grupo ──
  console.log('\n── FASE 1 · Renombrar grupo ──');
  if(norm(grupo.nombre)===norm(NOMBRE_NUEVO)){
    console.log(`   Ya se llama ${NOMBRE_NUEVO}.`);
  } else {
    console.log(`   ${grupo.nombre} → ${NOMBRE_NUEVO}`);
    if(COMMIT){ await grupo.ref.update({ nombre:NOMBRE_NUEVO, updatedAt:Timestamp.now() }); console.log('   ✓ renombrado'); }
  }

  // ── FASE 2 · Crear módulos SMR (con cicloId del grupo) ──
  console.log('\n── FASE 2 · Crear módulos SMR ──');
  const moduloIdPorAbrev = { APIN: apin.id };
  // Asegurar que APIN tiene el cicloId del grupo (si no, no saldría en el horario)
  if(cicloId && apin.cicloId !== cicloId){
    console.log(`   APIN: ajustando cicloId (${apin.cicloId||'-'} → ${cicloId})`);
    if(COMMIT) await apin.ref.update({ cicloId, updatedAt:Timestamp.now() });
  }
  for(const m of MODULOS_SMR){
    const ex = modsExist[norm(m.abreviatura)];
    if(ex){
      moduloIdPorAbrev[m.abreviatura]=ex.id;
      console.log(`   ${m.abreviatura}: ya existe (${ex.id})`);
      if(cicloId && ex.cicloId !== cicloId){
        console.log(`       ajustando cicloId (${ex.cicloId||'-'} → ${cicloId})`);
        if(COMMIT) await ex.ref.update({ cicloId, updatedAt:Timestamp.now() });
      }
    } else {
      console.log(`   ${m.abreviatura}: se creará (${m.nombre}, ${m.horasSemanales}h)`);
      if(COMMIT){
        const doc = {
          abreviatura:m.abreviatura, nombre:m.nombre, horasSemanales:m.horasSemanales,
          cicloId, cursoAcademico:CURSO, centroId: grupo.centroId||'',
          profesorId: apin.profesorId||'', descripcion:'', activo:true,
          createdAt:Timestamp.now(), updatedAt:Timestamp.now()
        };
        const ref = await db.collection('modulos').add(doc);
        moduloIdPorAbrev[m.abreviatura]=ref.id;
        console.log(`       ✓ creado (${ref.id})`);
      } else {
        moduloIdPorAbrev[m.abreviatura]='(nuevo)';
      }
    }
  }

  // ── FASE 3 · Horario embebido en el grupo ──
  console.log('\n── FASE 3 · Horario semanal ──');
  const profesorId = apin.profesorId || '';
  // Bolsa de horas
  const bolsa=[]; bolsa.push(...Array(HORAS_APIN).fill('APIN'));
  for(const m of MODULOS_SMR) bolsa.push(...Array(m.horasSemanales).fill(m.abreviatura));
  console.log(`   Horas: ${bolsa.length} · Rejilla: ${FRANJAS.length*DIAS.length}`);
  // Barajar determinista
  let seed=2026; const rng=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  for(let i=bolsa.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[bolsa[i],bolsa[j]]=[bolsa[j],bolsa[i]];}

  // Construir horario { dia: FranjaHoraria[] }
  const horario = { lunes:[], martes:[], miercoles:[], jueves:[], viernes:[] };
  let k=0;
  for(const dia of DIAS){
    for(const franja of FRANJAS){
      if(k>=bolsa.length) break;
      const abrev = bolsa[k++];
      const [hi,hf] = franja.split('-');
      horario[dia].push({
        horaInicio:hi, horaFin:hf,
        moduloId: moduloIdPorAbrev[abrev],
        moduloAbreviatura: abrev,
        profesorId,
        aula
      });
    }
  }
  // Vista previa
  for(const dia of DIAS){
    console.log(`     ${dia.padEnd(10)}: ${horario[dia].map(f=>f.moduloAbreviatura).join(' · ')}`);
  }

  if(COMMIT){
    await grupo.ref.update({ horario, updatedAt:Timestamp.now() });
    console.log('\n   ✓ horario escrito en el documento del grupo (campo "horario")');
  }

  if(!COMMIT){
    console.log('\n🔍 DRY-RUN: no se ha escrito nada.');
    console.log('   Estructura validada contra horario.component.ts (horario embebido en grupo,');
    console.log('   módulos filtrados por cicloId). Si te cuadra: --commit\n');
  } else {
    console.log('\n✅ Hecho. Abre Horario con el cuaderno APIN/SM2 activo para verlo.\n');
  }
}
run().catch(e=>{console.error('\n❌ Error:',e.message);process.exit(1);});
