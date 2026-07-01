import { Injectable } from '@angular/core';
import { where, orderBy, QueryConstraint } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { FirestoreService } from './firestore.service';
import { Alumno, EstadoAlumno } from '@core/models';

@Injectable({ providedIn: 'root' })
export class AlumnosService extends FirestoreService<Alumno> {
  protected collectionName = 'alumnos';

  // Obtener alumnos por grupo
  getByGrupo(grupoId: string): Promise<Alumno[]> {
    return this.queryByField('grupoId', grupoId);
  }

  getByGrupo$(grupoId: string): Observable<Alumno[]> {
    const constraints: QueryConstraint[] = [
      where('grupoId', '==', grupoId),
      where('estado', '==', EstadoAlumno.ACTIVO),
      orderBy('apellidos', 'asc')
    ];
    return this.queryWithConstraints$(constraints);
  }

  // Obtener alumnos por ciclo
  getByCiclo(cicloId: string): Promise<Alumno[]> {
    return this.queryByField('cicloId', cicloId);
  }

  // Obtener alumnos activos de un centro
  getActivosByCentro$(centroId: string): Observable<Alumno[]> {
    const constraints: QueryConstraint[] = [
      where('centroId', '==', centroId),
      where('estado', '==', EstadoAlumno.ACTIVO),
      orderBy('apellidos', 'asc')
    ];
    return this.queryWithConstraints$(constraints);
  }

  // Buscar alumnos por nombre o apellidos
  async buscar(termino: string, centroId: string): Promise<Alumno[]> {
    const todos = await this.queryByField('centroId', centroId);
    const terminoLower = termino.toLowerCase();
    return todos.filter(a =>
      a.nombre.toLowerCase().includes(terminoLower) ||
      a.apellidos.toLowerCase().includes(terminoLower) ||
      a.email.toLowerCase().includes(terminoLower)
    );
  }

  // Dar de baja a un alumno
  async darDeBaja(id: string, motivo: string): Promise<void> {
    await this.update(id, {
      estado: EstadoAlumno.BAJA,
      observaciones: motivo
    } as Partial<Alumno>);
  }

  // Actualizar matrícula de módulo
  async actualizarMatricula(
    alumnoId: string,
    moduloId: string,
    datos: { estado?: string; notaFinal?: number }
  ): Promise<void> {
    const alumno = await this.getById(alumnoId);
    if (!alumno) throw new Error('Alumno no encontrado');

    const matriculas = alumno.matriculas.map(m => {
      if (m.moduloId === moduloId) {
        return { ...m, ...datos };
      }
      return m;
    });

    await this.update(alumnoId, { matriculas } as Partial<Alumno>);
  }

  // Obtener estadísticas de un alumno
  async getEstadisticas(alumnoId: string): Promise<{
    modulosAprobados: number;
    modulosSuspensos: number;
    modulosPendientes: number;
    mediaGeneral: number;
  }> {
    const alumno = await this.getById(alumnoId);
    if (!alumno) throw new Error('Alumno no encontrado');

    const matriculas = alumno.matriculas || [];
    const aprobados = matriculas.filter(m => m.estado === 'aprobado');
    const suspensos = matriculas.filter(m => m.estado === 'suspenso');
    const pendientes = matriculas.filter(m => m.estado === 'matriculado');

    const conNota = matriculas.filter(m => m.notaFinal !== undefined && m.notaFinal !== null);
    const media = conNota.length > 0
      ? conNota.reduce((sum, m) => sum + (m.notaFinal || 0), 0) / conNota.length
      : 0;

    return {
      modulosAprobados: aprobados.length,
      modulosSuspensos: suspensos.length,
      modulosPendientes: pendientes.length,
      mediaGeneral: Math.round(media * 100) / 100
    };
  }
}
