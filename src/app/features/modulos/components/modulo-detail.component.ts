import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModulosService, AlumnosService, GruposService, AuthService } from '@core/services';
import { ModuloProfesional, Alumno, Grupo, Matricula } from '@core/models';

@Component({
  selector: 'app-modulo-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatExpansionModule, MatListModule, MatChipsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatProgressBarModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    @if (modulo) {
      <div class="page-header">
        <div>
          <h2><span class="abrev">{{ modulo.abreviatura }}</span> {{ modulo.nombre }}</h2>
          <p class="subtitle">
            <mat-chip>{{ modulo.curso }}º curso</mat-chip>
            {{ modulo.horasSemanales }}h/semana · {{ modulo.horasTotales }}h totales
          </p>
        </div>
        <button mat-button routerLink="/modulos"><mat-icon>arrow_back</mat-icon> Volver</button>
      </div>

      <!-- Criterios de calificación -->
      @if (modulo.criteriosCalificacion) {
        <mat-card class="criteria-card">
          <h3>Criterios de Calificación</h3>
          <div class="criteria-grid">
            <div class="criteria-item"><div class="criteria-bar" [style.width.%]="modulo.criteriosCalificacion.porcentajeExamenes">{{ modulo.criteriosCalificacion.porcentajeExamenes }}%</div><span>Exámenes</span></div>
            <div class="criteria-item"><div class="criteria-bar tareas" [style.width.%]="modulo.criteriosCalificacion.porcentajeTareas">{{ modulo.criteriosCalificacion.porcentajeTareas }}%</div><span>Tareas</span></div>
            <div class="criteria-item"><div class="criteria-bar actitud" [style.width.%]="modulo.criteriosCalificacion.porcentajeActitud">{{ modulo.criteriosCalificacion.porcentajeActitud }}%</div><span>Actitud</span></div>
            <div class="criteria-item"><div class="criteria-bar asistencia" [style.width.%]="modulo.criteriosCalificacion.porcentajeAsistencia">{{ modulo.criteriosCalificacion.porcentajeAsistencia }}%</div><span>Asistencia</span></div>
          </div>
          <p class="criteria-note">
            Nota mín. aprobado: <strong>{{ modulo.criteriosCalificacion.notaMinimaAprobado }}</strong> ·
            Mín. asistencia: <strong>{{ modulo.criteriosCalificacion.porcentajeMinimoAsistencia }}%</strong>
          </p>
        </mat-card>
      }

      <!-- ALUMNOS MATRICULADOS -->
      <mat-card class="students-card">
        <div class="card-header">
          <h3><mat-icon>people</mat-icon> Alumnos matriculados ({{ alumnosMatriculados.length }})</h3>
          <button mat-raised-button color="primary" (click)="showMatricular = !showMatricular">
            <mat-icon>{{ showMatricular ? 'close' : 'person_add' }}</mat-icon>
            {{ showMatricular ? 'Cancelar' : 'Matricular alumnos' }}
          </button>
        </div>

        <!-- Panel para matricular nuevos alumnos -->
        @if (showMatricular) {
          <div class="matricular-panel">
            <p class="panel-desc">Selecciona los alumnos que quieres matricular en <strong>{{ modulo.abreviatura }}</strong>:</p>

            @if (grupos.length > 0) {
              @for (grupo of grupos; track grupo.id) {
                <div class="grupo-section">
                  <div class="grupo-header">
                    <strong>{{ grupo.nombre }}</strong>
                    <button mat-button color="primary" (click)="matricularGrupoCompleto(grupo)">
                      Matricular todo {{ grupo.nombre }}
                    </button>
                  </div>
                  @for (alumno of getAlumnosNoMatriculadosDeGrupo(grupo.id!); track alumno.id) {
                    <div class="select-item">
                      <mat-checkbox [(ngModel)]="selectedAlumnos[alumno.id!]">
                        {{ alumno.apellidos }}, {{ alumno.nombre }}
                      </mat-checkbox>
                    </div>
                  }
                  @if (getAlumnosNoMatriculadosDeGrupo(grupo.id!).length === 0) {
                    <p class="hint">Todos los alumnos de este grupo ya están matriculados</p>
                  }
                </div>
              }
            }

            <div class="panel-actions">
              <button mat-raised-button color="primary" (click)="matricularSeleccionados()" [disabled]="saving">
                <mat-icon>check</mat-icon> Matricular seleccionados
              </button>
            </div>
          </div>
        }

        <!-- Lista de alumnos matriculados -->
        @if (alumnosMatriculados.length > 0) {
          <table class="alumnos-table">
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th>Alumno/a</th>
                <th>Grupo</th>
                <th>Email</th>
                <th>Conv.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (alumno of alumnosMatriculados; track alumno.id; let i = $index) {
                <tr>
                  <td class="col-num">{{ i + 1 }}</td>
                  <td><a [routerLink]="['/alumnos', alumno.id]" class="link">{{ alumno.apellidos }}, {{ alumno.nombre }}</a></td>
                  <td><mat-chip>{{ getGrupoNombre(alumno.grupoId) }}</mat-chip></td>
                  <td class="email-col">{{ alumno.email }}</td>
                  <td>{{ getConvocatoria(alumno) }}ª</td>
                  <td>
                    <button mat-icon-button color="warn" (click)="desmatricular(alumno)"
                            matTooltip="Desmatricular de {{ modulo.abreviatura }}">
                      <mat-icon>person_remove</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (!showMatricular) {
          <div class="empty-state">
            <mat-icon>school</mat-icon>
            <p>No hay alumnos matriculados en este módulo</p>
            <button mat-raised-button color="primary" (click)="showMatricular = true">
              <mat-icon>person_add</mat-icon> Matricular alumnos
            </button>
          </div>
        }
      </mat-card>

      <!-- Resultados de Aprendizaje -->
      <div class="section-header">
        <h3 class="section-title"><mat-icon>school</mat-icon> Resultados de Aprendizaje ({{ modulo.resultadosAprendizaje.length }})</h3>
        <button mat-raised-button (click)="raFileInput.click()" class="import-btn">
          <mat-icon>upload_file</mat-icon> Importar RA desde Excel
        </button>
        <input #raFileInput type="file" hidden accept=".xlsx,.xls" (change)="onImportRA($event)">
      </div>
      @if (modulo.resultadosAprendizaje.length > 0) {
        <mat-accordion multi>
          @for (ra of modulo.resultadosAprendizaje; track ra.codigo) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title><span class="ra-code">{{ ra.codigo }}</span> {{ ra.descripcion | slice:0:80 }}...</mat-panel-title>
                <mat-panel-description><mat-chip>{{ ra.porcentajePeso }}%</mat-chip> {{ ra.criteriosEvaluacion.length }} CE</mat-panel-description>
              </mat-expansion-panel-header>
              <p>{{ ra.descripcion }}</p>
              <mat-divider></mat-divider>
              <h4>Criterios de Evaluación</h4>
              <mat-list>
                @for (ce of ra.criteriosEvaluacion; track ce.codigo) {
                  <mat-list-item><span matListItemTitle><strong class="ce-code">{{ ce.codigo }}</strong> {{ ce.descripcion }}</span><span matListItemMeta>{{ ce.porcentajePeso }}%</span></mat-list-item>
                }
              </mat-list>
            </mat-expansion-panel>
          }
        </mat-accordion>
      } @else {
        <mat-card class="empty-card"><mat-icon>school</mat-icon><p>No hay Resultados de Aprendizaje configurados</p></mat-card>
      }
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; }
    .abrev { color: #1565c0; }
    .subtitle { color: #666; margin: 4px 0 0; display: flex; align-items: center; gap: 8px; }
    .criteria-card { padding: 24px; border-radius: 12px; margin-bottom: 20px; }
    .criteria-card h3 { margin: 0 0 16px; }
    .criteria-grid { display: flex; flex-direction: column; gap: 10px; }
    .criteria-item { display: flex; align-items: center; gap: 12px; }
    .criteria-item span { min-width: 80px; font-size: 13px; color: #666; }
    .criteria-bar { height: 28px; background: #1565c0; border-radius: 6px; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; min-width: 40px; }
    .criteria-bar.tareas { background: #2e7d32; }
    .criteria-bar.actitud { background: #e65100; }
    .criteria-bar.asistencia { background: #6a1b9a; }
    .criteria-note { font-size: 13px; color: #666; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid #eee; }

    /* Alumnos matriculados */
    .students-card { padding: 20px; border-radius: 12px; margin-bottom: 24px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .card-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; }

    .matricular-panel { padding: 16px; background: #f5f5f5; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid #1565c0; }
    .panel-desc { margin: 0 0 12px; color: #555; }
    .grupo-section { margin-bottom: 12px; }
    .grupo-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #ddd; margin-bottom: 4px; }
    .select-item { padding: 2px 0 2px 8px; }
    .panel-actions { display: flex; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #ddd; }
    .hint { color: #999; font-size: 12px; font-style: italic; padding: 4px 8px; }

    .alumnos-table { width: 100%; border-collapse: collapse; }
    .alumnos-table th { text-align: left; padding: 10px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
    .alumnos-table td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; }
    .alumnos-table tbody tr:hover { background: #fafafa; }
    .col-num { width: 40px; text-align: center !important; color: #999; }
    .email-col { color: #666; font-size: 13px; }
    .link { color: #1565c0; text-decoration: none; font-weight: 500; }

    .empty-state { text-align: center; padding: 32px; color: #999; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }

    .section-header { display: flex; justify-content: space-between; align-items: center; margin: 24px 0 16px; flex-wrap: wrap; gap: 8px; }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 18px; margin: 0; }
    .import-btn { background: #fff3e0 !important; color: #e65100 !important; }
    .ra-code { background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 13px; margin-right: 8px; }
    .ce-code { color: #1565c0; margin-right: 4px; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class ModuloDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private modulosService = inject(ModulosService);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  modulo: ModuloProfesional | null = null;
  alumnosMatriculados: Alumno[] = [];
  alumnosTodos: Alumno[] = [];
  grupos: Grupo[] = [];
  showMatricular = false;
  saving = false;
  selectedAlumnos: { [id: string]: boolean } = {};

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.modulo = await this.modulosService.getById(id);
    if (this.modulo) {
      await this.loadData();
    }
  }

  async loadData() {
    const user = this.auth.currentUser;
    if (!user || !this.modulo) return;

    // Cargar todos los alumnos del centro
    this.alumnosTodos = await this.alumnosService.queryByField('centroId', user.centroId);
    this.alumnosTodos.sort((a, b) => a.apellidos.localeCompare(b.apellidos));

    // Filtrar matriculados en este módulo
    this.alumnosMatriculados = this.alumnosTodos.filter(a =>
      (a.matriculas || []).some(m => m.moduloId === this.modulo!.id)
    );

    // Cargar grupos
    try {
      const allGrupos = await this.gruposService.queryByField('centroId', user.centroId);
      this.grupos = allGrupos.filter(g => g.cicloId === this.modulo!.cicloId);
    } catch { this.grupos = []; }
  }

  getAlumnosNoMatriculadosDeGrupo(grupoId: string): Alumno[] {
    return this.alumnosTodos.filter(a =>
      a.grupoId === grupoId &&
      !(a.matriculas || []).some(m => m.moduloId === this.modulo!.id)
    );
  }

  getGrupoNombre(grupoId: string): string {
    return this.grupos.find(g => g.id === grupoId)?.nombre || '—';
  }

  getConvocatoria(alumno: Alumno): number {
    const mat = (alumno.matriculas || []).find(m => m.moduloId === this.modulo!.id);
    return mat?.convocatoria || 1;
  }

  async matricularSeleccionados() {
    if (!this.modulo) return;
    this.saving = true;
    let count = 0;
    for (const [alumnoId, selected] of Object.entries(this.selectedAlumnos)) {
      if (!selected) continue;
      const alumno = this.alumnosTodos.find(a => a.id === alumnoId);
      if (!alumno) continue;
      const matriculas = [...(alumno.matriculas || [])];
      if (!matriculas.find(m => m.moduloId === this.modulo!.id)) {
        matriculas.push({ moduloId: this.modulo.id!, moduloNombre: this.modulo.nombre, convocatoria: 1, estado: 'matriculado' as any });
        await this.alumnosService.update(alumnoId, { matriculas } as any);
        count++;
      }
    }
    this.saving = false;
    this.showMatricular = false;
    this.selectedAlumnos = {};
    await this.loadData();
    this.snackBar.open(`✓ ${count} alumnos matriculados en ${this.modulo.abreviatura}`, 'OK', { duration: 3000 });
  }

  async matricularGrupoCompleto(grupo: Grupo) {
    if (!this.modulo || !grupo.id) return;
    if (!confirm(`¿Matricular a todos los alumnos de ${grupo.nombre} en ${this.modulo.abreviatura}?`)) return;
    const alumnosGrupo = this.getAlumnosNoMatriculadosDeGrupo(grupo.id);
    for (const alumno of alumnosGrupo) {
      const matriculas = [...(alumno.matriculas || [])];
      matriculas.push({ moduloId: this.modulo.id!, moduloNombre: this.modulo.nombre, convocatoria: 1, estado: 'matriculado' as any });
      await this.alumnosService.update(alumno.id!, { matriculas } as any);
    }
    await this.loadData();
    this.snackBar.open(`✓ ${alumnosGrupo.length} alumnos de ${grupo.nombre} matriculados`, 'OK', { duration: 3000 });
  }

  async desmatricular(alumno: Alumno) {
    if (!this.modulo) return;
    if (!confirm(`¿Desmatricular a ${alumno.nombre} ${alumno.apellidos} de ${this.modulo.abreviatura}?`)) return;
    const matriculas = (alumno.matriculas || []).filter(m => m.moduloId !== this.modulo!.id);
    await this.alumnosService.update(alumno.id!, { matriculas } as any);
    await this.loadData();
    this.snackBar.open(`Alumno desmatriculado de ${this.modulo.abreviatura}`, 'OK', { duration: 3000 });
  }

  // ===== IMPORTAR RA DESDE EXCEL =====

  async onImportRA(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.modulo) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      // Agrupar por RA
      const rasMap = new Map<string, any>();
      for (const row of rows) {
        const raCodigo = String(row['ra_codigo'] || row['RA'] || row['codigo_ra'] || '').trim();
        const raDesc = String(row['ra_descripcion'] || row['descripcion_ra'] || '').trim();
        const raPeso = Number(row['ra_peso'] || row['peso_ra'] || 0);
        const ceCodigo = String(row['ce_codigo'] || row['CE'] || row['codigo_ce'] || '').trim();
        const ceDesc = String(row['ce_descripcion'] || row['descripcion_ce'] || '').trim();
        const cePeso = Number(row['ce_peso'] || row['peso_ce'] || 0);

        if (!ceCodigo) continue;

        if (raCodigo && !rasMap.has(raCodigo)) {
          rasMap.set(raCodigo, { codigo: raCodigo, descripcion: raDesc, porcentajePeso: raPeso, criteriosEvaluacion: [] });
        }

        // Encontrar el RA al que pertenece este CE
        let currentRA = raCodigo ? rasMap.get(raCodigo) : Array.from(rasMap.values()).pop();
        if (currentRA) {
          currentRA.criteriosEvaluacion.push({ codigo: ceCodigo, descripcion: ceDesc, porcentajePeso: cePeso });
        }
      }

      const resultadosAprendizaje = Array.from(rasMap.values());

      if (resultadosAprendizaje.length === 0) {
        this.snackBar.open('No se encontraron RA en el archivo. Columnas esperadas: ra_codigo, ra_descripcion, ra_peso, ce_codigo, ce_descripcion, ce_peso', 'Cerrar', { duration: 6000 });
        input.value = '';
        return;
      }

      // Confirmar
      const totalCE = resultadosAprendizaje.reduce((sum: number, ra: any) => sum + ra.criteriosEvaluacion.length, 0);
      if (!confirm(`Se importarán ${resultadosAprendizaje.length} Resultados de Aprendizaje con ${totalCE} Criterios de Evaluación. ¿Continuar?`)) {
        input.value = '';
        return;
      }

      // Guardar
      await this.modulosService.update(this.modulo.id!, { resultadosAprendizaje } as any);
      this.modulo.resultadosAprendizaje = resultadosAprendizaje;
      this.snackBar.open(`✓ ${resultadosAprendizaje.length} RA con ${totalCE} CE importados correctamente`, 'OK', { duration: 4000 });
    } catch (e: any) {
      this.snackBar.open('Error al importar: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    input.value = '';
  }
}
