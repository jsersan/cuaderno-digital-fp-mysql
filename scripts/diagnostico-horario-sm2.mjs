#!/usr/bin/env node
/**
 * diagnostico-horario-sm2.mjs  (SOLO LEE)
 * --------------------------------------------------------------------------
 * Muestra:
 *   - Cómo se guarda el horario de DAW2 (estructura real, para copiarla)
 *   - El grupo SM2 y los módulos disponibles para ese grupo
 *   - El horario actual de SM2 si lo hubiera
 *
 * USO:  node scripts/diagnostico-horario-sm2.mjs
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}
const norm = s => (s||'').toString().trim().toLowerCase();
function shape(obj, ind='   '){
  for(const k of Object.keys(obj)){
    const v = obj[k];
    let t = Array.isArray(v) ? `array[${v.length}]` : (v && typeof v==='object' && v.toDate ? 'Timestamp' : (v && typeof v==='object' ? 'object' : typeof v));
    let val = (v && typeof v==='object') ? '' : ` = ${JSON.stringify(v)}`;
    console.log(`${ind}${k}: ${t}${val}`);
  }
}

async function run(){
  initFirebase();
  console.log('\n=== DIAGNÓSTICO HORARIO ===\n');

  // Grupos DAW2 y SM2
  let daw2=null, sm2=null;
  (await db.collection('grupos').get()).forEach(d=>{
    const g=d.data();
    if(norm(g.nombre)==='daw2') daw2={id:d.id,...g};
    if(norm(g.nombre)==='sm2')  sm2={id:d.id,...g};
  });
  console.log('Grupo DAW2:', daw2? daw2.id : '❌ no encontrado');
  console.log('Grupo SM2: ', sm2? sm2.id : '❌ no encontrado');

  // ¿Dónde se guarda el horario? Probar colecciones típicas
  const colecciones = ['horarios','horario','schedules','horario_semanal'];
  let colHorario=null;
  for(const c of colecciones){
    try {
      const s = await db.collection(c).limit(1).get();
      if(!s.empty){ colHorario=c; break; }
    } catch {}
  }
  console.log('\nColección de horario detectada:', colHorario || '❓ ninguna de [' + colecciones.join(', ') + ']');

  if(colHorario && daw2){
    // Buscar el horario de DAW2
    let snap;
    try {
      snap = await db.collection(colHorario).where('grupoId','==',daw2.id).get();
    } catch { snap = await db.collection(colHorario).get(); }
    console.log(`\n--- Horario DAW2 en "${colHorario}": ${snap.size} documento(s) ---`);
    if(!snap.empty){
      const d0 = snap.docs[0];
      console.log('Campos del documento de horario:');
      shape(d0.data());
      // Si hay un array de celdas/sesiones, mostrar forma
      const data = d0.data();
      for(const k of Object.keys(data)){
        if(Array.isArray(data[k]) && data[k].length){
          console.log(`\n   forma de ${k}[0]:`);
          shape(data[k][0], '      ');
        }
      }
    }
  }

  // Módulos del grupo SM2 (por cursoId/grupo o todos los que tengan ese grupo)
  console.log('\n--- MÓDULOS disponibles ---');
  const mods=[];
  (await db.collection('modulos').get()).forEach(d=>{
    const m=d.data();
    mods.push({ id:d.id, abrev:m.abreviatura, nombre:m.nombre, grupoId:m.grupoId, cursoId:m.cursoId, horasSemanales:m.horasSemanales });
  });
  // Intentar filtrar por los que parezcan de SM2 / SMR
  const smr = mods.filter(m => norm(m.nombre).match(/ofim|sistema|red|microinform|seguridad|servicio|aplicacion/));
  console.log('Total módulos en BD:', mods.length);
  console.log('Posibles de SMR/SM2 (heurístico por nombre):');
  smr.forEach(m=>console.log(`   ${(m.abrev||'?').padEnd(8)} ${m.nombre||''}  [grupoId:${m.grupoId||'-'} horasSem:${m.horasSemanales??'-'}]`));
  console.log('\n(todos los módulos, por si el filtro no acierta):');
  mods.forEach(m=>console.log(`   ${(m.abrev||'?').padEnd(8)} ${(m.nombre||'').slice(0,40).padEnd(40)} grupoId:${m.grupoId||'-'}`));

  console.log('\n=== FIN ===\n');
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
