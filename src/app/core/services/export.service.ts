import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Calificacion, Alumno, ResumenAsistencia } from '@core/models';
import { PORTADA_CUADERNO_BG } from './portada-bg';

export interface FilaActa {
  alumnoNombre: string;
  nota: number;
  aprobado: boolean;
  convocatoria?: number;
  observaciones?: string;
}

export interface DatosActa {
  centro: string;
  grupo: string;
  modulo: string;
  cursoAcademico: string;
  evaluacion: string;
  profesor: string;
  filas: FilaActa[];
  estadisticas: {
    totalAlumnos: number;
    aprobados: number;
    suspensos: number;
    noEvaluados: number;
    notaMedia: number;
    porcentajeAprobados: number;
  };
}

export interface DatosInformeAlumno {
  centro: string;
  alumnoNombre: string;
  grupo: string;
  cursoAcademico: string;
  email?: string;
  dni?: string;
  stats: { modulosAprobados: number; modulosSuspensos: number; mediaGeneral: number; totalModulos: number };
  matriculas: { moduloNombre: string; convocatoria?: number; estado?: string; notaFinal?: number }[];
  asistencia: { modulo: string; porcentaje: number; presencias: number; justificadas: number; injustificadas: number; retrasos: number; superaMinimo: boolean }[];
  observaciones: { fecha: string; tipo: string; titulo: string; descripcion: string }[];
}

export interface DetalleAlumno {
  alumno: string;
  tareas: { titulo: string; nota?: number }[];
  examenes: { titulo: string; nota?: number; noPresente?: boolean }[];
  recuperaciones: { titulo: string; nota?: number; estado?: string }[];
}

// Un ítem (tarea/examen/recuperación) ya resuelto con su evaluación y UD
export interface ItemActividad {
  titulo: string;
  fecha: string;
  evaluacion: string;
  unidad: string;          // título de la UD o '(Sin unidad)'
  extra?: string;          // texto auxiliar (pts, tipo, etc.)
}

// Franja del horario para pintar la rejilla
export interface FranjaPDF {
  dia: string;             // 'lunes'...'viernes'
  horaInicio: string;
  horaFin: string;
  modulo: string;          // abreviatura
  aula?: string;
  esDelModulo?: boolean;   // true si es el módulo del cuaderno
}

// Datos de una evaluación para actas/calificaciones por periodo
export interface EvalConCalificaciones {
  evaluacion: string;
  filas: { alumno: string; nota?: number; aprobado: boolean }[];
  estadisticas: { aprobados: number; suspensos: number; noEvaluados: number; notaMedia: number };
}

// Qué apartados incluir (todos opcionales; si no se pasa, se incluye)
export interface ApartadosCuaderno {
  portada?: boolean;
  orla?: boolean;
  horario?: boolean;
  fechasEval?: boolean;
  actas?: boolean;
  temporalizacion?: boolean;
  asistencia?: boolean;
  tareas?: boolean;
  examenes?: boolean;
  recuperaciones?: boolean;
  calificaciones?: boolean;
}

export interface DatosCuadernoCompleto {
  centro: string;
  grupo: string;
  modulo: string;
  cicloNombre?: string;     // nombre completo del ciclo (p. ej. "Desarrollo de Aplicaciones Web")
  cicloAbrev?: string;      // acrónimo del ciclo (p. ej. "DAW")
  moduloNombre?: string;    // nombre completo del módulo (p. ej. "Desarrollo Web Entorno Cliente")
  cursoAcademico: string;
  evaluacion: string;
  profesor: string;
  alumnos: { apellidos: string; nombre: string; email: string; estado: string; fotoUrl?: string }[];
  calificaciones: { alumno: string; nota?: number; aprobado: boolean }[];
  asistencia: { alumno: string; porcentaje: number; faltas: number; justificadas?: number; injustificadas?: number; superaMinimo: boolean }[];
  detallePorAlumno: DetalleAlumno[];
  programacion: { titulo: string; tipo: string; fecha: string; evaluacion?: string }[];
  observaciones: { fecha: string; tipo: string; titulo: string }[];
  kpis: {
    totalAlumnos: number;
    asistenciaMedia: number;
    notaMedia: number;
    porcentajeAprobados: number;
    enRiesgo: number;
  };
  // --- Datos de los apartados ampliados ---
  horario?: FranjaPDF[];
  periodos?: { evaluacion: string; inicio: string; fin: string }[];
  actasPorEval?: EvalConCalificaciones[];
  calificacionesPorEval?: EvalConCalificaciones[];
  temporalizacionPorEval?: { evaluacion: string; eventos: { titulo: string; tipo: string; fecha: string; fechaFin?: string }[] }[];
  tareasAgrupadas?: { evaluacion: string; unidades: { unidad: string; items: ItemActividad[] }[] }[];
  examenesAgrupados?: { evaluacion: string; unidades: { unidad: string; items: ItemActividad[] }[] }[];
  recuperacionesAgrupadas?: { evaluacion: string; unidades: { unidad: string; items: ItemActividad[] }[] }[];
  // Exámenes y recuperaciones JUNTOS por evaluación, cada uno con alumnos ordenados
  actividadesPorEval?: {
    evaluacion: string;
    examenes: { titulo: string; fechaHora: string; unidad: string; notaMax?: number; notaMin?: number; alumnos: { alumno: string; nota?: number; noPresente?: boolean }[] }[];
    recuperaciones: { titulo: string; fechaHora: string; unidad: string; notaMax?: number; alumnos: { alumno: string; nota?: number; estado?: string }[] }[];
  }[];
  // Asistencia detallada por alumno
  asistenciaDetalle?: { alumno: string; totalClases: number; presencias: number; justificadas: number; injustificadas: number; retrasos: number; porcentaje: number; superaMinimo: boolean }[];
  // Informe de faltas por alumno: acumulados + fechas día a día (tipo 'J'/'I')
  faltasPorAlumno?: { alumno: string; justificadas: number; injustificadas: number; total: number; fechas: { fecha: string; tipo: 'J' | 'I' }[] }[];
  // Resumen por evaluación con desglose
  resumenPorEval?: { evaluacion: string; filas: { alumno: string; tareas?: number; examenes?: number; actitud?: number; asistencia?: number; final?: number; aprobado: boolean }[] }[];
  // Qué apartados incluir
  apartados?: ApartadosCuaderno;
  // Textos del PDF ya traducidos (claves de notebook.pdf.* del i18n activo).
  // Si no se pasa, se usan los textos en español por defecto.
  i18n?: { [key: string]: string };
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  // Exportar calificaciones a Excel
  exportarCalificacionesExcel(
    calificaciones: Calificacion[],
    alumnos: Alumno[],
    nombreModulo: string,
    evaluacion: string
  ): void {
    const data = calificaciones.map(cal => {
      const alumno = alumnos.find(a => a.id === cal.alumnoId);
      return {
        'Apellidos': alumno?.apellidos || '',
        'Nombre': alumno?.nombre || '',
        'N. Exámenes': cal.notaExamenes,
        'N. Tareas': cal.notaTareas,
        'N. Actitud': cal.notaActitud,
        'N. Asistencia': cal.notaAsistencia,
        'Nota Calculada': cal.notaCalculada,
        'Nota Final': cal.notaFinal,
        'Aprobado': cal.aprobado ? 'Sí' : 'No',
        'Necesita Recup.': cal.necesitaRecuperacion ? 'Sí' : 'No',
        'Observaciones': cal.observaciones || ''
      };
    }).sort((a, b) => a['Apellidos'].localeCompare(b['Apellidos']));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 10 }, { wch: 14 }, { wch: 30 }
    ];

    XLSX.writeFile(wb, `Calificaciones_${nombreModulo}_${evaluacion}.xlsx`);
  }

  // Exportar asistencia a Excel
  exportarAsistenciaExcel(
    resumenes: ResumenAsistencia[],
    alumnos: Alumno[],
    nombreModulo: string
  ): void {
    const data = resumenes.map(res => {
      const alumno = alumnos.find(a => a.id === res.alumnoId);
      return {
        'Apellidos': alumno?.apellidos || '',
        'Nombre': alumno?.nombre || '',
        'Total Clases': res.totalClases,
        'Presencias': res.presencias,
        'Ausen. Justif.': res.ausenciasJustificadas,
        'Ausen. Injustif.': res.ausenciasInjustificadas,
        'Retrasos': res.retrasos,
        '% Asistencia': res.porcentajeAsistencia + '%',
        'Supera Mínimo': res.superaMinimo ? 'Sí' : 'No'
      };
    }).sort((a, b) => a['Apellidos'].localeCompare(b['Apellidos']));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }
    ];

    XLSX.writeFile(wb, `Asistencia_${nombreModulo}.xlsx`);
  }

  // ============================================================
  //  RESUMEN DE ASISTENCIA — PDF (mismas columnas que el Excel)
  // ============================================================
  exportarAsistenciaPDF(
    resumenes: ResumenAsistencia[],
    alumnos: Alumno[],
    nombreModulo: string,
    extra?: { centro?: string; grupo?: string; cursoAcademico?: string; evaluacion?: string; profesor?: string }
  ): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const MX = 14;
    const NARANJA: [number, number, number] = [230, 81, 0];

    // Encabezado
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(40, 40, 40);
    doc.text('RESUMEN DE ASISTENCIA', pageW / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(extra?.centro || 'Cuaderno Digital FP · Euskadi', pageW / 2, 25, { align: 'center' });
    doc.setDrawColor(...NARANJA); doc.setLineWidth(0.6); doc.line(MX, 29, pageW - MX, 29);

    // Datos de cabecera (grupo/módulo/curso/evaluación) si vienen
    doc.setTextColor(40, 40, 40); doc.setFontSize(9);
    let hy = 36;
    const linea = (etq: string, val?: string) => {
      if (!val) return;
      doc.setFont('helvetica', 'bold'); doc.text(etq, MX, hy);
      doc.setFont('helvetica', 'normal'); doc.text(val, MX + 26, hy);
      hy += 6;
    };
    linea('Grupo:', extra?.grupo);
    linea('Módulo:', nombreModulo);
    linea('Curso:', extra?.cursoAcademico);
    linea('Evaluación:', extra?.evaluacion);

    // Ordenar por apellidos y montar filas (mismas 9 columnas que el Excel)
    const filas = resumenes.map(res => {
      const a = alumnos.find(x => x.id === res.alumnoId);
      return {
        apellidos: a?.apellidos || '',
        nombre: a?.nombre || '',
        totalClases: res.totalClases,
        presencias: res.presencias,
        justificadas: res.ausenciasJustificadas,
        injustificadas: res.ausenciasInjustificadas,
        retrasos: res.retrasos,
        porcentaje: res.porcentajeAsistencia,
        superaMinimo: res.superaMinimo
      };
    }).sort((x, y) => x.apellidos.localeCompare(y.apellidos, 'es', { sensitivity: 'base' })
      || x.nombre.localeCompare(y.nombre, 'es', { sensitivity: 'base' }));

    autoTable(doc, {
      startY: hy + 2,
      head: [['Apellidos', 'Nombre', 'Total Clases', 'Presencias', 'Ausen. Justif.', 'Ausen. Injustif.', 'Retrasos', '% Asistencia', 'Supera Mínimo']],
      body: filas.length
        ? filas.map(f => [
            f.apellidos, f.nombre, String(f.totalClases), String(f.presencias),
            String(f.justificadas), String(f.injustificadas), String(f.retrasos),
            f.porcentaje + '%', f.superaMinimo ? 'Sí' : 'No'
          ])
        : [['Sin registros de asistencia', '', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: NARANJA, textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 32 }, 1: { cellWidth: 22 },
        2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' },
        5: { halign: 'center' }, 6: { halign: 'center' },
        7: { halign: 'center', fontStyle: 'bold' }, 8: { halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && filas[data.row.index]) {
          const sup = filas[data.row.index].superaMinimo;
          // % Asistencia y Supera Mínimo coloreados según supere o no el mínimo
          if (data.column.index === 7 || data.column.index === 8) {
            data.cell.styles.textColor = sup ? [46, 125, 50] : [198, 40, 40];
          }
        }
      },
      margin: { left: MX, right: MX }
    });

    // Pie con numeración
    const totalPaginas = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(...NARANJA); doc.setLineWidth(0.4);
      doc.line(MX, pageH - 12, pageW - MX, pageH - 12);
      doc.setFontSize(8); doc.setTextColor(130);
      doc.text(extra?.centro || 'Cuaderno Digital FP · Euskadi', MX, pageH - 7);
      doc.text(`Página ${p} de ${totalPaginas}`, pageW - MX, pageH - 7, { align: 'right' });
      doc.setTextColor(0);
    }

    doc.save(`Asistencia_${nombreModulo}`.replace(/[,\s]+/g, '_') + '.pdf');
  }

  // Exportar listado de alumnos
  exportarAlumnosExcel(alumnos: Alumno[], nombreGrupo: string): void {
    const data = alumnos.map((a, i) => ({
      '#': i + 1,
      'Apellidos': a.apellidos,
      'Nombre': a.nombre,
      'Email': a.email,
      'Teléfono': a.telefono || '',
      'Estado': a.estado,
      'Repetidor': a.repetidor ? 'Sí' : 'No',
      'Observaciones': a.observaciones || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');

    XLSX.writeFile(wb, `Alumnos_${nombreGrupo}.xlsx`);
  }

  // ============================================================
  //  ACTA DE EVALUACIÓN — PDF oficial (imprimible y firmable)
  // ============================================================
  exportarActaPDF(datos: DatosActa): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 14;

    // ---- Cabecera ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('ACTA DE EVALUACIÓN', pageW / 2, 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(datos.centro, pageW / 2, 25, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(106, 27, 154); // morado, a juego con el icono del acta
    doc.setLineWidth(0.6);
    doc.line(marginX, 29, pageW - marginX, 29);

    // ---- Datos de la sesión ----
    doc.setFontSize(10);
    const infoY = 37;
    const col2X = pageW / 2 + 4;
    doc.setFont('helvetica', 'bold'); doc.text('Grupo:', marginX, infoY);
    doc.setFont('helvetica', 'normal'); doc.text(datos.grupo, marginX + 22, infoY);
    doc.setFont('helvetica', 'bold'); doc.text('Módulo:', marginX, infoY + 6);
    doc.setFont('helvetica', 'normal'); doc.text(datos.modulo, marginX + 22, infoY + 6);
    doc.setFont('helvetica', 'bold'); doc.text('Curso:', col2X, infoY);
    doc.setFont('helvetica', 'normal'); doc.text(datos.cursoAcademico, col2X + 22, infoY);
    doc.setFont('helvetica', 'bold'); doc.text('Evaluación:', col2X, infoY + 6);
    doc.setFont('helvetica', 'normal'); doc.text(datos.evaluacion, col2X + 22, infoY + 6);
    doc.setFont('helvetica', 'bold'); doc.text('Fecha:', marginX, infoY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-ES'), marginX + 22, infoY + 12);

    // ---- Tabla de alumnos ----
    const filasOrdenadas = [...datos.filas].sort((a, b) =>
      a.alumnoNombre.localeCompare(b.alumnoNombre));

    const body = filasOrdenadas.map((f, i) => [
      String(i + 1),
      f.alumnoNombre,
      f.nota != null ? f.nota.toFixed(2) : '—',
      f.aprobado ? 'APTO' : 'NO APTO',
      f.observaciones || ''
    ]);

    autoTable(doc, {
      startY: infoY + 18,
      head: [['#', 'Alumno/a', 'Calif.', 'Resultado', 'Observaciones']],
      body,
      theme: 'grid',
      headStyles: { fillColor: [106, 27, 154], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 'auto' }
      },
      // Colorear el resultado: rojo si NO APTO
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'NO APTO') {
            data.cell.styles.textColor = [198, 40, 40];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'APTO') {
            data.cell.styles.textColor = [46, 125, 50];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: marginX, right: marginX }
    });

    // ---- Estadísticas ----
    const est = datos.estadisticas;
    let y = (doc as any).lastAutoTable.finalY + 10;

    // Salto de página si no cabe el bloque de estadísticas + firma
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Estadísticas de la sesión', marginX, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [['Total', 'Aptos', 'No aptos', 'No evaluados', 'Nota media', '% Aptos']],
      body: [[
        String(est.totalAlumnos),
        String(est.aprobados),
        String(est.suspensos),
        String(est.noEvaluados),
        est.notaMedia.toFixed(2),
        est.porcentajeAprobados + '%'
      ]],
      theme: 'grid',
      headStyles: { fillColor: [55, 71, 79], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 10, halign: 'center' },
      margin: { left: marginX, right: marginX }
    });

    // ---- Firma ----
    y = (doc as any).lastAutoTable.finalY + 25;
    if (y > 270) { doc.addPage(); y = 40; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('El/La profesor/a', marginX, y);
    doc.line(marginX, y + 18, marginX + 70, y + 18);
    doc.text(datos.profesor, marginX, y + 24);

    // ---- Pie con numeración ----
    const totalPaginas = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${p} de ${totalPaginas}`,
        pageW - marginX, doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
      doc.setTextColor(0);
    }

    const nombreArchivo =
      `Acta_${datos.modulo}_${datos.grupo}_${datos.evaluacion}`.replace(/\s+/g, '_');
    doc.save(`${nombreArchivo}.pdf`);
  }

  // ============================================================
  //  INFORME INDIVIDUAL DEL ALUMNO — PDF
  // ============================================================
  exportarInformeAlumnoPDF(datos: DatosInformeAlumno): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 14;

    // ---- Cabecera ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('INFORME DEL ALUMNO/A', pageW / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(datos.centro, pageW / 2, 25, { align: 'center' });

    doc.setDrawColor(198, 40, 40); // rojo, a juego con el icono del informe individual
    doc.setLineWidth(0.6);
    doc.line(marginX, 29, pageW - marginX, 29);

    // ---- Datos del alumno ----
    const infoY = 37;
    const col2X = pageW / 2 + 4;
    doc.setFont('helvetica', 'bold'); doc.text('Alumno/a:', marginX, infoY);
    doc.setFont('helvetica', 'normal'); doc.text(datos.alumnoNombre, marginX + 24, infoY);
    doc.setFont('helvetica', 'bold'); doc.text('Grupo:', marginX, infoY + 6);
    doc.setFont('helvetica', 'normal'); doc.text(datos.grupo, marginX + 24, infoY + 6);
    doc.setFont('helvetica', 'bold'); doc.text('Curso:', col2X, infoY);
    doc.setFont('helvetica', 'normal'); doc.text(datos.cursoAcademico, col2X + 24, infoY);
    doc.setFont('helvetica', 'bold'); doc.text('Fecha:', col2X, infoY + 6);
    doc.setFont('helvetica', 'normal'); doc.text(new Date().toLocaleDateString('es-ES'), col2X + 24, infoY + 6);
    if (datos.dni) {
      doc.setFont('helvetica', 'bold'); doc.text('DNI/NIE:', marginX, infoY + 12);
      doc.setFont('helvetica', 'normal'); doc.text(datos.dni, marginX + 24, infoY + 12);
    }

    // ---- Resumen ----
    let y = infoY + 20;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Resumen académico', marginX, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Módulos aprobados', 'Módulos suspensos', 'Nota media']],
      body: [[
        `${datos.stats.modulosAprobados}/${datos.stats.totalModulos}`,
        String(datos.stats.modulosSuspensos),
        datos.stats.mediaGeneral.toFixed(1)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [55, 71, 79], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 11, halign: 'center' },
      margin: { left: marginX, right: marginX }
    });

    // ---- Calificaciones ----
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Calificaciones por módulo', marginX, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Módulo', 'Conv.', 'Estado', 'Nota']],
      body: datos.matriculas.length
        ? datos.matriculas.map(m => [
            m.moduloNombre,
            m.convocatoria ? `${m.convocatoria}ª` : '—',
            m.estado || '—',
            m.notaFinal != null ? m.notaFinal.toFixed(1) : '—'
          ])
        : [['Sin matrículas registradas', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 3: { halign: 'center', cellWidth: 20 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw !== '—') {
          const n = parseFloat(String(data.cell.raw).replace(',', '.'));
          if (!isNaN(n)) {
            data.cell.styles.textColor = n >= 5 ? [46, 125, 50] : [198, 40, 40];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: marginX, right: marginX }
    });

    // ---- Asistencia ----
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Asistencia', marginX, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Módulo', 'Present.', 'Justif.', 'Injustif.', 'Retrasos', '% Asist.']],
      body: datos.asistencia.length
        ? datos.asistencia.map(a => [
            a.modulo, String(a.presencias), String(a.justificadas),
            String(a.injustificadas), String(a.retrasos), a.porcentaje + '%'
          ])
        : [['Sin registros de asistencia', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [230, 81, 0], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== '') {
          const pct = parseFloat(String(data.cell.raw));
          if (!isNaN(pct)) {
            data.cell.styles.textColor = pct >= 85 ? [46, 125, 50] : [198, 40, 40];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: marginX, right: marginX }
    });

    // ---- Observaciones ----
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Observaciones', marginX, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Título', 'Descripción']],
      body: datos.observaciones.length
        ? datos.observaciones.map(o => [o.fecha, o.tipo, o.titulo, o.descripcion])
        : [['—', '—', 'Sin observaciones', '']],
      theme: 'grid',
      headStyles: { fillColor: [69, 90, 100], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 24 }, 2: { cellWidth: 45 } },
      margin: { left: marginX, right: marginX }
    });

    // ---- Pie con numeración ----
    const totalPaginas = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Página ${p} de ${totalPaginas}`,
        pageW - marginX, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      doc.setTextColor(0);
    }

    const nombreArchivo = `Informe_${datos.alumnoNombre}`.replace(/[,\s]+/g, '_');
    doc.save(`${nombreArchivo}.pdf`);
  }

  

  // ============================================================
  //  CUADERNO COMPLETO — PDF moderno con color y gráficos
  // ============================================================
  exportarCuadernoCompletoPDF(d: DatosCuadernoCompleto): Blob {
    // Textos del PDF: usa los traducidos (d.i18n) y, si falta alguno, cae al español por defecto.
    const PDF_ES: { [k: string]: string } = {
      title_cover: 'CUADERNO DIGITAL', course_prefix: 'Curso', teacher: 'Profesor/a', generated_on: 'Generado',
      kpi_students: 'Alumnos', kpi_attendance_avg: 'Asist. media', kpi_grade_avg: 'Nota media',
      kpi_pct_pass: '% Aptos', kpi_at_risk: 'En riesgo', contents: 'Contenido',
      idx_orla: 'Orla del grupo', idx_schedule: 'Horario del grupo y del módulo', idx_eval_dates: 'Fechas de evaluación',
      idx_records: 'Actas de evaluación', idx_timeline: 'Temporalización', idx_attendance: 'Control de asistencia',
      idx_tasks: 'Tareas (por evaluación y UD)', idx_exams_recovery: 'Exámenes y recuperaciones', idx_summary: 'Resumen por evaluación',
      sec_orla: 'Orla del grupo', orla_no_photos: 'No hay fotos de alumnos disponibles para generar la orla.',
      sec_schedule: 'Horario del grupo y del módulo', schedule_full: 'Horario completo del grupo',
      schedule_module: 'Horario del módulo {{modulo}} (profesor/a del cuaderno)', col_slot: 'Franja',
      day_mon: 'Lunes', day_tue: 'Martes', day_wed: 'Miércoles', day_thu: 'Jueves', day_fri: 'Viernes',
      sec_eval_dates: 'Fechas de evaluación', col_evaluation: 'Evaluación', col_start: 'Inicio', col_end: 'Fin',
      no_periods: 'Sin periodos definidos', sec_records: 'Actas de evaluación', no_records: 'Sin actas registradas.',
      col_num: '#', col_student: 'Alumno/a', col_grade: 'Nota', col_result: 'Calificación', no_grades: 'Sin calificaciones',
      result_pass: 'APTO', result_fail: 'NO APTO',
      foot_summary: 'Aptos: {{aprobados}}  ·  No aptos: {{suspensos}}  ·  No eval.: {{noEval}}', avg: 'Media',
      sec_timeline: 'Temporalización', col_type: 'Tipo', col_title: 'Título', no_events: 'Sin eventos',
      sec_attendance: 'Control de asistencia', col_justified: 'Just.', col_unjustified: 'Injust.', col_absences: 'Faltas',
      col_pct_attendance: '% Asist.', no_attendance: 'Sin registros', attendance_detail: 'Detalle personalizado por alumno',
      col_classes: 'Clases', col_present: 'Asist.', col_late: 'Retr.', sec_tasks: 'Tareas',
      attendance_report: 'Informe de faltas por alumno', no_faults_student: 'Sin faltas registradas.',
      justified: 'Justificada', unjustified: 'Injustificada',
      tasks_overview: 'Vista general (por evaluación y unidad didáctica)', no_tasks: 'Sin tareas registradas.',
      col_detail: 'Detalle', no_items: 'Sin elementos', detail_by_student: 'Detalle por alumno', col_task: 'Tarea', col_date: 'Fecha',
      sec_exams_recovery: 'Exámenes y recuperaciones', no_data: 'Sin datos registrados.', exams: 'Exámenes',
      no_exams_eval: 'Sin exámenes en esta evaluación.', recoveries: 'Recuperaciones',
      no_recoveries_eval: 'Sin recuperaciones en esta evaluación.', no_students: 'Sin alumnos', col_status: 'Estado',
      no_summoned: 'Sin convocados', np: 'NP', summary_prefix: 'Resumen', col_tasks: 'Tareas', col_exams: 'Exám.',
      col_attitude: 'Actitud', col_attendance_short: 'Asist.', col_final: 'Final',
      summary_legend: 'Tareas, Exámenes, Actitud y Asistencia son las notas que componen la nota final de la evaluación.',
      sec_summary: 'Resumen por evaluación', no_summary: 'Sin calificaciones registradas.',
      footer: 'Cuaderno Digital FP · Euskadi', page: 'Página {{p}} de {{total}}', locale: 'es-ES'
    };
    const i18n = d.i18n || {};
    const t = (key: string, params?: { [k: string]: string | number }): string => {
      let s = (i18n[key] != null && i18n[key] !== '') ? i18n[key] : (PDF_ES[key] ?? key);
      if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{{${k}}}`, String(v));
      return s;
    };
    const loc = t('locale') || 'es-ES';

    // Calificación cualitativa a partir de la nota (escala española FP)
    const calificacionCualitativa = (nota: number | null | undefined): string => {
      if (nota == null || isNaN(Number(nota))) return '—';
      const n = Number(nota);
      if (n < 5) return 'SUSPENSO';
      if (n < 6) return 'APROBADO';
      if (n < 7) return 'BIEN';
      if (n < 9) return 'NOTABLE';
      return 'SOBRESALIENTE';
    };
    // Color por calificación: suspenso rojo, resto verde
    const colorCalificacion = (label: string): [number, number, number] =>
      label === 'SUSPENSO' ? [198, 40, 40] : [46, 125, 50];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 14;
    const PURPLE: [number, number, number] = [106, 27, 154];
    const INK: [number, number, number] = [38, 50, 56];
    const ap = d.apartados || {};
    const inc = (k: keyof ApartadosCuaderno) => ap[k] !== false; // por defecto incluido

    // Estado de página: y actual y control de primera página
    let y = 20;
    let primeraPagina = true;

    // Abre una página nueva para un apartado (salvo la portada, que ya está)
    const nuevaPagina = () => { doc.addPage(); y = 20; };

    // Título de apartado numerado
    let numApartado = 0;
    const apartado = (titulo: string, color: [number, number, number]) => {
      if (!primeraPagina) nuevaPagina();
      primeraPagina = false;
      numApartado++;
      doc.setFillColor(...color);
      doc.rect(MX, y, 3, 8, 'F');
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`${numApartado} · ${titulo}`, MX + 6, y + 6.5);
      y += 14;
    };

    const saltoSiHaceFalta = (alto: number) => { if (y > H - alto) nuevaPagina(); };
    const afterTable = () => { y = (doc as any).lastAutoTable.finalY + 8; };

    // ============ 1. PORTADA ============
    if (inc('portada')) {
      // Imagen de fondo de la cabecera (sustituye a la antigua banda morada).
      // Si la imagen no se pudiera pintar, se usa el morado de respaldo.
      try {
        doc.addImage(PORTADA_CUADERNO_BG, 'JPEG', 0, 0, W, 90);
      } catch {
        doc.setFillColor(...PURPLE);
        doc.rect(0, 0, W, 90, 'F');
      }
      // Velo oscuro semitransparente para que el texto blanco siga siendo legible.
      try {
        const GStateCtor = (doc as any).GState;
        if (GStateCtor && (doc as any).setGState) {
          (doc as any).setGState(new GStateCtor({ opacity: 0.62 }));
          doc.setFillColor(40, 12, 60);
          doc.rect(0, 0, W, 90, 'F');
          (doc as any).setGState(new GStateCtor({ opacity: 1 }));
        }
      } catch { /* sin soporte de GState: se deja la imagen sin velo */ }
      // Franja inferior morada (se mantiene como antes)
      doc.setFillColor(126, 47, 174);
      doc.rect(0, 90, W, 6, 'F');

      // —— Cabecera centrada ——
      const cx0 = W / 2;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text(t('title_cover'), cx0, 40, { align: 'center' });

      // Ciclo (nombre completo), en blanco
      const cicloLinea = d.cicloNombre || `${d.modulo} · ${d.grupo}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text(cicloLinea, cx0, 58, { align: 'center' });

      // Módulo (nombre completo), en blanco
      const moduloLinea = d.moduloNombre || d.modulo;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.text(moduloLinea, cx0, 68, { align: 'center' });

      // Curso académico (sin "Todo el curso"), en blanco; si hay evaluación concreta, se antepone
      const esCursoCompleto = /todo el curso|curso completo|ikasturte osoa|whole course/i.test(d.evaluacion || '');
      const cursoLinea = esCursoCompleto
        ? `${t('course_prefix')} ${d.cursoAcademico}`
        : `${d.evaluacion}  ·  ${t('course_prefix')} ${d.cursoAcademico}`;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(cursoLinea, cx0, 77, { align: 'center' });

      doc.setTextColor(...INK);
      doc.setFontSize(11);
      doc.text(`${t('teacher')}: ${d.profesor}`, MX, 112);
      doc.text(`${t('generated_on')}: ${new Date().toLocaleDateString(loc)}`, MX, 119);

      // KPIs en tarjetas
      const kpis = [
        { label: t('kpi_students'), value: String(d.kpis.totalAlumnos), color: [21, 101, 192] as [number, number, number] },
        { label: t('kpi_attendance_avg'), value: d.kpis.asistenciaMedia + '%', color: [230, 81, 0] as [number, number, number] },
        { label: t('kpi_grade_avg'), value: d.kpis.notaMedia.toFixed(1), color: [46, 125, 50] as [number, number, number] },
        { label: t('kpi_pct_pass'), value: d.kpis.porcentajeAprobados + '%', color: [106, 27, 154] as [number, number, number] },
        { label: t('kpi_at_risk'), value: String(d.kpis.enRiesgo), color: [198, 40, 40] as [number, number, number] }
      ];
      const cardW = (W - MX * 2 - 4 * 4) / 5;
      let cx = MX; const cardY = 134;
      for (const k of kpis) {
        doc.setFillColor(248, 248, 250);
        doc.roundedRect(cx, cardY, cardW, 26, 2, 2, 'F');
        doc.setFillColor(...k.color);
        doc.rect(cx, cardY, cardW, 3, 'F');
        doc.setTextColor(...k.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(k.value, cx + cardW / 2, cardY + 14, { align: 'center' });
        doc.setTextColor(110, 110, 110);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(k.label, cx + cardW / 2, cardY + 21, { align: 'center' });
        cx += cardW + 4;
      }
      // Índice de contenidos
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(t('contents'), MX, 180);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const indice = [
        inc('orla') && t('idx_orla'),
        inc('horario') && t('idx_schedule'),
        inc('fechasEval') && t('idx_eval_dates'),
        inc('actas') && t('idx_records'),
        inc('temporalizacion') && t('idx_timeline'),
        inc('asistencia') && t('idx_attendance'),
        inc('tareas') && t('idx_tasks'),
        (inc('examenes') || inc('recuperaciones')) && t('idx_exams_recovery'),
        inc('calificaciones') && t('idx_summary')
      ].filter(Boolean) as string[];
      let iy = 188;
      indice.forEach((t, i) => { doc.text(`${i + 1}.  ${t}`, MX + 4, iy); iy += 6; });
      primeraPagina = false; // la portada ocupa la primera página
    }

    // ============ 2. ORLA ============
    if (inc('orla')) {
      apartado(t('sec_orla'), [156, 39, 176]);
      const conFoto = d.alumnos.filter(a => a.fotoUrl);
      if (!conFoto.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(120);
        doc.text(t('orla_no_photos'), MX, y + 4);
        doc.setTextColor(0); y += 12;
      } else {
        // Tamaño FIJO de foto: siempre 5 columnas, todas las celdas iguales
        // independientemente del número de alumnos (evita discrepancias de tamaño).
        const cols = 5;
        const gap = 5;
        const cellW = (W - MX * 2 - gap * (cols - 1)) / cols;
        const cellH = cellW * 1.12;
        const labelGap = 8;            // espacio para el nombre bajo la foto
        let col = 0, rowY = y;
        for (const a of d.alumnos) {
          if (rowY + cellH > H - 16) { nuevaPagina(); rowY = y = 20; col = 0; }
          const px = MX + col * (cellW + gap);
          doc.setDrawColor(220); doc.setFillColor(245, 245, 248);
          doc.roundedRect(px, rowY, cellW, cellH, 2, 2, 'FD');
          if (a.fotoUrl) {
            try { doc.addImage(a.fotoUrl, 'JPEG', px + 1.5, rowY + 1.5, cellW - 3, cellH - labelGap - 1.5); }
            catch { /* formato no soportado: se deja el hueco */ }
          }
          doc.setFontSize(5.5); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
          const nm = `${a.apellidos}, ${a.nombre}`;
          const maxCh = 26;
          doc.text(nm.length > maxCh ? nm.slice(0, maxCh - 1) + '…' : nm, px + cellW / 2, rowY + cellH - 3, { align: 'center' });
          col++;
          if (col === cols) { col = 0; rowY += cellH + gap; }
        }
        y = (col === 0 ? rowY : rowY + cellH + gap) + 4;
      }
    }

    // ============ 3. HORARIO ============
    if (inc('horario')) {
      apartado(t('sec_schedule'), [21, 101, 192]);
      const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
      const diasLabel = [t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri')];
      const franjas = Array.from(new Set((d.horario || []).map(f => `${f.horaInicio}-${f.horaFin}`)))
        .sort();
      const celda = (dia: string, fr: string) =>
        (d.horario || []).find(f => f.dia === dia && `${f.horaInicio}-${f.horaFin}` === fr) || null;

      const construirTabla = (soloModulo: boolean, titulo: string) => {
        saltoSiHaceFalta(70);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
        doc.text(titulo, MX, y); y += 4;
        autoTable(doc, {
          startY: y,
          head: [[t('col_slot'), ...diasLabel]],
          body: (franjas.length ? franjas : ['—']).map(fr => {
            const fila = [fr.replace('-', ' - ')];
            for (const dia of dias) {
              const c = celda(dia, fr);
              if (!c) { fila.push(''); continue; }
              if (soloModulo && !c.esDelModulo) { fila.push(''); continue; }
              fila.push(`${c.modulo}${c.aula ? '\n' + c.aula : ''}`);
            }
            return fila;
          }),
          theme: 'grid',
          headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7.5, halign: 'center', minCellHeight: 8 },
          columnStyles: { 0: { cellWidth: 24, fontStyle: 'bold', halign: 'left' } },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
              const fr = franjas[data.row.index];
              const c = celda(dias[data.column.index - 1], fr);
              if (c?.esDelModulo) { data.cell.styles.fillColor = [232, 245, 233]; data.cell.styles.textColor = [46, 125, 50]; data.cell.styles.fontStyle = 'bold'; }
            }
          },
          margin: { left: MX, right: MX }
        });
        afterTable();
      };

      construirTabla(false, t('schedule_full'));
      construirTabla(true, t('schedule_module', { modulo: d.modulo }));
    }

    // ============ 4. FECHAS DE EVALUACIÓN ============
    if (inc('fechasEval')) {
      apartado(t('sec_eval_dates'), [0, 131, 143]);
      autoTable(doc, {
        startY: y,
        head: [[t('col_evaluation'), t('col_start'), t('col_end')]],
        body: (d.periodos && d.periodos.length)
          ? d.periodos.map(p => [p.evaluacion, p.inicio, p.fin])
          : [[t('no_periods'), '—', '—']],
        theme: 'grid',
        headStyles: { fillColor: [0, 131, 143], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'center', cellWidth: 36 }, 2: { halign: 'center', cellWidth: 36 } },
        margin: { left: MX, right: MX }
      });
      afterTable();
    }

    // ============ 5. ACTAS DE EVALUACIÓN ============
    if (inc('actas')) {
      apartado(t('sec_records'), [46, 125, 50]);
      const actas = d.actasPorEval || [];
      if (!actas.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(120);
        doc.text(t('no_records'), MX, y + 2); doc.setTextColor(0); y += 10;
      }
      for (const acta of actas) {
        saltoSiHaceFalta(60);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
        doc.text(acta.evaluacion, MX, y); y += 4;
        const RESULT_PASS = t('result_pass');
        const RESULT_FAIL = t('result_fail');
        autoTable(doc, {
          startY: y,
          head: [[t('col_num'), t('col_student'), t('col_grade'), t('col_result')]],
          body: acta.filas.length
            ? acta.filas.map((f, i) => [String(i + 1), f.alumno, f.nota != null ? f.nota.toFixed(2) : '—', calificacionCualitativa(f.nota)])
            : [['—', t('no_grades'), '', '']],
          foot: [[
            '', t('foot_summary', { aprobados: acta.estadisticas.aprobados, suspensos: acta.estadisticas.suspensos, noEval: acta.estadisticas.noEvaluados }),
            t('avg'), acta.estadisticas.notaMedia.toFixed(2)
          ]],
          theme: 'grid',
          headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
          bodyStyles: { fontSize: 8 },
          footStyles: { fillColor: [241, 248, 233], textColor: [46, 125, 50], fontStyle: 'bold', fontSize: 7.5 },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center', cellWidth: 22 }, 3: { halign: 'center', cellWidth: 30 } },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3 && typeof data.cell.raw === 'string' && data.cell.raw !== '') {
              data.cell.styles.textColor = colorCalificacion(data.cell.raw);
              data.cell.styles.fontStyle = 'bold';
            }
          },
          margin: { left: MX, right: MX }
        });
        afterTable();
      }
    }

    // ============ 6. TEMPORALIZACIÓN (texto + gráfico) ============
    if (inc('temporalizacion')) {
      apartado(t('sec_timeline'), [255, 143, 0]);
      const temporal = d.temporalizacionPorEval || [];
      for (const ev of temporal) {
        saltoSiHaceFalta(50);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
        doc.text(ev.evaluacion, MX, y); y += 5;

        // Gráfico: línea temporal sencilla con puntos por evento
        const gx = MX, gw = W - MX * 2, gy = y, gh = 16;
        doc.setDrawColor(200); doc.setLineWidth(0.3);
        doc.line(gx, gy + gh / 2, gx + gw, gy + gh / 2);
        const n = ev.eventos.length || 1;
        ev.eventos.forEach((e, i) => {
          const px = gx + (gw * (i + 0.5)) / n;
          const col: [number, number, number] = e.tipo === 'examen' ? [198, 40, 40] : e.tipo === 'actividad' ? [46, 125, 50] : [21, 101, 192];
          doc.setFillColor(...col);
          doc.circle(px, gy + gh / 2, 1.6, 'F');
          doc.setFontSize(5.5); doc.setTextColor(120);
          doc.text(e.fecha, px, gy + gh / 2 + 5, { align: 'center' });
        });
        y += gh + 6;

        // Texto: tabla de eventos
        autoTable(doc, {
          startY: y,
          head: [[t('col_type'), t('col_title'), t('col_start'), t('col_end')]],
          body: ev.eventos.length
            ? ev.eventos.map(e => [e.tipo, e.titulo, e.fecha, e.fechaFin || '—'])
            : [['—', t('no_events'), '', '']],
          theme: 'striped',
          headStyles: { fillColor: [255, 143, 0], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' } },
          margin: { left: MX, right: MX }
        });
        afterTable();
      }
    }

    // ============ 7. ASISTENCIA ============
    if (inc('asistencia')) {
      apartado(t('sec_attendance'), [230, 81, 0]);
      autoTable(doc, {
        startY: y,
        head: [[t('col_num'), t('col_student'), t('col_justified'), t('col_unjustified'), t('col_absences'), t('col_pct_attendance'), '']],
        body: d.asistencia.length
          ? d.asistencia.map((a, i) => [String(i + 1), a.alumno, String(a.justificadas ?? '—'), String(a.injustificadas ?? '—'), String(a.faltas), a.porcentaje + '%', ''])
          : [['—', t('no_attendance'), '', '', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [230, 81, 0], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8, minCellHeight: 7 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'center', cellWidth: 16 }, 3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'center', cellWidth: 16 }, 5: { halign: 'center', cellWidth: 22 }, 6: { cellWidth: 40 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5 && d.asistencia[data.row.index]) {
            const sup = d.asistencia[data.row.index].superaMinimo;
            data.cell.styles.textColor = sup ? [46, 125, 50] : [198, 40, 40];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 6 && d.asistencia[data.row.index]) {
            const pct = d.asistencia[data.row.index].porcentaje;
            const sup = d.asistencia[data.row.index].superaMinimo;
            const bx = data.cell.x + 2, by = data.cell.y + data.cell.height / 2 - 1.5, bw = data.cell.width - 4;
            doc.setFillColor(230, 230, 230);
            doc.roundedRect(bx, by, bw, 3, 1, 1, 'F');
            doc.setFillColor(...(sup ? [46, 125, 50] : [198, 40, 40]) as [number, number, number]);
            doc.roundedRect(bx, by, bw * Math.min(pct, 100) / 100, 3, 1, 1, 'F');
          }
        },
        margin: { left: MX, right: MX }
      });
      afterTable();

      // Detalle personalizado por alumno
      const det = d.asistenciaDetalle || [];
      if (det.length) {
        saltoSiHaceFalta(20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
        doc.text(t('attendance_detail'), MX, y); y += 5;
        autoTable(doc, {
          startY: y,
          head: [[t('col_num'), t('col_student'), t('col_classes'), t('col_present'), t('col_justified'), t('col_unjustified'), t('col_late'), t('col_pct_attendance')]],
          body: det.map((a, i) => [
            String(i + 1), a.alumno, String(a.totalClases), String(a.presencias),
            String(a.justificadas), String(a.injustificadas), String(a.retrasos), a.porcentaje + '%'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [230, 81, 0], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 9, halign: 'center' },
            2: { halign: 'center', cellWidth: 16 }, 3: { halign: 'center', cellWidth: 16 },
            4: { halign: 'center', cellWidth: 16 }, 5: { halign: 'center', cellWidth: 16 },
            6: { halign: 'center', cellWidth: 14 }, 7: { halign: 'center', cellWidth: 20 }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 7 && det[data.row.index]) {
              const sup = det[data.row.index].superaMinimo;
              data.cell.styles.textColor = sup ? [46, 125, 50] : [198, 40, 40];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          margin: { left: MX, right: MX }
        });
        afterTable();
      }

      // ---- Informe de faltas por alumno: ficha-resumen + listado de fechas ----
      const faltasAlumnos = d.faltasPorAlumno || [];
      if (faltasAlumnos.length) {
        saltoSiHaceFalta(20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
        doc.text(t('attendance_report'), MX, y); y += 6;

        for (const al of faltasAlumnos) {
          // Cabecera-ficha del alumno con acumulados (siempre, aunque no tenga faltas)
          saltoSiHaceFalta(22);
          doc.setFillColor(255, 243, 224);
          doc.roundedRect(MX, y, W - MX * 2, 9, 1.5, 1.5, 'F');
          doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
          doc.text(al.alumno, MX + 4, y + 6);
          const resumenTxt = `${t('col_justified')}: ${al.justificadas}   ${t('col_unjustified')}: ${al.injustificadas}   ${t('col_absences')}: ${al.total}`;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120, 60, 0);
          doc.text(resumenTxt, W - MX - 4, y + 6, { align: 'right' });
          doc.setTextColor(0);
          y += 12;

          if (!al.fechas.length) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(140);
            doc.text(t('no_faults_student'), MX + 4, y); doc.setTextColor(0); y += 8;
            continue;
          }

          // Listado de fechas día a día (estado justificada/injustificada)
          autoTable(doc, {
            startY: y,
            head: [[t('col_num'), t('col_date'), t('col_status')]],
            body: al.fechas.map((f, i) => [
              String(i + 1), f.fecha, f.tipo === 'J' ? t('justified') : t('unjustified')
            ]),
            theme: 'striped',
            headStyles: { fillColor: [230, 81, 0], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { fontSize: 7.5 },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 34, halign: 'center' },
              2: { cellWidth: 36, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 2) {
                const justTxt = t('justified');
                data.cell.styles.textColor = data.cell.raw === justTxt ? [230, 81, 0] : [198, 40, 40];
              }
            },
            margin: { left: MX, right: MX }
          });
          afterTable();
        }
      }
    }
    const seccionTareas = () => {
      apartado(t('sec_tasks'), [2, 136, 209]);
      const color: [number, number, number] = [2, 136, 209];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
      doc.text(t('tasks_overview'), MX, y); y += 5;
      const grupos = d.tareasAgrupadas || [];
      if (!grupos.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(t('no_tasks'), MX, y); doc.setTextColor(0); y += 8;
      }
      for (const ev of grupos) {
        for (const ud of ev.unidades) {
          saltoSiHaceFalta(40);
          autoTable(doc, {
            startY: y,
            head: [[`${ev.evaluacion}  ·  ${ud.unidad}`, t('col_date'), t('col_detail')]],
            body: ud.items.length ? ud.items.map(it => [it.titulo, it.fecha, it.extra || '']) : [[t('no_items'), '', '']],
            theme: 'striped',
            headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { cellWidth: 26, halign: 'center' }, 2: { cellWidth: 42 } },
            margin: { left: MX, right: MX }
          });
          afterTable();
        }
      }
      saltoSiHaceFalta(30);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
      doc.text(t('detail_by_student'), MX, y); y += 5;
      for (const al of d.detallePorAlumno) {
        const filas = (al.tareas as any[]).map(x => [x.titulo, x.nota != null ? Number(x.nota).toFixed(2) : '—']);
        if (!filas.length) continue;
        saltoSiHaceFalta(24);
        doc.setFillColor(236, 239, 244);
        doc.roundedRect(MX, y, W - MX * 2, 7, 1.5, 1.5, 'F');
        doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(al.alumno, MX + 4, y + 5); y += 9;
        autoTable(doc, {
          startY: y,
          head: [[t('col_task'), t('col_grade')]],
          body: filas,
          theme: 'grid',
          headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: { 1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' } },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
              const n = parseFloat(String(data.cell.raw).replace(',', '.'));
              if (!isNaN(n)) data.cell.styles.textColor = n >= 5 ? [46, 125, 50] : [198, 40, 40];
            }
          },
          margin: { left: MX, right: MX }
        });
        afterTable();
      }
    };

    // --- EXÁMENES: por cada examen, título + fecha/hora y alumnos ordenados con su nota ---
    // --- EXÁMENES Y RECUPERACIONES: juntos, por evaluación (las 4 siempre) ---
    const seccionExamenesYRecuperaciones = () => {
      apartado(t('sec_exams_recovery'), [198, 40, 40]);
      const colorEx: [number, number, number] = [198, 40, 40];
      const colorRec: [number, number, number] = [255, 143, 0];
      const grupos = d.actividadesPorEval || [];
      if (!grupos.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(t('no_data'), MX, y); doc.setTextColor(0); y += 8;
      }
      for (const ev of grupos) {
        // Cabecera de evaluación
        saltoSiHaceFalta(24);
        doc.setFillColor(238, 238, 240);
        doc.roundedRect(MX, y, W - MX * 2, 9, 1.5, 1.5, 'F');
        doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(ev.evaluacion, MX + 4, y + 6); y += 13;

        // ---- Exámenes de la evaluación ----
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...colorEx);
        doc.text(t('exams'), MX, y); doc.setTextColor(0); y += 4;
        if (!ev.examenes.length) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(140);
          doc.text(t('no_exams_eval'), MX + 2, y + 2); doc.setTextColor(0); y += 8;
        }
        for (const ex of ev.examenes) {
          saltoSiHaceFalta(46);
          doc.setFillColor(252, 235, 235);
          doc.roundedRect(MX, y, W - MX * 2, 13, 1.5, 1.5, 'F');
          doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text(ex.titulo, MX + 4, y + 5.5);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
          doc.text(`${ex.unidad}  ·  ${ex.fechaHora}`, MX + 4, y + 10.5);
          y += 16;
          autoTable(doc, {
            startY: y,
            head: [[t('col_num'), t('col_student'), t('col_grade')]],
            body: ex.alumnos.length
              ? ex.alumnos.map((a, i) => [String(i + 1), a.alumno, a.noPresente ? t('np') : (a.nota != null ? Number(a.nota).toFixed(2) : '—')])
              : [['—', t('no_students'), '']],
            theme: 'striped',
            headStyles: { fillColor: colorEx, textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' } },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 2) {
                const raw = String(data.cell.raw);
                if (raw === t('np')) data.cell.styles.textColor = [120, 120, 120];
                else { const n = parseFloat(raw.replace(',', '.')); if (!isNaN(n)) data.cell.styles.textColor = n >= (ex.notaMin ?? 5) ? [46, 125, 50] : [198, 40, 40]; }
              }
            },
            margin: { left: MX, right: MX }
          });
          afterTable();
        }

        // ---- Recuperaciones de la evaluación ----
        saltoSiHaceFalta(20);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...colorRec);
        doc.text(t('recoveries'), MX, y); doc.setTextColor(0); y += 4;
        if (!ev.recuperaciones.length) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(140);
          doc.text(t('no_recoveries_eval'), MX + 2, y + 2); doc.setTextColor(0); y += 10;
        }
        for (const r of ev.recuperaciones) {
          saltoSiHaceFalta(46);
          doc.setFillColor(255, 243, 224);
          doc.roundedRect(MX, y, W - MX * 2, 13, 1.5, 1.5, 'F');
          doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text(r.titulo, MX + 4, y + 5.5);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
          doc.text(`${r.unidad}  ·  ${r.fechaHora}`, MX + 4, y + 10.5);
          y += 16;
          autoTable(doc, {
            startY: y,
            head: [[t('col_num'), t('col_student'), t('col_status'), t('col_grade')]],
            body: r.alumnos.length
              ? r.alumnos.map((a, i) => [String(i + 1), a.alumno, a.estado || '—', a.nota != null ? Number(a.nota).toFixed(2) : '—'])
              : [['—', t('no_summoned'), '', '']],
            theme: 'striped',
            headStyles: { fillColor: colorRec, textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' } },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 3) {
                const n = parseFloat(String(data.cell.raw).replace(',', '.'));
                if (!isNaN(n)) data.cell.styles.textColor = n >= 5 ? [46, 125, 50] : [198, 40, 40];
              }
            },
            margin: { left: MX, right: MX }
          });
          afterTable();
        }
        y += 4;
      }
    };

    // ============ 8. TAREAS ============
    if (inc('tareas')) seccionTareas();

    // ============ 9. EXÁMENES Y RECUPERACIONES ============
    if (inc('examenes') || inc('recuperaciones')) seccionExamenesYRecuperaciones();

    // ============ 11. RESUMEN POR EVALUACIÓN (desglose) ============
    if (inc('calificaciones')) {
      const resumen = d.resumenPorEval || [];
      // Una página por evaluación con el desglose de notas
      resumen.forEach((ev, idx) => {
        // Cada evaluación en su propia página
        apartado(`${t('summary_prefix')} ${ev.evaluacion}`, [46, 125, 50]);
        const n2 = (v: any) => (v != null && !isNaN(Number(v))) ? Number(v).toFixed(2) : '—';
        const RESULT_PASS = t('result_pass');
        const RESULT_FAIL = t('result_fail');
        autoTable(doc, {
          startY: y,
          head: [[t('col_num'), t('col_student'), t('col_tasks'), t('col_exams'), t('col_attitude'), t('col_attendance_short'), t('col_final'), t('col_result')]],
          body: ev.filas.length
            ? ev.filas.map((f, i) => [String(i + 1), f.alumno, n2(f.tareas), n2(f.examenes), n2(f.actitud), n2(f.asistencia), n2(f.final), calificacionCualitativa(f.final)])
            : [['—', t('no_grades'), '', '', '', '', '', '']],
          theme: 'grid',
          headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 9, halign: 'center' },
            2: { halign: 'center', cellWidth: 18 }, 3: { halign: 'center', cellWidth: 18 },
            4: { halign: 'center', cellWidth: 18 }, 5: { halign: 'center', cellWidth: 18 },
            6: { halign: 'center', cellWidth: 16, fontStyle: 'bold' }, 7: { halign: 'center', cellWidth: 30 }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 7 && typeof data.cell.raw === 'string' && data.cell.raw !== '') {
              data.cell.styles.textColor = colorCalificacion(data.cell.raw);
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body' && data.column.index === 6) {
              const n = parseFloat(String(data.cell.raw).replace(',', '.'));
              if (!isNaN(n)) data.cell.styles.textColor = n >= 5 ? [46, 125, 50] : [198, 40, 40];
            }
          },
          margin: { left: MX, right: MX }
        });
        afterTable();
        // Leyenda de pesos
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(120);
        doc.text(t('summary_legend'), MX, y);
        doc.setTextColor(0);
      });
      if (!resumen.length) {
        apartado(t('sec_summary'), [46, 125, 50]);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(120);
        doc.text(t('no_summary'), MX, y); doc.setTextColor(0);
      }
    }

    // ============ Pie con numeración ============
    const total = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      if (p === 1) continue; // la portada (primera página) no lleva pie
      doc.setPage(p);
      doc.setDrawColor(...PURPLE);
      doc.setLineWidth(0.4);
      doc.line(MX, H - 12, W - MX, H - 12);
      doc.setFontSize(7.5);
      doc.setTextColor(130);
      const pieIzq = `${d.modulo} (${d.grupo})`;
      doc.text(pieIzq, MX, H - 7);
      doc.text(t('page', { p, total }), W - MX, H - 7, { align: 'right' });
      doc.setTextColor(0);
    }

    const nombre = `Cuaderno_${d.modulo}_${d.grupo}_${d.evaluacion}`.replace(/[,\s]+/g, '_');
    doc.save(`${nombre}.pdf`);
    return doc.output('blob');
  }

  // Generar CSV genérico
  exportarCSV(datos: any[], nombreArchivo: string): void {
    const ws = XLSX.utils.json_to_sheet(datos);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${nombreArchivo}.csv`;
    link.click();
  }
}