import { Injectable, signal, inject } from '@angular/core';
import { ModuloProfesional, Grupo } from '@core/models';
import { ModulosService, GruposService } from './entities.service';

@Injectable({ providedIn: 'root' })
export class ActiveModuleService {
  private modulosService = inject(ModulosService);
  private gruposService = inject(GruposService);

  private _module = signal<ModuloProfesional | null>(null);
  private _grupo = signal<Grupo | null>(null);
  private _cursoAcademico = signal<string>(this.calcularCursoActual());

  module = this._module.asReadonly();
  grupo = this._grupo.asReadonly();
  cursoAcademico = this._cursoAcademico.asReadonly();

  get current(): ModuloProfesional | null { return this._module(); }
  get currentGrupo(): Grupo | null { return this._grupo(); }
  get moduloId(): string { return this._module()?.id || ''; }
  get grupoId(): string { return this._grupo()?.id || ''; }
  get grupoNombre(): string { return this._grupo()?.nombre || ''; }
  get moduloNombre(): string { const m = this._module(); return m ? `${m.abreviatura} - ${m.nombre}` : ''; }

  /** Curso académico activo (ej: '2025-2026'). Usado por todos los componentes en lugar de hardcodear. */
  get cursoActual(): string { return this._cursoAcademico(); }

  /**
   * Calcula el curso académico por defecto a partir de la fecha del sistema.
   * Sept–Dic → año/año+1  |  Ene–Ago → año-1/año
   */
  private calcularCursoActual(): string {
    const saved = localStorage.getItem('activeCursoAcademico');
    if (saved) return saved;
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${year + 1}`;
  }

  setModule(mod: ModuloProfesional, grupo?: Grupo, cursoAcademico?: string) {
    this._module.set(mod);
    if (grupo) this._grupo.set(grupo);
    // El curso se toma del parámetro, o del grupo, o se mantiene el actual
    const curso = cursoAcademico || grupo?.cursoAcademico || this._cursoAcademico();
    this._cursoAcademico.set(curso);
    localStorage.setItem('activeModuleId', mod.id || '');
    localStorage.setItem('activeModuleName', `${mod.abreviatura} - ${mod.nombre}`);
    if (grupo) localStorage.setItem('activeGrupoId', grupo.id || '');
    localStorage.setItem('activeCursoAcademico', curso);
  }

  setGrupo(grupo: Grupo) {
    this._grupo.set(grupo);
    localStorage.setItem('activeGrupoId', grupo.id || '');
  }

  /** Cambia el curso académico activo sin tocar módulo/grupo. */
  setCursoAcademico(curso: string) {
    this._cursoAcademico.set(curso);
    localStorage.setItem('activeCursoAcademico', curso);
  }

  /** Rehidrata módulo, grupo Y curso activos desde localStorage tras recargar. */
  async restore(): Promise<boolean> {
    // Restaurar curso siempre
    const savedCurso = localStorage.getItem('activeCursoAcademico');
    if (savedCurso) this._cursoAcademico.set(savedCurso);

    if (this._module()) return true;
    const modId = localStorage.getItem('activeModuleId');
    const grpId = localStorage.getItem('activeGrupoId');
    if (!modId) return false;
    try {
      const mod = await this.modulosService.getById(modId);
      if (!mod) return false;
      this._module.set(mod);
      if (grpId) {
        const grp = await this.gruposService.getById(grpId);
        if (grp) this._grupo.set(grp);
      }
      return true;
    } catch { return false; }
  }

  getSavedModuleId(): string { return localStorage.getItem('activeModuleId') || ''; }
  getSavedGrupoId(): string { return localStorage.getItem('activeGrupoId') || ''; }
  getSavedModuleName(): string { return localStorage.getItem('activeModuleName') || ''; }
  getSavedCursoAcademico(): string { return localStorage.getItem('activeCursoAcademico') || this.cursoActual; }

  clear() {
    this._module.set(null);
    this._grupo.set(null);
    // El curso seleccionado se mantiene para comodidad del usuario
    localStorage.removeItem('activeModuleId');
    localStorage.removeItem('activeGrupoId');
    localStorage.removeItem('activeModuleName');
  }
}