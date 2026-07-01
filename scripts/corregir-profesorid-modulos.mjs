#!/usr/bin/env node
/**
 * corregir-profesorid-modulos.mjs
 * --------------------------------------------------------------------------
 * Corrige los profesorId de los módulos que apuntan a un uid inexistente.
 *
 * CLAVE: en vez de teclear los uid a mano (origen del error: confundir
 * l/I/1 y 2/z en capturas), este script LEE los uid reales desde la
 * colección 'usuarios' buscando por EMAIL, y los asigna a cada módulo.
 *
 * Mapa deseado módulo (abreviatura) -> email del profesor:
 *   SEGI  -> inaki.olasagasti@ikastetxea.eus
 *   SERED -> joseba.garmendia@ikastetxea.eus
 *   SGBD  -> ainhoa.elizalde@ikastetxea.eus
 *   EIE   -> edurne.rezola@ikastetxea.eus
 *   HLC   -> maite.kortabarria@ikastetxea.eus
 *   DWES  -> joseba.garmendia@ikastetxea.eus
 *   DIW   -> ainhoa.elizalde@ikastetxea.eus
 *   DESP  -> inaki.olasagasti@ikastetxea.eus
 *   ING   -> edurne.rezola@ikastetxea.eus
 *   IPE2  -> maite.kortabarria@ikastetxea.eus
 *   APIN  -> jsersan@gmail.com  (Jose María)
 *   PROY  -> jsersan@gmail.com
 *   DWEC  -> jsersan@gmail.com
 *
 * USO:
 *   node scripts/corregir-profesorid-modulos.mjs            # DRY-RUN
 *   node scripts/corregir-profesorid-modulos.mjs --commit   # escribe
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// Mapa módulo -> email (los emails son estables; los uid se leen de la BD)
const MAPA_EMAIL = {
  SEGI:  'inaki.olasagasti@ikastetxea.eus',
  SERED: 'joseba.garmendia@ikastetxea.eus',
  SGBD:  'ainhoa.elizalde@ikastetxea.eus',
  EIE:   'edurne.rezola@ikastetxea.eus',
  HLC:   'maite.kortabarria@ikastetxea.eus',
  DWES:  'joseba.garmendia@ikastetxea.eus',
  DIW:   'ainhoa.elizalde@ikastetxea.eus',
  DESP:  'inaki.olasagasti@ikastetxea.eus',
  ING:   'edurne.rezola@ikastetxea.eus',
  IPE2:  'maite.kortabarria@ikastetxea.eus',
  APIN:  'jsersan@gmail.com',
  PROY:  'jsersan@gmail.com',
  DWEC:  'jsersan@gmail.com',
};

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}
const norm = s => (s||'').toString().trim().toLowerCase();

async function run(){
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CORREGIR profesorId DE MÓDULOS (uid leídos de la BD por email)`);
  console.log(`  Modo: ${COMMIT?'COMMIT (escribe)':'DRY-RUN (no escribe)'}`);
  console.log(`${'='.repeat(60)}\n`);
  initFirebase();

  // 1) Leer usuarios y construir email -> uid REAL
  const emailToUid = {};
  const usuarios = await db.collection('usuarios').get();
  usuarios.forEach(d=>{
    const u = d.data();
    if (u.email) emailToUid[norm(u.email)] = { uid:d.id, nombre:`${u.nombre||''} ${u.apellidos||''}`.trim() };
  });

  // Comprobar que todos los emails del mapa existen
  const faltan = [...new Set(Object.values(MAPA_EMAIL))].filter(e=>!emailToUid[norm(e)]);
  if (faltan.length){
    console.log('❌ No se encontraron usuarios con estos emails (revisa el mapa):');
    faltan.forEach(e=>console.log('   - '+e));
    console.log('');
    return;
  }

  // 2) Recorrer módulos y comparar profesorId actual con el uid correcto
  const mods = await db.collection('modulos').get();
  const cambios = [];
  mods.forEach(d=>{
    const m = d.data();
    const ab = (m.abreviatura||'').toUpperCase();
    if (!MAPA_EMAIL[ab]) return;
    const correcto = emailToUid[norm(MAPA_EMAIL[ab])];
    const actual = m.profesorId || '(sin)';
    if (actual !== correcto.uid){
      cambios.push({ ref:d.ref, abrev:ab, antes:actual, uid:correcto.uid, nombre:correcto.nombre });
    }
  });

  if (!cambios.length){
    console.log('✅ Todos los módulos ya apuntan al uid correcto. Nada que corregir.\n');
    return;
  }

  console.log('Correcciones necesarias:');
  for (const c of cambios){
    console.log(`   ${c.abrev.padEnd(7)} ${c.nombre.padEnd(22)}`);
    console.log(`           antes: ${c.antes}`);
    console.log(`           ahora: ${c.uid}`);
  }
  console.log('');

  if (!COMMIT){ console.log('🔍 DRY-RUN: no se ha escrito nada. Ejecuta con --commit.\n'); return; }

  const batch = db.batch();
  for (const c of cambios) batch.update(c.ref, { profesorId:c.uid, updatedAt:Timestamp.now() });
  await batch.commit();
  console.log(`✅ Corregidos ${cambios.length} módulos con el uid real.\n`);
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
