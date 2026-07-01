#!/usr/bin/env node
/**
 * crear-dasp.mjs
 * ============================================================
 * Crea programación didáctica, tareas y exámenes del módulo
 * DASP (Digitalización Aplicada a los Sectores Productivos, código 1664)
 * para un grupo de SMR (1º curso, 60 h, 6 RA).
 *
 *   1ª eval: RA1 (Economía Circular) + RA2 (Industria 4.0)
 *   2ª eval: RA3 (Cloud) + RA4 (IoT / ciberfísicos)
 *   3ª eval: RA5 (Big Data + IA) + RA6 (Ciberseguridad)
 *
 * 28 sesiones × 2 h = 56 h  + 3 exámenes ≈ 60 h.
 * Las sesiones se ubican cada martes saltando vacaciones (Navidad,
 * Semana Santa). Las tareas se publican el inicio de cada evaluación
 * con fechas de entrega escalonadas. Los exámenes, al final de cada
 * evaluación.
 *
 * USO:
 *   node scripts/crear-dasp.mjs            # DRY-RUN (no escribe)
 *   node scripts/crear-dasp.mjs --commit   # crea en Firestore
 *
 * Si ya existen datos para este (módulo, grupo, curso académico), aborta
 * sin escribir para evitar duplicados.
 * ============================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

// ===================== CONFIGURACIÓN ==============================
const CURSO_ACADEMICO = '2025-2026';   // 2025-2026 o 2026-2027
const GRUPO_NOMBRE    = 'SM1';         // grupo destino (1º SMR)
const MODULO_ABREV    = 'DASP';        // abreviatura del módulo
const DIA_SEMANA      = 2;             // martes (0=dom, 1=lun, 2=mar, ...)
const HORA_INICIO     = 9;             // 9:00
const DURACION_HORAS  = 2;             // bloques de 2 h
// ==================================================================

// Calendario aproximado FP Euskadi. Ajusta a tu calendario real.
const CALENDARIO = {
  '2025-2026': {
    eval1: { inicio: new Date(2025, 8, 15), fin: new Date(2025, 11, 19), examen: new Date(2025, 11, 16) },
    eval2: { inicio: new Date(2026, 0, 12), fin: new Date(2026, 2, 27),  examen: new Date(2026, 2, 24) },
    eval3: { inicio: new Date(2026, 3, 7),  fin: new Date(2026, 5, 19),  examen: new Date(2026, 5, 16) },
    vacaciones: [
      { inicio: new Date(2025, 11, 22), fin: new Date(2026, 0,  7) },  // Navidad
      { inicio: new Date(2026, 2, 30),  fin: new Date(2026, 3,  6) },  // Semana Santa
    ],
  },
  '2026-2027': {
    eval1: { inicio: new Date(2026, 8, 14), fin: new Date(2026, 11, 18), examen: new Date(2026, 11, 15) },
    eval2: { inicio: new Date(2027, 0, 11), fin: new Date(2027, 2, 26),  examen: new Date(2027, 2, 23) },
    eval3: { inicio: new Date(2027, 3, 5),  fin: new Date(2027, 5, 18),  examen: new Date(2027, 5, 15) },
    vacaciones: [
      { inicio: new Date(2026, 11, 21), fin: new Date(2027, 0,  7) },
      { inicio: new Date(2027, 2, 22),  fin: new Date(2027, 2, 28) },
    ],
  },
};

// ============== Sesiones de la programación ============================
const SESIONES = [
  // 1ª evaluación — RA1 + RA2 (10 sesiones)
  { eval: 1, titulo: 'Presentación del módulo, evaluación y recursos',                ra: 'RA1',     desc: 'Objetivos, contenidos, criterios de evaluación, recursos y rúbricas. Diagnóstico inicial.' },
  { eval: 1, titulo: 'RA1.1 Modelo de producción lineal vs circular',                ra: 'RA1',     desc: 'Principios que diferencian el modelo lineal del circular. 9R framework (refuse, reduce, reuse, repair, refurbish, remanufacture, repurpose, recycle, recover).' },
  { eval: 1, titulo: 'RA1.2 Beneficios de la economía circular (caso local)',        ra: 'RA1',     desc: 'Beneficios ambientales, sociales y económicos. Ejemplos en Euskadi: Mondragón, Iberdrola, Eroski, basque ecodesign center.' },
  { eval: 1, titulo: 'RA1.3 Ciclo de vida del hardware y sostenibilidad',            ra: 'RA1',     desc: 'Ciclo de vida de componentes informáticos e infraestructuras de red. Análisis LCA. Etiquetado energético (Energy Star, EPEAT, TCO).' },
  { eval: 1, titulo: 'RA1.4 Huella de carbono y e-waste',                            ra: 'RA1',     desc: 'Medidas para reducir huella de carbono y residuos electrónicos en SMR. Directiva RAEE, puntos limpios, refurbishment.' },
  { eval: 1, titulo: 'RA2.1 Industria 4.0: características e hitos',                 ra: 'RA2',     desc: 'Hitos desde la I revolución industrial hasta la 4.0. Características fundamentales: interconexión, transparencia, asistencia técnica, decisiones descentralizadas.' },
  { eval: 1, titulo: 'RA2.2 Digitalización de la cadena de valor',                   ra: 'RA2',     desc: 'Impacto en la cadena de valor y los hábitos de consumo. Modelos disruptivos (Amazon, Netflix, Airbnb). Datos de transformación digital en pymes vascas.' },
  { eval: 1, titulo: 'RA2.3 Ventajas competitivas de la transformación digital',     ra: 'RA2',     desc: 'Reducción de costes, time-to-market, personalización, decisión basada en datos. Caso práctico de una empresa antes/después.' },
  { eval: 1, titulo: 'RA2.4 Perfil profesional SMR en la digitalización',            ra: 'RA2',     desc: 'El papel del técnico SMR en proyectos de digitalización: soporte, redes, cloud básico, ciberseguridad operativa.' },
  { eval: 1, titulo: 'Repaso 1ª evaluación',                                         ra: 'RA1+RA2', desc: 'Repaso integral de RA1 y RA2. Preguntas tipo examen, mapas conceptuales, resolución de dudas.' },

  // 2ª evaluación — RA3 + RA4 (9 sesiones)
  { eval: 2, titulo: 'RA3.1 Modelos de despliegue cloud',                            ra: 'RA3',     desc: 'Pública, privada, híbrida y multicloud. Características NIST. Cuándo usar cada modelo.' },
  { eval: 2, titulo: 'RA3.2 Modelos de servicio: IaaS, PaaS, SaaS',                  ra: 'RA3',     desc: 'Diferencias y responsabilidades compartidas. Ejemplos: AWS EC2 (IaaS), Heroku (PaaS), Microsoft 365 (SaaS). Modelo de pizza as a service.' },
  { eval: 2, titulo: 'RA3.3 Beneficios del cloud para pymes',                        ra: 'RA3',     desc: 'Escalabilidad, costes OPEX vs CAPEX, flexibilidad, recuperación ante desastres. Casos de éxito en pymes vascas.' },
  { eval: 2, titulo: 'RA3.4 Selección de plataformas cloud (caso práctico)',         ra: 'RA3',     desc: 'Comparativa AWS, Azure, GCP. Caso: migración de una pyme de 20 empleados a la nube (correo, archivos, contabilidad).' },
  { eval: 2, titulo: 'RA4.1 Arquitectura IoT y redes industriales',                  ra: 'RA4',     desc: 'Capas: percepción, red, procesamiento, aplicación. Diferencia IT/OT. Redes industriales (Modbus, PROFINET).' },
  { eval: 2, titulo: 'RA4.2 Sensores y actuadores',                                  ra: 'RA4',     desc: 'Sensores de temperatura, humedad, presencia, vibración, luz. Actuadores: relés, motores, válvulas. Conexión y normalización de datos.' },
  { eval: 2, titulo: 'RA4.3 Sistemas ciberfísicos: práctica con MicroBit/Arduino',   ra: 'RA4',     desc: 'Configuración de un sensor real conectado a una plataforma (ThingSpeak / Node-RED). Captura, almacenamiento y visualización.' },
  { eval: 2, titulo: 'RA4.4 Protocolos de comunicación IoT seguros',                 ra: 'RA4',     desc: 'MQTT, CoAP, HTTP/HTTPS. Cifrado en tránsito. Identidad de dispositivos. Buenas prácticas de seguridad IoT.' },
  { eval: 2, titulo: 'Repaso 2ª evaluación',                                         ra: 'RA3+RA4', desc: 'Repaso integral de RA3 y RA4. Resolución de dudas y simulacro de preguntas tipo examen.' },

  // 3ª evaluación — RA5 + RA6 (9 sesiones)
  { eval: 3, titulo: 'RA5.1 Las "V" del Big Data',                                   ra: 'RA5',     desc: 'Volumen, velocidad, variedad, veracidad y valor. Diferencia entre dato, información y conocimiento. Pipeline ETL.' },
  { eval: 3, titulo: 'RA5.2 IA y Machine Learning aplicado a procesos',              ra: 'RA5',     desc: 'Aprendizaje supervisado/no supervisado/refuerzo. Casos: RPA, clasificación de correos, OCR, chatbots, visión artificial en producción.' },
  { eval: 3, titulo: 'RA5.3 Dashboards y analítica (Looker Studio / Power BI)',      ra: 'RA5',     desc: 'KPI, métricas, gráficos eficaces. Práctica: construir un dashboard con un dataset abierto (Open Data Euskadi).' },
  { eval: 3, titulo: 'RA5.4 IA en mantenimiento predictivo y monitorización',        ra: 'RA5',     desc: 'Predicción de fallos de disco con SMART. Detección de anomalías en redes (Zabbix, Wazuh). Mantenimiento basado en condición.' },
  { eval: 3, titulo: 'RA6.1 Malware, ingeniería social y amenazas',                  ra: 'RA6',     desc: 'Virus, troyanos, ransomware, gusanos, spyware. Phishing, vishing, smishing, pretexting. Informes INCIBE y BCSC.' },
  { eval: 3, titulo: 'RA6.2 Vulnerabilidades en SO, redes, Cloud e IoT',             ra: 'RA6',     desc: 'CVE, CVSS, OWASP Top 10. Escaneo con nmap/nessus. Hardening básico de Windows/Linux. Vulnerabilidades específicas Cloud/IoT.' },
  { eval: 3, titulo: 'RA6.3 Protección de datos y buenas prácticas',                 ra: 'RA6',     desc: 'Control de accesos (RBAC), MFA, gestor de contraseñas, copias de seguridad regla 3-2-1, RGPD y LOPDGDD.' },
  { eval: 3, titulo: 'RA6.4 Criptografía y protocolos seguros',                      ra: 'RA6',     desc: 'Cifrado simétrico/asimétrico, hash, firma digital, certificados X.509. VPN (IPsec, WireGuard), HTTPS/TLS, WPA3.' },
  { eval: 3, titulo: 'Repaso final',                                                 ra: 'RA5+RA6', desc: 'Repaso integral de RA5 y RA6. Preparación del examen final y de la prueba global.' },
];

// ============== Tareas =================================================
const TAREAS = [
  // 1ª evaluación
  { eval: 1, titulo: 'T1. Análisis de una empresa local en economía circular',      ra: 'RA1', dias: 14, desc: 'Selecciona una empresa de Euskadi (Mondragón, Iberdrola, Eroski u otra) y analiza sus prácticas de economía circular: materiales, energía, gestión de residuos. Mínimo 800 palabras con fuentes.' },
  { eval: 1, titulo: 'T2. Auditoría sostenible del aula',                           ra: 'RA1', dias: 28, desc: 'Auditoría del consumo energético y residuos electrónicos del aula. Inventario de equipos, estimación de consumo, propuesta de 5 medidas con ahorro estimado.' },
  { eval: 1, titulo: 'T3. Caso de transformación digital en una pyme',              ra: 'RA2', dias: 21, desc: 'Elige una pyme real o ficticia. Describe el proceso "antes" y propón un proceso "después" aplicando tecnologías 4.0. Justifica las ventajas competitivas obtenidas.' },
  { eval: 1, titulo: 'T4. Línea de tiempo: hitos de la Industria 4.0',              ra: 'RA2', dias: 21, desc: 'Cronograma desde la 1ª revolución industrial hasta la 4.0 con tecnologías, empresas y personajes clave. Formato visual (Canva, Genially o similar).' },

  // 2ª evaluación
  { eval: 2, titulo: 'T5. Comparativa de proveedores cloud',                        ra: 'RA3', dias: 14, desc: 'Tabla comparativa de AWS, Azure y GCP: servicios IaaS, PaaS y SaaS, modelo de precios, regiones, soporte y casos de uso recomendados. Recomendación razonada.' },
  { eval: 2, titulo: 'T6. Plan de migración cloud para una pyme',                   ra: 'RA3', dias: 21, desc: 'Migración de los servicios (correo, archivos, ERP, copias) de una pyme de 25 empleados. Selección de modelo, proveedor, fases, riesgos y coste mensual estimado.' },
  { eval: 2, titulo: 'T7. Diseño de un sistema IoT',                                ra: 'RA4', dias: 21, desc: 'Diseña un sistema IoT para un escenario (invernadero, almacén, granja, parking inteligente): sensores, conectividad, plataforma, dashboard y reglas de alerta.' },
  { eval: 2, titulo: 'T8. Práctica: sensor real + dashboard',                       ra: 'RA4', dias: 14, desc: 'Conecta un sensor (real con MicroBit/ESP32 o simulado con Wokwi) a una plataforma (ThingSpeak o Node-RED). Captura datos durante 48 h y monta un dashboard con alertas.' },

  // 3ª evaluación
  { eval: 3, titulo: 'T9. Análisis crítico de un dashboard real',                   ra: 'RA5', dias: 14, desc: 'Selecciona un dashboard público (Open Data Euskadi, INE, Eurostat). Identifica métricas, KPIs y posibles mejoras. ¿Qué decisiones se podrían tomar con él?' },
  { eval: 3, titulo: 'T10. Caso real de IA en empresa',                             ra: 'RA5', dias: 14, desc: 'Investiga un caso real de IA en una empresa española (BBVA, Telefónica, CAF, Iberdrola…). Tecnología empleada, problema resuelto, resultados medidos y limitaciones.' },
  { eval: 3, titulo: 'T11. Análisis de un incidente de ciberseguridad',             ra: 'RA6', dias: 14, desc: 'Elige un incidente reciente (ransomware en hospital, fuga de datos, ataque DDoS). Analiza el vector de ataque, impacto, cronología y medidas de mitigación aplicadas.' },
  { eval: 3, titulo: 'T12. Plan de ciberseguridad básico para una pyme',            ra: 'RA6', dias: 21, desc: 'Plan con políticas de contraseñas, MFA, backups 3-2-1, formación al personal, procedimientos ante incidentes y kit mínimo de software (antimalware, EDR, gestor de contraseñas).' },
];

// ============== Exámenes ===============================================
const EXAMENES = [
  { eval: 1, titulo: 'Examen 1ª evaluación — RA1 y RA2', ras: ['RA1','RA2'], desc: 'Prueba escrita sobre economía circular, sostenibilidad e Industria 4.0. Parte teórica con preguntas cortas/test + supuestos prácticos. Duración 90 min.' },
  { eval: 2, titulo: 'Examen 2ª evaluación — RA3 y RA4', ras: ['RA3','RA4'], desc: 'Prueba escrita sobre cloud computing y sistemas IoT/ciberfísicos. Parte teórica + supuestos prácticos (selección de servicios cloud, diseño de IoT). Duración 90 min.' },
  { eval: 3, titulo: 'Examen 3ª evaluación — RA5 y RA6', ras: ['RA5','RA6'], desc: 'Prueba escrita sobre Big Data + IA y ciberseguridad. Parte teórica + supuestos prácticos (análisis de dashboard, plan de seguridad). Duración 90 min.' },
];

// ============== Helpers ================================================
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const evalLabel = n => `${n}ª Evaluación`;

const enVacaciones = (d, vacaciones) =>
  vacaciones.some(v => d >= v.inicio && d <= v.fin);

/** Devuelve el próximo `diaSemana` (martes) desde `desde`, sin caer en vacaciones, sin pasarse de `fin`. */
function siguienteSesion(desde, diaSemana, vacaciones, fin) {
  const c = new Date(desde);
  for (let i = 0; i < 365; i++) {
    if (c.getDay() === diaSemana && !enVacaciones(c, vacaciones)) {
      if (c > fin) return null;
      return new Date(c);
    }
    c.setDate(c.getDate() + 1);
  }
  return null;
}

const avanzar7 = d => { const c = new Date(d); c.setDate(c.getDate() + 7); return c; };

// ============== Main ===================================================
async function main() {
  console.log(`\n=== Crear DASP — ${COMMIT ? 'COMMIT (ESCRIBE)' : 'DRY-RUN'} ===`);
  console.log(`   Curso académico: ${CURSO_ACADEMICO}`);
  console.log(`   Grupo:           ${GRUPO_NOMBRE}`);
  console.log(`   Módulo:          ${MODULO_ABREV}\n`);

  const cal = CALENDARIO[CURSO_ACADEMICO];
  if (!cal) { console.error(`No hay calendario para ${CURSO_ACADEMICO}.`); process.exit(1); }

  // ---- Lookup módulo ----
  const modSnap = await db.collection('modulos').where('abreviatura', '==', MODULO_ABREV).get();
  if (modSnap.empty) { console.error(`✗ No se encuentra el módulo con abreviatura "${MODULO_ABREV}".`); process.exit(1); }
  if (modSnap.size > 1) console.warn(`⚠ Hay ${modSnap.size} módulos con abreviatura "${MODULO_ABREV}". Uso el primero.`);
  const moduloDoc = modSnap.docs[0];
  const modulo = { id: moduloDoc.id, ...moduloDoc.data() };
  console.log(`✓ Módulo: ${modulo.nombre}  (id=${modulo.id}, cicloId=${modulo.cicloId || '-'})`);

  // ---- Lookup grupo ----
  const grpSnap = await db.collection('grupos')
    .where('nombre', '==', GRUPO_NOMBRE)
    .where('cursoAcademico', '==', CURSO_ACADEMICO)
    .get();
  if (grpSnap.empty) { console.error(`✗ No se encuentra el grupo "${GRUPO_NOMBRE}" en ${CURSO_ACADEMICO}.`); process.exit(1); }
  if (grpSnap.size > 1) console.warn(`⚠ Hay ${grpSnap.size} grupos "${GRUPO_NOMBRE}" en ${CURSO_ACADEMICO}. Uso el primero (${grpSnap.docs[0].id}).`);
  const grupoDoc = grpSnap.docs[0];
  const grupo = { id: grupoDoc.id, ...grupoDoc.data() };
  console.log(`✓ Grupo:  ${grupo.nombre}   (id=${grupo.id}, cicloId=${grupo.cicloId || '-'})`);

  if (modulo.cicloId && grupo.cicloId && modulo.cicloId !== grupo.cicloId) {
    console.warn(`⚠ El módulo y el grupo pertenecen a ciclos distintos. Continúo.`);
  }

  // ---- Idempotencia: ¿hay ya datos para este (módulo, grupo, curso)? ----
  for (const col of ['eventos_programacion', 'tareas', 'examenes']) {
    const existe = await db.collection(col)
      .where('moduloId', '==', modulo.id)
      .where('grupoId', '==', grupo.id)
      .where('cursoAcademico', '==', CURSO_ACADEMICO)
      .limit(1).get();
    if (!existe.empty) {
      console.error(`\n✗ Ya hay registros en "${col}" para este módulo+grupo+curso. Aborto para evitar duplicados.`);
      console.error(`  Si quieres reemplazarlos, bórralos antes con un script de limpieza.`);
      process.exit(1);
    }
  }

  // ---- Profesores (co-docencia compatible) ----
  const profesoresIds = modulo.profesorId
    ? [modulo.profesorId, ...((modulo.profesoresIds || []).filter(p => p !== modulo.profesorId))]
    : (modulo.profesoresIds || []);

  // ---- Generar eventos de programación ----
  const sesionesPorEval = { 1: [], 2: [], 3: [] };
  for (const s of SESIONES) sesionesPorEval[s.eval].push(s);

  const eventos = [];
  for (const evalN of [1, 2, 3]) {
    const { inicio, fin } = cal[`eval${evalN}`];
    let cursor = siguienteSesion(inicio, DIA_SEMANA, cal.vacaciones, fin);
    if (!cursor) { console.warn(`⚠ No hay hueco para sesiones en la ${evalN}ª evaluación.`); continue; }

    for (const s of sesionesPorEval[evalN]) {
      // Si el cursor ha caído en vacaciones o se ha pasado, buscar siguiente
      if (enVacaciones(cursor, cal.vacaciones) || cursor > fin) {
        cursor = siguienteSesion(avanzar7(cursor), DIA_SEMANA, cal.vacaciones, fin);
        if (!cursor) {
          console.warn(`⚠ No cabe la sesión "${s.titulo}" en la ${evalN}ª evaluación.`);
          continue;
        }
      }
      const ini = new Date(cursor); ini.setHours(HORA_INICIO, 0, 0, 0);
      const finS = new Date(ini); finS.setHours(ini.getHours() + DURACION_HORAS);
      eventos.push({
        moduloId: modulo.id,
        moduloNombre: modulo.nombre,
        moduloAbreviatura: modulo.abreviatura,
        cicloId: modulo.cicloId || grupo.cicloId || '',
        grupoId: grupo.id,
        grupoNombre: grupo.nombre,
        profesoresIds,
        cursoAcademico: CURSO_ACADEMICO,
        evaluacion: evalLabel(evalN),
        titulo: s.titulo,
        descripcion: s.desc,
        ra: s.ra,
        tipo: 'sesion',
        fecha: Timestamp.fromDate(ini),
        fechaInicio: Timestamp.fromDate(ini),
        fechaFin: Timestamp.fromDate(finS),
        horas: DURACION_HORAS,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      cursor = avanzar7(cursor);
    }
  }

  // ---- Tareas ----
  const tareas = [];
  for (const t of TAREAS) {
    const { inicio, fin } = cal[`eval${t.eval}`];
    const fechaPub = siguienteSesion(inicio, DIA_SEMANA, cal.vacaciones, fin) || inicio;
    const fechaEnt = new Date(fechaPub);
    fechaEnt.setDate(fechaEnt.getDate() + t.dias);
    fechaEnt.setHours(23, 59, 0, 0);
    tareas.push({
      moduloId: modulo.id,
      moduloNombre: modulo.nombre,
      moduloAbreviatura: modulo.abreviatura,
      cicloId: modulo.cicloId || grupo.cicloId || '',
      grupoId: grupo.id,
      grupoNombre: grupo.nombre,
      profesoresIds,
      cursoAcademico: CURSO_ACADEMICO,
      evaluacion: evalLabel(t.eval),
      titulo: t.titulo,
      descripcion: t.desc,
      ra: t.ra,
      maxPuntos: 10,
      fechaPublicacion: Timestamp.fromDate(fechaPub),
      fechaEntrega: Timestamp.fromDate(fechaEnt),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  // ---- Exámenes ----
  const examenes = [];
  for (const e of EXAMENES) {
    const f = new Date(cal[`eval${e.eval}`].examen);
    f.setHours(HORA_INICIO, 0, 0, 0);
    examenes.push({
      moduloId: modulo.id,
      moduloNombre: modulo.nombre,
      moduloAbreviatura: modulo.abreviatura,
      cicloId: modulo.cicloId || grupo.cicloId || '',
      grupoId: grupo.id,
      grupoNombre: grupo.nombre,
      profesoresIds,
      cursoAcademico: CURSO_ACADEMICO,
      evaluacion: evalLabel(e.eval),
      titulo: e.titulo,
      descripcion: e.desc,
      ras: e.ras,
      ra: e.ras.join('+'),
      maxPuntos: 10,
      duracion: 90,
      fecha: Timestamp.fromDate(f),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  // ---- Resumen ----
  console.log(`\n--- A crear ---`);
  console.log(`  eventos_programacion: ${eventos.length}`);
  console.log(`  tareas:               ${tareas.length}`);
  console.log(`  examenes:             ${examenes.length}`);

  // Tabla por evaluación
  console.log(`\n  Sesiones por evaluación:`);
  for (const n of [1, 2, 3]) {
    const ev = eventos.filter(e => e.evaluacion === evalLabel(n));
    const desde = ev[0]?.fecha.toDate().toISOString().slice(0, 10) || '—';
    const hasta = ev.at(-1)?.fecha.toDate().toISOString().slice(0, 10) || '—';
    console.log(`    ${evalLabel(n)}:  ${String(ev.length).padStart(2)}  ${desde} → ${hasta}`);
  }

  if (!COMMIT) {
    console.log(`\n  Primeras 3 sesiones:`);
    for (const e of eventos.slice(0, 3)) {
      console.log(`    · ${e.evaluacion} | ${e.fecha.toDate().toISOString().slice(0,10)} | ${e.titulo}`);
    }
    console.log(`\nDRY-RUN: no se ha escrito nada. Ejecuta con --commit para crear.`);
    return;
  }

  // ---- Escribir en lotes ----
  for (const [col, items] of [['eventos_programacion', eventos], ['tareas', tareas], ['examenes', examenes]]) {
    for (let i = 0; i < items.length; i += 450) {
      const lote = items.slice(i, i + 450);
      const batch = db.batch();
      for (const data of lote) batch.set(db.collection(col).doc(), data);
      await batch.commit();
    }
    console.log(`  ✓ ${col}: ${items.length} creados`);
  }
  console.log(`\n✓ Hecho.`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
