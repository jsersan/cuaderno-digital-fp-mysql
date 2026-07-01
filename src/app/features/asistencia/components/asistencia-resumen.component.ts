import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AsistenciaService, AlumnosService, GruposService,
  ModulosService, AuthService, ExportService, ActiveModuleService
} from '@core/services';
import { Alumno, Grupo, ModuloProfesional, ResumenAsistencia } from '@core/models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-asistencia-resumen',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatTableModule, MatProgressBarModule, MatButtonModule,
    MatIconModule, MatTooltipModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div><h2>Resumen de Asistencia</h2><p class="subtitle">Estadísticas por alumno y módulo</p></div>
      <div class="actions">
        <button mat-raised-button (click)="exportar()" [disabled]="resumenes.length === 0">
          <mat-icon>download</mat-icon> Exportar
        </button>
        <button mat-button routerLink="/asistencia"><mat-icon>arrow_back</mat-icon> Volver</button>
      </div>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module">
        <mat-icon>menu_book</mat-icon>
        <p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a> {{ 'attendance.no_module_summary' | translate }}</p>
      </mat-card>
    } @else {
    <mat-card class="filters-card">
      <div class="filters-row">
        <div class="contexto">
          <span class="ctx-item"><mat-icon>class</mat-icon> {{ activeModule.grupoNombre || '—' }}</span>
          <span class="ctx-item"><mat-icon>menu_book</mat-icon> {{ activeModule.current?.abreviatura || '—' }}</span>
        </div>
      </div>
    </mat-card>
    }

    @if (cargando) {
      <mat-card class="loading-card">
        <mat-icon class="spin">progress_activity</mat-icon>
        <p>Calculando asistencia de la clase...</p>
      </mat-card>
    }

    @if (!cargando && resumenes.length > 0) {
      <!-- ===== RESUMEN COLECTIVO DE LA CLASE ===== -->
      <div class="class-stats">
        <mat-card class="stat-box media" [class.media-warn]="mediaClase < 85">
          <div class="stat-top">
            <mat-icon>groups</mat-icon>
            <span class="stat-label">Asistencia media de la clase</span>
          </div>
          <div class="stat-value">{{ mediaClase | number:'1.1-1' }}%</div>
          <mat-progress-bar [value]="mediaClase" [color]="mediaClase >= 85 ? 'primary' : 'warn'"></mat-progress-bar>
          <span class="stat-sub">{{ resumenes.length }} alumnos · mínimo requerido 85%</span>
        </mat-card>

        <mat-card class="stat-box riesgo" [class.riesgo-cero]="alumnosEnRiesgo.length === 0">
          <div class="stat-top">
            <mat-icon>{{ alumnosEnRiesgo.length > 0 ? 'warning' : 'verified' }}</mat-icon>
            <span class="stat-label">En riesgo de baja</span>
          </div>
          <div class="stat-value">{{ alumnosEnRiesgo.length }}</div>
          <span class="stat-sub">
            @if (alumnosEnRiesgo.length > 0) {
              de {{ resumenes.length }} alumnos no alcanzan el 85%
            } @else {
              Toda la clase supera el mínimo de asistencia
            }
          </span>
        </mat-card>
      </div>

      <!-- Alerta de bajas por asistencia -->
      @if (alumnosEnRiesgo.length > 0) {
        <mat-card class="alert-card">
          <mat-icon>warning</mat-icon>
          <div>
            <strong>{{ alumnosEnRiesgo.length }} alumno(s) en riesgo de baja por asistencia</strong>
            <p>No alcanzan el mínimo del 85% de asistencia requerido</p>
          </div>
        </mat-card>
      }

      <mat-card class="table-card">
        <table mat-table [dataSource]="resumenes">
          <ng-container matColumnDef="alumno">
            <th mat-header-cell *matHeaderCellDef>Alumno/a</th>
            <td mat-cell *matCellDef="let r">
              <a [routerLink]="['/alumnos', r.alumnoId]" class="alumno-link">
                {{ getAlumnoNombre(r.alumnoId) }}
              </a>
            </td>
          </ng-container>

          <ng-container matColumnDef="porcentaje">
            <th mat-header-cell *matHeaderCellDef>% Asistencia</th>
            <td mat-cell *matCellDef="let r">
              <div class="progress-cell">
                <mat-progress-bar [value]="r.porcentajeAsistencia"
                  [color]="r.superaMinimo ? 'primary' : 'warn'">
                </mat-progress-bar>
                <span class="pct" [class.warn-text]="!r.superaMinimo">
                  {{ r.porcentajeAsistencia }}%
                </span>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="presencias">
            <th mat-header-cell *matHeaderCellDef matTooltip="Presencias">
              <mat-icon class="col-icon" style="color:#4caf50">check_circle</mat-icon>
            </th>
            <td mat-cell *matCellDef="let r">{{ r.presencias }}</td>
          </ng-container>

          <ng-container matColumnDef="justificadas">
            <th mat-header-cell *matHeaderCellDef matTooltip="Faltas justificadas">
              <mat-icon class="col-icon" style="color:#ff9800">event_busy</mat-icon>
            </th>
            <td mat-cell *matCellDef="let r">{{ r.ausenciasJustificadas }}</td>
          </ng-container>

          <ng-container matColumnDef="injustificadas">
            <th mat-header-cell *matHeaderCellDef matTooltip="Faltas injustificadas">
              <mat-icon class="col-icon" style="color:#f44336">cancel</mat-icon>
            </th>
            <td mat-cell *matCellDef="let r">{{ r.ausenciasInjustificadas }}</td>
          </ng-container>

          <ng-container matColumnDef="retrasos">
            <th mat-header-cell *matHeaderCellDef matTooltip="Retrasos">
              <mat-icon class="col-icon" style="color:#9c27b0">schedule</mat-icon>
            </th>
            <td mat-cell *matCellDef="let r">{{ r.retrasos }}</td>
          </ng-container>

          <ng-container matColumnDef="faltas">
            <th mat-header-cell *matHeaderCellDef matTooltip="Total de faltas (justificadas + injustificadas)">Faltas</th>
            <td mat-cell *matCellDef="let r">
              <strong [class.warn-text]="(r.ausenciasJustificadas + r.ausenciasInjustificadas) > 0">
                {{ r.ausenciasJustificadas + r.ausenciasInjustificadas }}
              </strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let r">{{ r.totalClases }}</td>
          </ng-container>

          <ng-container matColumnDef="estado">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (!r.superaMinimo) {
                <mat-icon color="warn" matTooltip="No supera el mínimo de asistencia">error</mat-icon>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedCols"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedCols;"
              [class.riesgo-row]="!row.superaMinimo"></tr>
        </table>
      </mat-card>
    }

    @if (!cargando && resumenes.length === 0 && grupoId && moduloId) {
      <mat-card class="empty-card">
        <mat-icon>event_available</mat-icon>
        <p>No hay alumnos matriculados en este módulo para esta selección</p>
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .actions { display: flex; gap: 8px; }
    .filters-card { margin-bottom: 16px; padding: 16px; border-radius: 12px; }
    .filters-row { display: flex; gap: 12px; }
    .no-module { display: flex; align-items: center; gap: 12px; justify-content: center; text-align: center; padding: 32px; border-radius: 12px; color: #777; margin-bottom: 16px; border: 2px dashed #ddd; }
    .no-module mat-icon { font-size: 32px; width: 32px; height: 32px; color: #bbb; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .contexto { display: flex; gap: 16px; }
    .ctx-item { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1565c0; background: #e3f2fd; padding: 8px 14px; border-radius: 20px; font-size: 14px; }
    .ctx-item mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .loading-card { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 32px; border-radius: 12px; color: #777; margin-bottom: 16px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Resumen colectivo */
    .class-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .stat-box { padding: 20px; border-radius: 12px; }
    .stat-top { display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px; font-weight: 600; }
    .stat-top mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .stat-label { font-size: 13px; }
    .stat-value { font-size: 38px; font-weight: 800; line-height: 1.1; margin: 8px 0; }
    .stat-sub { font-size: 12px; color: #888; }
    .stat-box.media .stat-value { color: #2e7d32; }
    .stat-box.media mat-progress-bar { margin: 4px 0 8px; }
    .stat-box.media.media-warn .stat-value { color: #c62828; }
    .stat-box.riesgo { border-left: 4px solid #ff9800; }
    .stat-box.riesgo .stat-top mat-icon { color: #e65100; }
    .stat-box.riesgo .stat-value { color: #e65100; }
    .stat-box.riesgo.riesgo-cero { border-left-color: #4caf50; }
    .stat-box.riesgo.riesgo-cero .stat-top mat-icon, .stat-box.riesgo.riesgo-cero .stat-value { color: #2e7d32; }

    .alert-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 12px; background: #fff3e0; margin-bottom: 16px; border-left: 4px solid #ff9800; }
    .alert-card mat-icon { color: #e65100; font-size: 32px; width: 32px; height: 32px; }
    .alert-card p { margin: 4px 0 0; font-size: 13px; color: #666; }
    .table-card { border-radius: 12px; overflow: hidden; }
    table { width: 100%; }
    .alumno-link { color: #1565c0; text-decoration: none; font-weight: 500; }
    .progress-cell { display: flex; align-items: center; gap: 12px; min-width: 200px; }
    .progress-cell mat-progress-bar { flex: 1; }
    .pct { font-weight: 700; font-size: 15px; min-width: 48px; text-align: right; }
    .warn-text { color: #c62828; }
    .col-icon { font-size: 20px; width: 20px; height: 20px; }
    .riesgo-row { background: #fff8e1; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class AsistenciaResumenComponent implements OnInit {
  private asistenciaService = inject(AsistenciaService);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  private exportService = inject(ExportService);

  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  alumnos: Alumno[] = [];
  resumenes: ResumenAsistencia[] = [];
  cargando = false;
  get grupoId() { return this.activeModule.grupoId; }
  get moduloId() { return this.activeModule.moduloId; }
  displayedCols = ['alumno', 'porcentaje', 'presencias', 'justificadas', 'injustificadas', 'retrasos', 'faltas', 'total', 'estado'];

  get alumnosEnRiesgo() { return this.resumenes.filter(r => !r.superaMinimo); }

  // Media de asistencia de toda la clase
  get mediaClase(): number {
    if (this.resumenes.length === 0) return 0;
    const suma = this.resumenes.reduce((acc, r) => acc + r.porcentajeAsistencia, 0);
    return Math.round((suma / this.resumenes.length) * 100) / 100;
  }

  async ngOnInit() {
    await this.activeModule.restore();
    if (this.grupoId) await this.onGrupoChange();
  }

  async onGrupoChange() {
    if (!this.grupoId) return;
    this.alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    if (this.moduloId) {
      this.alumnos = this.alumnos.filter(a => (a.matriculas || []).some(m => m.moduloId === this.moduloId));
    }
    this.alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    if (this.moduloId) await this.loadResumenes();
  }

  async loadResumenes() {
    if (!this.grupoId || !this.moduloId) return;
    this.cargando = true;
    this.resumenes = [];
    try {
      // Genera un resumen para TODOS los alumnos del grupo (incluidos los que
      // no tienen ningún registro: aparecerán con 100% / 0 faltas).
      // calcularResumenGrupo precarga ambas fuentes (asistencia + asistencia_mensual)
      // una sola vez para todo el grupo.
      const ids = this.alumnos.map(a => a.id!).filter(Boolean);
      const resumenes = await this.asistenciaService.calcularResumenGrupo(this.moduloId, this.grupoId, ids);
      // Mantener el mismo orden alfabético que la lista de alumnos
      const orden = new Map(ids.map((id, i) => [id, i]));
      this.resumenes = resumenes.sort((a, b) => (orden.get(a.alumnoId) ?? 0) - (orden.get(b.alumnoId) ?? 0));
    } catch (e) {
      console.error('Error calculando resúmenes de asistencia:', e);
      this.resumenes = [];
    }
    this.cargando = false;
  }

  getAlumnoNombre(id: string): string {
    const a = this.alumnos.find(x => x.id === id);
    return a ? `${a.apellidos}, ${a.nombre}` : id;
  }

  exportar() {
    const mod = this.modulos.find(m => m.id === this.moduloId);
    this.exportService.exportarAsistenciaExcel(this.resumenes, this.alumnos, mod?.abreviatura || 'Modulo');
  }
}