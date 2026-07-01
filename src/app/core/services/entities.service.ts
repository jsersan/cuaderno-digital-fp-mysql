import { Injectable } from '@angular/core';
import { where, orderBy, QueryConstraint } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { ModuloProfesional, Grupo, CicloFormativo, Centro, Observacion, PeriodoEvaluacion, EventoProgramacion } from '@core/models';

// =============== MÓDULOS ===============

@Injectable({ providedIn: 'root' })
export class ModulosService extends FirestoreService<ModuloProfesional> {
  protected collectionName = 'modulos';

  getByCiclo$(cicloId: string): Observable<ModuloProfesional[]> {
    return this.queryByField$('cicloId', cicloId).pipe(
      map(mods => mods
        .filter(m => m.activo !== false)
        .sort((a, b) => a.curso - b.curso || a.nombre.localeCompare(b.nombre))
      )
    );
  }

  getByProfesor$(profesorId: string): Observable<ModuloProfesional[]> {
    return this.queryByField$('profesorId', profesorId);
  }

  async getModulosDeGrupo(grupoId: string, modulosIds: string[]): Promise<ModuloProfesional[]> {
    const modulos: ModuloProfesional[] = [];
    for (const id of modulosIds) {
      const modulo = await this.getById(id);
      if (modulo && modulo.activo) modulos.push(modulo);
    }
    return modulos;
  }
}

// =============== GRUPOS ===============

@Injectable({ providedIn: 'root' })
export class GruposService extends FirestoreService<Grupo> {
  protected collectionName = 'grupos';

  getByCentro$(centroId: string, cursoAcademico: string): Observable<Grupo[]> {
    // Query simple (un solo where) para evitar necesidad de composite index
    return this.queryByField$('centroId', centroId).pipe(
      map(grupos => grupos
        .filter(g => g.cursoAcademico === cursoAcademico && g.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
    );
  }

  getByProfesor$(profesorId: string): Observable<Grupo[]> {
    return this.queryByField$('tutorId', profesorId);
  }

  getByCiclo$(cicloId: string): Observable<Grupo[]> {
    return this.queryByField$('cicloId', cicloId);
  }

  async addAlumno(grupoId: string, alumnoId: string): Promise<void> {
    const grupo = await this.getById(grupoId);
    if (!grupo) throw new Error('Grupo no encontrado');
    if (!grupo.alumnosIds.includes(alumnoId)) {
      await this.update(grupoId, {
        alumnosIds: [...grupo.alumnosIds, alumnoId]
      } as Partial<Grupo>);
    }
  }

  async removeAlumno(grupoId: string, alumnoId: string): Promise<void> {
    const grupo = await this.getById(grupoId);
    if (!grupo) throw new Error('Grupo no encontrado');
    await this.update(grupoId, {
      alumnosIds: grupo.alumnosIds.filter(id => id !== alumnoId)
    } as Partial<Grupo>);
  }
}

// =============== CICLOS FORMATIVOS ===============

@Injectable({ providedIn: 'root' })
export class CiclosService extends FirestoreService<CicloFormativo> {
  protected collectionName = 'ciclos';

  getByCentro$(centroId: string): Observable<CicloFormativo[]> {
    return this.queryByField$('centroId', centroId).pipe(
      map(ciclos => ciclos.filter(c => c.activo !== false))
    );
  }

  getByFamilia$(familia: string): Observable<CicloFormativo[]> {
    return this.queryByField$('familia', familia);
  }
}

// =============== CENTROS ===============

@Injectable({ providedIn: 'root' })
export class CentrosService extends FirestoreService<Centro> {
  protected collectionName = 'centros';

  getActivos$(): Observable<Centro[]> {
    return this.queryByField$('activo', true);
  }
}

// =============== OBSERVACIONES ===============

@Injectable({ providedIn: 'root' })
export class ObservacionesService extends FirestoreService<Observacion> {
  protected collectionName = 'observaciones';

  getByAlumno$(alumnoId: string): Observable<Observacion[]> {
    return this.queryByField$('alumnoId', alumnoId).pipe(
      map(obs => obs.sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  getByGrupo$(grupoId: string): Observable<Observacion[]> {
    return this.queryByField$('grupoId', grupoId).pipe(
      map(obs => obs
        .filter((o: any) => o.privada !== true)
        .sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
      )
    );
  }
}

// =============== PERIODOS EVALUACIÓN ===============

@Injectable({ providedIn: 'root' })
export class PeriodosEvaluacionService extends FirestoreService<PeriodoEvaluacion> {
  protected collectionName = 'periodos_evaluacion';

  getByCentro$(centroId: string, cursoAcademico: string): Observable<PeriodoEvaluacion[]> {
    return this.queryByField$('centroId', centroId).pipe(
      map(p => p
        .filter((x: any) => x.cursoAcademico === cursoAcademico)
        .sort((a: any, b: any) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0))
      )
    );
  }

  async getActivo(centroId: string): Promise<PeriodoEvaluacion | null> {
    const periodos = await this.queryByField('centroId', centroId);
    const activo = periodos.find((p: any) => p.activo && !p.cerrado);
    return activo || null;
  }
}

@Injectable({ providedIn: 'root' })
export class EventosProgramacionService extends FirestoreService<EventoProgramacion> {
  protected collectionName = 'eventos_programacion';

  async getByModuloGrupo(moduloId: string, grupoId: string): Promise<EventoProgramacion[]> {
    const todos = await this.queryByField('moduloId', moduloId);
    return todos
      .filter((e: any) => e.grupoId === grupoId)
      .sort((a: any, b: any) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0));
  }
}
