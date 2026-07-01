#!/usr/bin/env node
/**
 * limpiar-alumnos-duplicados.mjs
 * ============================================================
 * Limpia la colección `alumnos` aplicando, por este orden, tres reglas:
 *
 *   (A) PURGA MANUAL — alumnos cuyo `grupoId` esté en CODIGOS_A_PURGAR.
 *
 *   (B) GRUPO INVÁLIDO — un alumno es VÁLIDO sólo si su `grupoId` apunta
 *       a un grupo que EXISTE y cuyo `cursoAcademico` coincide con el del
 *       propio alumno. Si no, se marca para borrar.
 *
 *       Esto captura los dos casos malos:
 *         · grupoId huérfano (el grupo ya no existe)
 *         · grupoId que apunta a un grupo de OTRO año académico
 *           (ej.: alumno cursoAcademico=2026-2027 con grupoId de 2025-2026)
 *
 *   (C) DEDUP POR ALUMNO Y GRUPO — entre los que quedan, si hay varios
 *       documentos del mismo alumno (mismo email; si no hay, dni; si no,
 *       nombre+apellidos) con el MISMO grupoId, conserva uno y borra el
 *       resto. "El mejor" = activo > más matrículas > id menor.
 *
 *       IMPORTANTE: la clave es (alumno + grupo), NO (alumno + año). En
 *       este modelo el mismo alumno puede tener un documento por cada
 *       grupo en el que está matriculado (p. ej. Ane Aguirre puede estar
 *       a la vez en 2AW3 y SM2 del mismo año). Esto preserva esos casos
 *       legítimos: dos grupoIds distintos → dos claves distintas →
 *       no se borra ninguno.
 *
 * USO:
 *   node scripts/limpiar-alumnos-duplicados.mjs            # DRY-RUN (no borra)
 *   node scripts/limpiar-alumnos-duplicados.mjs --commit   # BORRA de verdad
 * ============================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// ===================== CONFIGURACIÓN ==============================
// Override manual: alumnos con grupoId en esta lista se borran SIEMPRE.
const CODIGOS_A_PURGAR = [];

// Si false, no aplica la regla (B) (no marca por grupo inválido).
const APLICAR_REGLA_GRUPO_INVALIDO = true;

// Si false, no aplica la regla (C) (no deduplica).
const APLICAR_DEDUP = true;
// ==================================================================

const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const norm = s => (s || '').toString().trim().toLowerCase();

function claveAlumno(a) {
  const email = norm(a.email);
  if (email) return `mail:${email}`;
  const dni = norm(a.dni).replace(/[\s-]/g, '');
  if (dni) return `dni:${dni}`;
  return `nom:${norm(a.apellidos)}|${norm(a.nombre)}`;
}

function puntuar(a, grupoOk) {
  let s = 0;
  if (grupoOk) s += 10000;                              // grupo correcto pesa mucho
  if (norm(a.estado || 'activo') === 'activo') s += 1000;
  s += Array.isArray(a.matriculas) ? a.matriculas.length : 0;
  if (a.cicloId) s += 1;
  return s;
}

async function main() {
  console.log(`\n=== Limpieza de alumnos — ${COMMIT ? 'COMMIT (BORRA)' : 'DRY-RUN'} ===\n`);

  // 1) Cargar alumnos
  const snapA = await db.collection('alumnos').get();
  const alumnos = snapA.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total alumnos en la BD: ${alumnos.length}`);

  // 2) Cargar TODOS los grupos en un mapa id -> {nombre, cursoAcademico}
  const snapG = await db.collection('grupos').get();
  const grupos = {};
  for (const g of snapG.docs) {
    grupos[g.id] = { nombre: g.get('nombre'), cursoAcademico: g.get('cursoAcademico') };
  }
  console.log(`Total grupos en la BD: ${Object.keys(grupos).length}`);

  // 3) Para cada alumno, decidir si su grupo es "correcto" (existe y mismo año)
  const grupoOk = new Map();
  for (const a of alumnos) {
    const g = a.grupoId ? grupos[a.grupoId] : null;
    const ok = !!g && (!a.cursoAcademico || !g.cursoAcademico || g.cursoAcademico === a.cursoAcademico);
    grupoOk.set(a.id, ok);
  }

  // 4) Aplicar reglas A y B
  const motivo = new Map();
  for (const a of alumnos) {
    if (a.grupoId && CODIGOS_A_PURGAR.includes(a.grupoId)) {
      motivo.set(a.id, `purga manual (grupo ${a.grupoId})`);
      continue;
    }
    if (APLICAR_REGLA_GRUPO_INVALIDO && !grupoOk.get(a.id)) {
      const g = a.grupoId ? grupos[a.grupoId] : null;
      const detalle = !a.grupoId
        ? 'sin grupoId'
        : !g
          ? `grupo ${a.grupoId} no existe`
          : `grupo "${g.nombre}" (${g.cursoAcademico}) ≠ alumno (${a.cursoAcademico})`;
      motivo.set(a.id, `grupo inválido: ${detalle}`);
    }
  }

  // 5) Regla C: dedup por (clave alumno, cursoAcademico) entre los NO marcados aún
  if (APLICAR_DEDUP) {
    const grupos2 = new Map();
    for (const a of alumnos) {
      if (motivo.has(a.id)) continue;
      if (!a.grupoId) continue;
      const k = `${claveAlumno(a)}__${a.grupoId}`;
      (grupos2.get(k) || grupos2.set(k, []).get(k)).push(a);
    }
    for (const [, lista] of grupos2) {
      if (lista.length < 2) continue;
      lista.sort((x, y) =>
        puntuar(y, grupoOk.get(y.id)) - puntuar(x, grupoOk.get(x.id)) ||
        String(x.id).localeCompare(String(y.id))
      );
      for (const dup of lista.slice(1)) {
        motivo.set(dup.id, `repetido en grupo ${dup.grupoId}`);
      }
    }
  }

  // 6) Informe por año académico
  console.log('\n--- Resumen por curso académico ---');
  const porAnio = {};
  for (const a of alumnos) {
    const k = a.cursoAcademico || '(sin año)';
    (porAnio[k] ||= { total: 0, borrar: 0 }).total++;
    if (motivo.has(a.id)) porAnio[k].borrar++;
  }
  for (const [k, v] of Object.entries(porAnio).sort()) {
    console.log(`  ${k.padEnd(14)}  total: ${String(v.total).padStart(3)}   se borran: ${String(v.borrar).padStart(3)}   quedan: ${String(v.total - v.borrar).padStart(3)}`);
  }

  // 7) Lista detallada a borrar
  const aBorrar = alumnos.filter(a => motivo.has(a.id));
  console.log(`\n--- ${aBorrar.length} alumno(s) a borrar ---`);
  aBorrar.sort((x, y) =>
    norm(x.cursoAcademico).localeCompare(norm(y.cursoAcademico)) ||
    norm(x.apellidos).localeCompare(norm(y.apellidos))
  );
  for (const a of aBorrar) {
    console.log(`  [${a.cursoAcademico || '----'}] ${a.apellidos}, ${a.nombre}  <${a.email}>  grupoId=${a.grupoId || '-'}  → ${motivo.get(a.id)}`);
  }

  if (!aBorrar.length) { console.log('\nNada que borrar. ✓'); return; }
  if (!COMMIT) {
    console.log(`\nDRY-RUN: no se ha borrado nada. Revisa la lista y ejecuta con --commit.`);
    return;
  }

  // 8) Borrado por lotes
  let borrados = 0;
  for (let i = 0; i < aBorrar.length; i += 450) {
    const lote = aBorrar.slice(i, i + 450);
    const batch = db.batch();
    for (const a of lote) batch.delete(db.collection('alumnos').doc(a.id));
    await batch.commit();
    borrados += lote.length;
    console.log(`  Borrados ${borrados}/${aBorrar.length}...`);
  }
  console.log(`\n✓ Borrados ${borrados} alumno(s).`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
