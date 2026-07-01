// ============================================================
// MODELOS DE DATOS - CUADERNO DIGITAL FP EUSKADI
// ============================================================

import { Timestamp } from '@core/firebase-shim';

// ---------- ENUMS ----------

export enum Rol {
  ADMIN = 'admin',
  PROFESOR = 'profesor',
  JEFE_ESTUDIOS = 'jefe_estudios',
  TUTOR = 'tutor'
}

export enum EstadoAlumno {
  ACTIVO = 'activo',
  BAJA = 'baja',
  TRASLADADO = 'trasladado',
  TITULADO = 'titulado'
}

export enum TipoEvaluacion {
  PRIMERA = '1ª Evaluación',
  SEGUNDA = '2ª Evaluación',
  PRIMERA_FINAL = '1ª Evaluación Final',
  SEGUNDA_FINAL = '2ª Evaluación Final'
}

export enum EstadoTarea {
  PENDIENTE = 'pendiente',
  ENTREGADA = 'entregada',
  CORREGIDA = 'corregida',
  NO_ENTREGADA = 'no_entregada',
  FUERA_PLAZO = 'fuera_plazo'
}

export enum TipoExamen {
  PARCIAL = 'parcial',
  FINAL = 'final',
  RECUPERACION = 'recuperacion',
  EXTRAORDINARIO = 'extraordinario',
  PRACTICO = 'practico'
}

export enum EstadoAsistencia {
  PRESENTE = 'presente',
  AUSENTE_JUSTIFICADA = 'ausente_justificada',
  AUSENTE_INJUSTIFICADA = 'ausente_injustificada',
  RETRASO = 'retraso'
}

export enum NivelCiclo {
  BASICO = 'FP Básica',
  MEDIO = 'Grado Medio',
  SUPERIOR = 'Grado Superior',
  ESPECIALIZACION = 'Curso de Especialización'
}

export enum FamiliaProfesional {
  INFORMATICA = 'Informática y Comunicaciones',
  ADMINISTRACION = 'Administración y Gestión',
  ELECTRICIDAD = 'Electricidad y Electrónica',
  MECANICA = 'Fabricación Mecánica',
  SANIDAD = 'Sanidad',
  COMERCIO = 'Comercio y Marketing',
  HOSTELERIA = 'Hostelería y Turismo',
  EDUCACION = 'Servicios Socioculturales y a la Comunidad',
  IMAGEN = 'Imagen y Sonido',
  AUTOMOCION = 'Transporte y Mantenimiento de Vehículos',
  CONSTRUCCION = 'Edificación y Obra Civil',
  AGRARIA = 'Agraria',
  INDUSTRIAS = 'Industrias Alimentarias',
  QUIMICA = 'Química',
  MARITIMA = 'Marítimo-Pesquera',
  ENERGIA = 'Energía y Agua',
  ARTES = 'Artes Gráficas',
  MADERA = 'Madera, Mueble y Corcho',
  TEXTIL = 'Textil, Confección y Piel',
  VIDRIO = 'Vidrio y Cerámica',
  ACTIVIDADES = 'Actividades Físicas y Deportivas',
  SEGURIDAD = 'Seguridad y Medio Ambiente',
  IMAGEN_PERSONAL = 'Imagen Personal',
  INSTALACION = 'Instalación y Mantenimiento'
}

// ---------- INTERFACES BASE ----------

export interface BaseEntity {
  id?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// ---------- CENTRO EDUCATIVO ----------

export interface Centro extends BaseEntity {
  nombre: string;
  codigo: string;              // Código del centro educativo
  direccion: string;
  localidad: string;
  provincia: string;           // Araba, Bizkaia, Gipuzkoa
  codigoPostal: string;
  telefono: string;
  email: string;
  web?: string;
  familiasProfesionales: FamiliaProfesional[];
  activo: boolean;
}

// ---------- USUARIO / PROFESOR ----------

export interface Usuario extends BaseEntity {
  uid: string;                 // Firebase Auth UID
  email: string;
  nombre: string;
  apellidos: string;
  dni?: string;
  telefono?: string;
  rol: Rol;
  centroId: string;
  fotoUrl?: string;        // <-- añade esta línea si no existe
  departamento?: string;
  especialidad?: string;
  modulosIds: string[];        // Módulos que imparte
  gruposIds: string[];         // Grupos asignados
  esTutor: boolean;
  grupoTutoriaId?: string;    // Grupo del que es tutor
  activo: boolean;
  avatarUrl?: string;
  configuracion: ConfiguracionUsuario;
}

export interface ConfiguracionUsuario {
  idioma: 'es' | 'eu';        // Castellano o Euskera
  temaOscuro: boolean;
  notificacionesEmail: boolean;
  notificacionesPush: boolean;
  vistaCalificaciones: 'tabla' | 'tarjetas';
}

// ---------- CICLO FORMATIVO ----------

export interface CicloFormativo extends BaseEntity {
  nombre: string;              // Ej: "Desarrollo de Aplicaciones Multiplataforma"
  codigoOficial: string;       // Ej: "IFC303"
  abreviatura: string;         // Ej: "DAM"
  nivel: NivelCiclo;
  familia: FamiliaProfesional;
  duracion: number;            // Horas totales (2000 normalmente)
  cursos: number;              // 1 o 2
  centroId: string;
  modulosIds: string[];
  activo: boolean;
  normativa?: string;          // Referencia al decreto regulador
}

// ---------- GRUPO ----------

export interface Grupo extends BaseEntity {
  nombre: string;              // Ej: "1º DAM A"
  curso: number;               // 1 o 2
  letra: string;               // A, B, C...
  cicloId: string;
  cicloNombre?: string;        // Nombre del ciclo (desnormalizado para listados)
  centroId: string;
  tutorId: string;             // ID del profesor tutor
  cursoAcademico: string;      // "2025-2026"
  turno?: string;              // 'mañana' | 'tarde'
  aula?: string;               // Aula principal del grupo
  alumnosIds: string[];
  modulosIds: string[];
  horario?: Horario;
  activo: boolean;
}

export interface Horario {
  [key: string]: FranjaHoraria[];  // Index signature para acceso dinámico
  lunes: FranjaHoraria[];
  martes: FranjaHoraria[];
  miercoles: FranjaHoraria[];
  jueves: FranjaHoraria[];
  viernes: FranjaHoraria[];
}

export interface FranjaHoraria {
  horaInicio: string;          // "08:30"
  horaFin: string;             // "09:25"
  moduloId: string;
  moduloAbreviatura?: string;  // "PROG", "BBDD", etc.
  profesorId: string;
  aula: string;
}

// ---------- MÓDULO PROFESIONAL ----------

export interface ModuloProfesional extends BaseEntity {
  nombre: string;              // Ej: "Programación"
  codigo: string;              // Ej: "0485"
  abreviatura: string;         // Ej: "PROG"
  cicloId: string;
  curso: number;               // 1 o 2
  horasTotales: number;
  horasSemanales: number;
  profesorId: string;
  resultadosAprendizaje: ResultadoAprendizaje[];
  ponderacionRA: { [raId: string]: number }; // Peso de cada RA en la nota final (%)
  criteriosCalificacion: CriteriosCalificacion;
  activo: boolean;
  esFCT: boolean;              // Formación en Centros de Trabajo
  esProyecto: boolean;         // Módulo de Proyecto
}

export interface CriteriosCalificacion {
  porcentajeExamenes: number;  // Ej: 50
  porcentajeTareas: number;    // Ej: 30
  porcentajeActitud: number;   // Ej: 10
  porcentajeAsistencia: number; // Ej: 10
  notaMinimaAprobado: number;  // Ej: 5
  porcentajeMinimoAsistencia: number; // Ej: 85
  requiereAprobadoExamen: boolean;
  notaMinimaExamen?: number;
  recuperacionDisponible: boolean;
}

// ---------- RESULTADO DE APRENDIZAJE (RA) ----------

export interface ResultadoAprendizaje {
  id: string;
  codigo: string;              // Ej: "RA1", "RA2"
  descripcion: string;
  porcentajePeso: number;      // Peso en la nota del módulo
  criteriosEvaluacion: CriterioEvaluacion[];
  evaluacion: TipoEvaluacion;  // En qué evaluación se trabaja
}

// ---------- CRITERIO DE EVALUACIÓN (CE) ----------

export interface CriterioEvaluacion {
  id: string;
  codigo: string;              // Ej: "CE1a", "CE1b"
  descripcion: string;
  porcentajePeso: number;      // Peso dentro del RA
  instrumentoEvaluacion: string; // Examen, tarea, proyecto, etc.
}

// ---------- ALUMNO ----------

export interface Alumno extends BaseEntity {
  nombre: string;
  apellidos: string;
  dni?: string;
  fechaNacimiento?: Timestamp;
  email: string;
  telefono?: string;
  telefonoTutor?: string;     // Para menores de edad
  nombreTutor?: string;
  direccion?: string;
  localidad?: string;
  codigoPostal?: string;
  centroId: string;
  grupoId: string;
  cicloId: string;
  curso: number;
  estado: EstadoAlumno;
  cursoAcademico: string;
  repetidor: boolean;
  necesidadesEspeciales?: string;
  observaciones?: string;
  fotoUrl?: string;
  // Matrículas en módulos
  matriculas: Matricula[];
}

export interface Matricula {
  moduloId: string;
  moduloNombre: string;
  convocatoria: number;        // 1ª, 2ª convocatoria
  estado: 'matriculado' | 'aprobado' | 'suspenso' | 'convalidado' | 'exento' | 'renuncia';
  notaFinal?: number;
}

// ---------- TAREA ----------

export interface Tarea extends BaseEntity {
  titulo: string;
  descripcion: string;
  moduloId: string;
  grupoId: string;
  profesorId: string;
  // Vinculación curricular
  resultadosAprendizajeIds: string[];  // RAs que evalúa
  criteriosEvaluacionIds: string[];    // CEs que evalúa
  // Fechas
  fechaPublicacion: Timestamp;
  fechaEntrega: Timestamp;
  fechaLimiteRetraso?: Timestamp;     // Fecha límite con penalización
  // Configuración
  puntuacionMaxima: number;
  porcentajeNotaFinal: number;
  penalizacionRetraso: number;         // % que se resta por retraso
  permiteEntregaTardia: boolean;
  esGrupal: boolean;
  requiereArchivo: boolean;
  evaluacion: TipoEvaluacion;
  unidadId?: string;                   // UD (evento de programación tipo 'tema') a la que pertenece
  // Estado
  publicada: boolean;
  archivada: boolean;
  // Entregas
  entregas: EntregaTarea[];
  // Materiales adjuntos
  adjuntos: Adjunto[];
}

export interface EntregaTarea {
  alumnoId: string;
  alumnoNombre: string;
  fechaEntrega?: Timestamp;
  estado: EstadoTarea;
  nota?: number;
  observaciones?: string;
  archivos: Adjunto[];
  feedback?: string;
  corregidoPor?: string;
  fechaCorreccion?: Timestamp;
}

export interface Adjunto {
  nombre: string;
  url: string;
  tipo: string;                // MIME type
  tamaño: number;              // bytes
  subidoPor: string;
  fecha: Timestamp;
}

// ---------- EXAMEN ----------

export interface Examen extends BaseEntity {
  titulo: string;
  descripcion?: string;
  moduloId: string;
  grupoId: string;
  profesorId: string;
  tipo: TipoExamen;
  evaluacion: TipoEvaluacion;
  unidadId?: string;                   // UD (evento de programación tipo 'tema') a la que pertenece
  // Vinculación curricular
  resultadosAprendizajeIds: string[];
  criteriosEvaluacionIds: string[];
  // Fecha y lugar
  fecha: Timestamp;
  horaInicio: string;
  horaFin: string;
  aula: string;
  duracionMinutos: number;
  // Configuración
  puntuacionMaxima: number;
  porcentajeNotaFinal: number;
  notaMinimaAprobado: number;
  tienePonderacion: boolean;
  secciones?: SeccionExamen[];
  // Estado
  publicado: boolean;
  resultadosPublicados: boolean;
  permiteRecuperacion: boolean;
  examenRecuperacionId?: string; // ID del examen de recuperación vinculado
  // Calificaciones
  calificaciones: CalificacionExamen[];
}

export interface SeccionExamen {
  id: string;
  titulo: string;
  descripcion?: string;
  puntuacionMaxima: number;
  porcentaje: number;
  preguntas: number;
}

export interface CalificacionExamen {
  alumnoId: string;
  alumnoNombre: string;
  nota?: number;
  noPresente: boolean;
  observaciones?: string;
  notasPorSeccion?: { [seccionId: string]: number };
  fechaCalificacion?: Timestamp;
  necesitaRecuperacion: boolean;
}

// ---------- RECUPERACIÓN ----------

export interface Recuperacion extends BaseEntity {
  titulo: string;
  descripcion?: string;
  moduloId: string;
  grupoId: string;
  profesorId: string;
  // Vinculación con examen original
  examenOriginalId?: string;
  tareaOriginalId?: string;
  evaluacion: TipoEvaluacion;
  tipoRecuperacion: 'examen' | 'tarea' | 'trabajo' | 'mixto';
  // Vinculación curricular
  resultadosAprendizajeIds: string[];
  criteriosEvaluacionIds: string[];
  // Fechas
  fecha: Timestamp;
  horaInicio?: string;
  horaFin?: string;
  fechaLimiteEntrega?: Timestamp;
  // Configuración
  puntuacionMaxima: number;
  notaMaximaRecuperacion: number;    // Normalmente la nota max es menor (ej: 7 en vez de 10)
  notaMinimaAprobado: number;
  // Alumnos convocados
  alumnosConvocados: AlumnoRecuperacion[];
  // Estado
  publicada: boolean;
  resultadosPublicados: boolean;
}

export interface AlumnoRecuperacion {
  alumnoId: string;
  alumnoNombre: string;
  notaOriginal: number;        // Nota que obtuvo en el examen/tarea original
  notaRecuperacion?: number;
  estado: 'convocado' | 'presentado' | 'no_presentado' | 'aprobado' | 'suspenso';
  observaciones?: string;
}

// ---------- CALIFICACIÓN GENERAL ----------

export interface Calificacion extends BaseEntity {
  alumnoId: string;
  moduloId: string;
  grupoId: string;
  profesorId: string;
  cursoAcademico: string;
  evaluacion: TipoEvaluacion;
  // Notas desglosadas
  notaExamenes: number;
  notaTareas: number;
  notaActitud: number;
  notaAsistencia: number;
  // Nota calculada y final
  notaCalculada: number;       // Nota calculada automáticamente
  notaFinal: number;           // Nota que pone el profesor (puede ajustarla)
  aprobado: boolean;
  // Detalle por RA
  notasPorRA: NotaRA[];
  // Observaciones
  observaciones?: string;
  necesitaRecuperacion: boolean;
  // Control
  bloqueada: boolean;          // Una vez publicada, se bloquea
  publicada: boolean;
}

export interface NotaRA {
  raId: string;
  raCodigo: string;
  nota: number;
  porcentaje: number;
  aprobado: boolean;
  notasPorCE: NotaCE[];
}

export interface NotaCE {
  ceId: string;
  ceCodigo: string;
  nota: number;
  porcentaje: number;
}

// ---------- ASISTENCIA ----------

export interface RegistroAsistencia extends BaseEntity {
  fecha: Timestamp;
  moduloId: string;
  grupoId: string;
  profesorId: string;
  franjaHoraria: string;       // "08:30-09:25"
  registros: AsistenciaAlumno[];
  observacionesGenerales?: string;
}

export interface AsistenciaAlumno {
  alumnoId: string;
  alumnoNombre: string;
  estado: EstadoAsistencia;
  minutosRetraso?: number;
  justificante?: string;
  observaciones?: string;
}

// ---------- RESUMEN ASISTENCIA ----------

export interface ResumenAsistencia {
  alumnoId: string;
  moduloId: string;
  totalClases: number;
  presencias: number;
  ausenciasJustificadas: number;
  ausenciasInjustificadas: number;
  retrasos: number;
  porcentajeAsistencia: number;
  superaMinimo: boolean;
}

// ---------- OBSERVACIONES / INCIDENCIAS ----------

export interface Observacion extends BaseEntity {
  alumnoId: string;
  alumnoNombre: string;
  moduloId?: string;
  grupoId: string;
  profesorId: string;
  tipo: 'positiva' | 'negativa' | 'informativa' | 'incidencia' | 'adaptacion';
  titulo: string;
  descripcion: string;
  fecha: Timestamp;
  visible: boolean;           // Visible para otros profesores
  privada: boolean;           // Solo visible para el autor
}

// ---------- PERIODO EVALUACIÓN ----------

export interface PeriodoEvaluacion extends BaseEntity {
  centroId: string;
  cursoAcademico: string;
  tipo: TipoEvaluacion;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  fechaJuntaEvaluacion?: Timestamp;
  fechaPublicacionNotas?: Timestamp;
  activo: boolean;
  cerrado: boolean;
}

// ---------- PROGRAMACIÓN TEMPORAL ----------

export enum TipoEvento {
  TEMA = 'tema',
  ACTIVIDAD = 'actividad',
  EXAMEN = 'examen'
}

export interface EventoProgramacion extends BaseEntity {
  moduloId: string;
  grupoId: string;
  cursoAcademico: string;
  evaluacion: TipoEvaluacion;
  tipo: TipoEvento;
  titulo: string;
  descripcion?: string;
  fechaInicio: Timestamp;
  fechaFin?: Timestamp;
  color?: string;
  resultadosAprendizajeIds?: string[];
  refId?: string;              // id de la tarea/examen vinculado si lo hay
}

// ---------- ACTA DE EVALUACIÓN ----------

export interface ActaEvaluacion extends BaseEntity {
  moduloId: string;
  grupoId: string;
  profesorId: string;
  evaluacion: TipoEvaluacion;
  cursoAcademico: string;
  fechaJunta: Timestamp;
  calificaciones: CalificacionActa[];
  observaciones?: string;
  firmada: boolean;
  estadisticas: EstadisticasActa;
}

export interface CalificacionActa {
  alumnoId: string;
  alumnoNombre: string;
  nota: number;
  aprobado: boolean;
  convocatoria: number;
  observaciones?: string;
}

export interface EstadisticasActa {
  totalAlumnos: number;
  aprobados: number;
  suspensos: number;
  noEvaluados: number;
  notaMedia: number;
  notaMaxima: number;
  notaMinima: number;
  porcentajeAprobados: number;
}

// ---------- FCT (Formación en Centros de Trabajo) ----------

export interface FCT extends BaseEntity {
  alumnoId: string;
  centroTrabajoNombre: string;
  centroTrabajoDireccion: string;
  tutorCentro: string;         // Tutor del centro de trabajo
  tutorCentroEmail?: string;
  tutorDocente: string;        // Profesor tutor
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  horasTotales: number;
  horasRealizadas: number;
  actividades: ActividadFCT[];
  evaluacionFinal?: 'apto' | 'no_apto' | 'en_curso';
  observaciones?: string;
}

export interface ActividadFCT {
  semana: number;
  fechaInicio: string;
  fechaFin: string;
  horasRealizadas: number;
  actividades: string;
  observacionesTutorEmpresa?: string;
  observacionesTutorDocente?: string;
  validada: boolean;
}

// ---------- DASHBOARD STATS ----------

export interface DashboardStats {
  totalAlumnos: number;
  totalGrupos: number;
  totalModulos: number;
  tareasPublicadas: number;
  tareasCorregir: number;
  examenesProximos: number;
  recuperacionesPendientes: number;
  porcentajeAprobadosGlobal: number;
  asistenciaMediaGlobal: number;
}

// ---------- INFORME ----------

export interface InformeAlumno {
  alumno: Alumno;
  calificaciones: Calificacion[];
  asistencia: ResumenAsistencia[];
  observaciones: Observacion[];
  tareasPendientes: number;
  tareasEntregadas: number;
  mediaGeneral: number;
  tendencia: 'mejora' | 'estable' | 'empeora';
}

// ---------- FILTROS ----------

export interface FiltroCalificaciones {
  grupoId?: string;
  moduloId?: string;
  evaluacion?: TipoEvaluacion;
  soloSuspensos?: boolean;
  soloAprobados?: boolean;
  cursoAcademico?: string;
}

export interface FiltroAsistencia {
  grupoId?: string;
  moduloId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  soloAusencias?: boolean;
  alumnoId?: string;
}