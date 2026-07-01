import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GruposService, AlumnosService, ModulosService, AuthService } from '@core/services';
import { Grupo, Alumno, ModuloProfesional, Matricula } from '@core/models';

@Component({
  selector: 'app-grupo-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatTabsModule, MatTableModule, MatListModule,
    MatChipsModule, MatCheckboxModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatSnackBarModule
  ],
  template: `
    @if (grupo) {
      <div class="page-header">
        <div>
          <h2>{{ grupo.nombre }}</h2>
          <p class="subtitle">{{ grupo.cicloNombre || '' }} · {{ grupo.curso }}º
            @if (grupo.turno) { · Turno {{ grupo.turno }} }
          </p>
        </div>
        <button mat-button routerLink="/grupos"><mat-icon>arrow_back</mat-icon> Volver</button>
      </div>

      <div class="stats-cards">
        <mat-card class="stat-card"><strong>{{ alumnosGrupo.length }}</strong><span>Alumnos</span></mat-card>
        <mat-card class="stat-card"><strong>{{ modulos.length }}</strong><span>Módulos</span></mat-card>
        <mat-card class="stat-card"><strong>{{ grupo.aula || '—' }}</strong><span>Aula</span></mat-card>
      </div>

      <!-- Botón añadir alumnos -->
      <div class="actions-bar">
        <button mat-raised-button color="primary" (click)="showAddAlumnos = !showAddAlumnos; showAddAlumnos && loadAlumnosSinGrupo()">
          <mat-icon>{{ showAddAlumnos ? 'close' : 'person_add' }}</mat-icon>
          {{ showAddAlumnos ? 'Cancelar' : 'Añadir alumnos al grupo' }}
        </button>
        @if (alumnosGrupo.length > 0 && modulos.length > 0) {
          <button mat-raised-button (click)="matricularTodosEnTodo()">
            <mat-icon>select_all</mat-icon> Matricular todos en todos los módulos
          </button>
        }
      </div>

      <!-- Panel añadir alumnos -->
      @if (showAddAlumnos) {
        <mat-card class="add-panel">
          <h4><mat-icon>person_add</mat-icon> Selecciona alumnos para añadir a {{ grupo.nombre }}</h4>
          @if (alumnosSinGrupo.length === 0) {
            <p class="hint">No hay alumnos sin grupo. Importa alumnos desde la sección Alumnos → Importar Excel.</p>
          }
          <div class="select-list">
            @for (a of alumnosSinGrupo; track a.id) {
              <div class="select-item">
                <mat-checkbox [(ngModel)]="selectedAlumnos[a.id!]">
                  {{ a.apellidos }}, {{ a.nombre }} — {{ a.email }}
                </mat-checkbox>
              </div>
            }
          </div>
          @if (alumnosSinGrupo.length > 0) {
            <div class="panel-actions">
              <button mat-raised-button color="primary" (click)="asignarAlumnos()" [disabled]="saving">
                <mat-icon>check</mat-icon> Asignar seleccionados
              </button>
            </div>
          }
        </mat-card>
      }

      <!-- TABLA PRINCIPAL: Alumnos + Matrículas en módulos -->
      @if (alumnosGrupo.length > 0) {
        <mat-card class="main-table-card">
          <div class="table-scroll">
            <table class="alumnos-table">
              <thead>
                <tr>
                  <th class="col-num">#</th>
                  <th class="col-name">Alumno/a</th>
                  <th class="col-email">Email</th>
                  @for (mod of modulos; track mod.id) {
                    <th class="col-mod" [matTooltip]="mod.nombre">
                      <div class="mod-header">
                        <mat-icon>book</mat-icon>
                        {{ mod.abreviatura }}
                      </div>
                    </th>
                  }
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody>
                @for (alumno of alumnosGrupo; track alumno.id; let i = $index) {
                  <tr>
                    <td class="col-num">{{ i + 1 }}</td>
                    <td class="col-name">
                      <a [routerLink]="['/alumnos', alumno.id]" class="link">
                        {{ alumno.apellidos }}, {{ alumno.nombre }}
                      </a>
                    </td>
                    <td class="col-email">{{ alumno.email }}</td>
                    @for (mod of modulos; track mod.id) {
                      <td class="col-mod">
                        <mat-checkbox
                          [checked]="isMatriculado(alumno, mod.id!)"
                          (change)="toggleMatricula(alumno, mod, $event.checked)"
                          color="primary">
                        </mat-checkbox>
                      </td>
                    }
                    <td class="col-action">
                      <button mat-icon-button (click)="quitarAlumno(alumno)"
                              matTooltip="Quitar del grupo" color="warn">
                        <mat-icon>person_remove</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (modulos.length > 0) {
            <div class="legend">
              <mat-icon>info</mat-icon>
              Marca las casillas para matricular a cada alumno en los módulos correspondientes
            </div>
          }
        </mat-card>
      }

      @if (alumnosGrupo.length === 0 && !showAddAlumnos) {
        <mat-card class="empty-card">
          <mat-icon>groups</mat-icon>
          <p>Este grupo no tiene alumnos</p>
          <button mat-raised-button color="primary" (click)="showAddAlumnos = true; loadAlumnosSinGrupo()">
            <mat-icon>person_add</mat-icon> Añadir alumnos
          </button>
        </mat-card>
      }
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .stats-cards { display: flex; gap: 16px; margin-bottom: 16px; }
    .stat-card { flex: 1; text-align: center; padding: 16px; border-radius: 12px; }
    .stat-card strong { display: block; font-size: 28px; }
    .stat-card span { font-size: 12px; color: #666; }

    .actions-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }

    /* Panel añadir alumnos */
    .add-panel { padding: 20px; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid #1565c0; }
    .add-panel h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; color: #1565c0; }
    .select-list { max-height: 300px; overflow-y: auto; margin-bottom: 8px; }
    .select-item { padding: 4px 0; }
    .panel-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid #e0e0e0; }
    .hint { color: #999; font-size: 13px; font-style: italic; }

    /* Tabla principal */
    .main-table-card { border-radius: 12px; overflow: hidden; }
    .table-scroll { overflow-x: auto; }
    .alumnos-table { width: 100%; border-collapse: collapse; }
    .alumnos-table th { background: #f5f5f5; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #666; padding: 12px 8px; text-align: left; border-bottom: 2px solid #e0e0e0; }
    .alumnos-table td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; }
    .alumnos-table tbody tr:hover { background: #fafafa; }

    .col-num { width: 40px; text-align: center !important; color: #999; }
    .col-name { min-width: 200px; }
    .col-email { min-width: 200px; color: #666; font-size: 13px; }
    .col-mod { width: 90px; text-align: center !important; }
    .col-action { width: 48px; }

    .mod-header { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .mod-header mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1565c0; }

    .link { color: #1565c0; text-decoration: none; font-weight: 500; }
    .link:hover { text-decoration: underline; }

    .legend { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 12px; color: #999; border-top: 1px solid #f0f0f0; }
    .legend mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }

    @media (max-width: 768px) { .stats-cards { flex-direction: column; } }
  `]
})
export class GrupoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private gruposService = inject(GruposService);
  private alumnosService = inject(AlumnosService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  grupo: Grupo | null = null;
  alumnosGrupo: Alumno[] = [];
  alumnosSinGrupo: Alumno[] = [];
  modulos: ModuloProfesional[] = [];
  showAddAlumnos = false;
  saving = false;
  selectedAlumnos: { [id: string]: boolean } = {};

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.grupo = await this.gruposService.getById(id);
    if (this.grupo) {
      await this.loadAlumnosGrupo();
      // Cargar módulos del ciclo
      try {
        this.modulos = await this.modulosService.queryByField('cicloId', this.grupo.cicloId);
      } catch { this.modulos = []; }
    }
  }

  async loadAlumnosGrupo() {
    if (!this.grupo?.id) return;
    this.alumnosGrupo = await this.alumnosService.getByGrupo(this.grupo.id);
    this.alumnosGrupo.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
  }

  async loadAlumnosSinGrupo() {
    const user = this.auth.currentUser;
    if (!user) return;
    const todos = await this.alumnosService.queryByField('centroId', user.centroId);
    const idsEnGrupo = new Set(this.alumnosGrupo.map(a => a.id));
    this.alumnosSinGrupo = todos.filter(a => !a.grupoId || a.grupoId === '').filter(a => !idsEnGrupo.has(a.id));
    this.alumnosSinGrupo.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    this.selectedAlumnos = {};
  }

  async asignarAlumnos() {
    if (!this.grupo?.id) return;
    this.saving = true;
    let count = 0;
    for (const [alumnoId, selected] of Object.entries(this.selectedAlumnos)) {
      if (selected) {
        await this.alumnosService.update(alumnoId, { grupoId: this.grupo.id, cicloId: this.grupo.cicloId } as any);
        count++;
      }
    }
    this.saving = false;
    this.showAddAlumnos = false;
    await this.loadAlumnosGrupo();
    this.snackBar.open(`✓ ${count} alumnos añadidos a ${this.grupo.nombre}`, 'OK', { duration: 3000 });
  }

  async quitarAlumno(alumno: Alumno) {
    if (!confirm(`¿Quitar a ${alumno.nombre} ${alumno.apellidos} del grupo?`)) return;
    await this.alumnosService.update(alumno.id!, { grupoId: '', matriculas: [] } as any);
    await this.loadAlumnosGrupo();
    this.snackBar.open('Alumno quitado del grupo', 'OK', { duration: 3000 });
  }

  // ===== MATRÍCULAS =====

  isMatriculado(alumno: Alumno, moduloId: string): boolean {
    return (alumno.matriculas || []).some(m => m.moduloId === moduloId);
  }

  async toggleMatricula(alumno: Alumno, mod: ModuloProfesional, checked: boolean) {
    let matriculas = [...(alumno.matriculas || [])];
    if (checked) {
      if (!matriculas.find(m => m.moduloId === mod.id)) {
        matriculas.push({ moduloId: mod.id!, moduloNombre: mod.nombre, convocatoria: 1, estado: 'matriculado' as any });
      }
    } else {
      matriculas = matriculas.filter(m => m.moduloId !== mod.id);
    }
    await this.alumnosService.update(alumno.id!, { matriculas } as any);
    const idx = this.alumnosGrupo.findIndex(a => a.id === alumno.id);
    if (idx >= 0) this.alumnosGrupo[idx].matriculas = matriculas;
  }

  async matricularTodosEnTodo() {
    if (!confirm(`¿Matricular a los ${this.alumnosGrupo.length} alumnos en los ${this.modulos.length} módulos?`)) return;
    for (const alumno of this.alumnosGrupo) {
      const matriculas: Matricula[] = this.modulos.map(mod => ({
        moduloId: mod.id!, moduloNombre: mod.nombre, convocatoria: 1, estado: 'matriculado' as any
      }));
      await this.alumnosService.update(alumno.id!, { matriculas } as any);
      alumno.matriculas = matriculas;
    }
    this.snackBar.open(`✓ ${this.alumnosGrupo.length} alumnos matriculados en ${this.modulos.length} módulos`, 'OK', { duration: 3000 });
  }
}
