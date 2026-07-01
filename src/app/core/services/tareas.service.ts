import { Injectable } from '@angular/core';
import { where, orderBy, QueryConstraint, Timestamp } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { Tarea, EntregaTarea, EstadoTarea, TipoEvaluacion } from '@core/models';

@Injectable({ providedIn: 'root' })
export class TareasService extends FirestoreService<Tarea> {
  protected collectionName = 'tareas';

  getByModuloYGrupo(moduloId: string, grupoId: string): Observable<Tarea[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(tareas => tareas
        .filter(t => t.grupoId === grupoId)
        .sort((a: any, b: any) => (b.fechaEntrega?.seconds || 0) - (a.fechaEntrega?.seconds || 0))
      )
    );
  }

  getByProfesor$(profesorId: string): Observable<Tarea[]> {
    return this.queryByField$('profesorId', profesorId).pipe(
      map(tareas => tareas
        .filter(t => !t.archivada)
        .sort((a: any, b: any) => (b.fechaEntrega?.seconds || 0) - (a.fechaEntrega?.seconds || 0))
      )
    );
  }

  // Obtener tareas pendientes de corregir
  async getTareasParaCorregir(profesorId: string): Promise<Tarea[]> {
    const tareas = await this.queryByField('profesorId', profesorId);
    return tareas.filter(t =>
      !t.archivada &&
      t.entregas.some(e => e.estado === EstadoTarea.ENTREGADA)
    );
  }

  getByEvaluacion(moduloId: string, grupoId: string, evaluacion: TipoEvaluacion): Observable<Tarea[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(tareas => tareas.filter(t => t.grupoId === grupoId && t.evaluacion === evaluacion))
    );
  }

  // Registrar entrega de un alumno
  async registrarEntrega(tareaId: string, entrega: EntregaTarea): Promise<void> {
    const tarea = await this.getById(tareaId);
    if (!tarea) throw new Error('Tarea no encontrada');

    const entregas = [...(tarea.entregas || [])];
    const idx = entregas.findIndex(e => e.alumnoId === entrega.alumnoId);

    if (idx >= 0) {
      entregas[idx] = { ...entregas[idx], ...entrega };
    } else {
      entregas.push(entrega);
    }

    await this.update(tareaId, { entregas } as Partial<Tarea>);
  }

  // Calificar entrega
  async calificarEntrega(
    tareaId: string,
    alumnoId: string,
    nota: number,
    feedback: string,
    profesorId: string
  ): Promise<void> {
    const tarea = await this.getById(tareaId);
    if (!tarea) throw new Error('Tarea no encontrada');

    const entregas = (tarea.entregas || []).map(e => {
      if (e.alumnoId === alumnoId) {
        return {
          ...e,
          nota,
          feedback,
          estado: EstadoTarea.CORREGIDA,
          corregidoPor: profesorId,
          fechaCorreccion: Timestamp.now()
        };
      }
      return e;
    });

    await this.update(tareaId, { entregas } as Partial<Tarea>);
  }

  // Marcar alumnos sin entrega como "no entregada"
  async cerrarPlazo(tareaId: string, alumnosIds: string[]): Promise<void> {
    const tarea = await this.getById(tareaId);
    if (!tarea) throw new Error('Tarea no encontrada');

    const entregados = new Set((tarea.entregas || []).map(e => e.alumnoId));
    const nuevasEntregas = [...(tarea.entregas || [])];

    for (const alumnoId of alumnosIds) {
      if (!entregados.has(alumnoId)) {
        nuevasEntregas.push({
          alumnoId,
          alumnoNombre: '',
          estado: EstadoTarea.NO_ENTREGADA,
          nota: 0,
          archivos: []
        });
      }
    }

    await this.update(tareaId, { entregas: nuevasEntregas } as Partial<Tarea>);
  }

  // Estadísticas de una tarea
  getEstadisticas(tarea: Tarea): {
    totalEntregas: number;
    pendientes: number;
    corregidas: number;
    noEntregadas: number;
    notaMedia: number;
    notaMaxima: number;
    notaMinima: number;
  } {
    const entregas = tarea.entregas || [];
    const corregidas = entregas.filter(e => e.estado === EstadoTarea.CORREGIDA);
    const notas = corregidas.filter(e => e.nota !== undefined).map(e => e.nota!);

    return {
      totalEntregas: entregas.filter(e => e.estado === EstadoTarea.ENTREGADA || e.estado === EstadoTarea.CORREGIDA).length,
      pendientes: entregas.filter(e => e.estado === EstadoTarea.ENTREGADA).length,
      corregidas: corregidas.length,
      noEntregadas: entregas.filter(e => e.estado === EstadoTarea.NO_ENTREGADA).length,
      notaMedia: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0,
      notaMaxima: notas.length ? Math.max(...notas) : 0,
      notaMinima: notas.length ? Math.min(...notas) : 0
    };
  }
}
