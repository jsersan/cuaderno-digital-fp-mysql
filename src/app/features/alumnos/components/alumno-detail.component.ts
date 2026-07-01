import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AlumnosService, CalificacionesService, AsistenciaService,
  ObservacionesService, GruposService, ExportService
} from '@core/services';
import { Alumno, Calificacion, ResumenAsistencia, Observacion } from '@core/models';
import { ActiveModuleService } from '../../../core/services/active-module.service';

@Component({
  selector: 'app-alumno-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatTabsModule, MatTableModule, MatListModule,
    MatChipsModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatProgressBarModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    @if (alumno) {
      <div class="page-header">
        <div>
          <h2>{{ alumno.apellidos }}, {{ alumno.nombre }}</h2>
          <p class="subtitle">
            <span class="estado-badge" [class]="'estado-' + alumno.estado">{{ ('students.status_' + estadoKey(alumno.estado)) | translate }}</span>
            · {{ alumno.email }}
            @if (alumno.repetidor) { · <mat-chip color="warn">{{ 'students.form.repeater' | translate }}</mat-chip> }
          </p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" (click)="exportarInforme()">
            <mat-icon>picture_as_pdf</mat-icon> {{ 'students.detail.report' | translate }}
          </button>
          <button mat-raised-button [routerLink]="['/alumnos', alumno.id, 'editar']">
            <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
          </button>
          <button mat-button routerLink="/alumnos">
            <mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}
          </button>
        </div>
      </div>

      <!-- Tarjetas resumen -->
      <div class="summary-cards">
        <mat-card class="summary-card">
          <span class="summary-number">{{ stats.modulosAprobados }}/{{ alumno.matriculas.length || 0 }}</span>
          <span class="summary-label">{{ 'students.detail.modules_approved' | translate }}</span>
        </mat-card>
        <mat-card class="summary-card">
          <span class="summary-number">{{ stats.mediaGeneral | number:'1.1-1' }}</span>
          <span class="summary-label">{{ 'common.average' | translate }}</span>
        </mat-card>
        <mat-card class="summary-card">
          <span class="summary-number" [class.warn-text]="stats.modulosSuspensos > 0">
            {{ stats.modulosSuspensos }}
          </span>
          <span class="summary-label">{{ 'students.detail.modules_failed' | translate }}</span>
        </mat-card>
      </div>

      <mat-tab-group>
        <!-- Datos personales -->
        <mat-tab [label]="'students.detail.tab_data' | translate">
          <mat-card class="tab-card">
            <div class="data-grid">
              <div class="data-item"><label>{{ 'students.form.dni' | translate }}</label><span>{{ alumno.dni || '—' }}</span></div>
              <div class="data-item"><label>{{ 'students.form.birth_date' | translate }}</label><span>{{ alumno.fechaNacimiento?.toDate() | date:'dd/MM/yyyy' }}</span></div>
              <div class="data-item"><label>{{ 'common.phone' | translate }}</label><span>{{ alumno.telefono || '—' }}</span></div>
              <div class="data-item"><label>{{ 'students.detail.legal_tutor' | translate }}</label><span>{{ alumno.nombreTutor || '—' }}</span></div>
              <div class="data-item"><label>{{ 'students.detail.tutor_phone' | translate }}</label><span>{{ alumno.telefonoTutor || '—' }}</span></div>
              <div class="data-item"><label>{{ 'students.form.address' | translate }}</label><span>{{ alumno.direccion || '—' }}, {{ alumno.localidad }} {{ alumno.codigoPostal }}</span></div>
            </div>
            @if (alumno.necesidadesEspeciales) {
              <mat-divider></mat-divider>
              <div class="needs-section">
                <h4>{{ 'students.form.special_needs' | translate }}</h4>
                <p>{{ alumno.necesidadesEspeciales }}</p>
              </div>
            }
          </mat-card>
        </mat-tab>

        <!-- Matrículas y calificaciones -->
        <mat-tab [label]="'students.detail.tab_grades' | translate">
          <mat-card class="tab-card">
            <table mat-table [dataSource]="alumno.matriculas || []">
              <ng-container matColumnDef="modulo">
                <th mat-header-cell *matHeaderCellDef>{{ 'common.module' | translate }}</th>
                <td mat-cell *matCellDef="let m">{{ m.moduloNombre }}</td>
              </ng-container>
              <ng-container matColumnDef="convocatoria">
                <th mat-header-cell *matHeaderCellDef>{{ 'students.detail.convocatoria' | translate }}</th>
                <td mat-cell *matCellDef="let m">{{ m.convocatoria }}ª</td>
              </ng-container>
              <ng-container matColumnDef="estado">
                <th mat-header-cell *matHeaderCellDef>{{ 'common.status' | translate }}</th>
                <td mat-cell *matCellDef="let m">
                  <span class="estado-badge" [class]="'estado-' + m.estado">{{ m.estado | titlecase }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="nota">
                <th mat-header-cell *matHeaderCellDef>{{ 'common.grade' | translate }}</th>
                <td mat-cell *matCellDef="let m">
                  <strong [class.aprobado]="(m.notaFinal || 0) >= 5" [class.suspenso]="(m.notaFinal || 0) < 5 && m.notaFinal !== undefined">
                    {{ m.notaFinal !== undefined ? (m.notaFinal | number:'1.1-1') : '—' }}
                  </strong>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['modulo', 'convocatoria', 'estado', 'nota']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['modulo', 'convocatoria', 'estado', 'nota'];"></tr>
            </table>
          </mat-card>
        </mat-tab>

        <!-- Asistencia -->
        <mat-tab [label]="'students.detail.tab_attendance' | translate">
          <mat-card class="tab-card">
            @if (resumenesAsistencia.length === 0) {
              <p class="empty-text">{{ 'students.detail.no_attendance' | translate }}</p>
            }
            @for (res of resumenesAsistencia; track res.moduloId) {
              <div class="asistencia-item">
                <div class="asist-header">
                  <span class="asist-modulo">{{ res.moduloId }}</span>
                  <span class="asist-pct" [class.warn-text]="!res.superaMinimo">
                    {{ res.porcentajeAsistencia }}%
                  </span>
                </div>
                <mat-progress-bar [value]="res.porcentajeAsistencia"
                  [color]="res.superaMinimo ? 'primary' : 'warn'">
                </mat-progress-bar>
                <div class="asist-detail">
                  {{ 'attendance.present' | translate }}: {{ res.presencias }} | {{ 'attendance.state_justified' | translate }}: {{ res.ausenciasJustificadas }}
                  | {{ 'attendance.state_unjustified' | translate }}: {{ res.ausenciasInjustificadas }} | {{ 'attendance.state_late' | translate }}: {{ res.retrasos }}
                </div>
              </div>
            }
          </mat-card>
        </mat-tab>

        <!-- Observaciones -->
        <mat-tab [label]="'students.detail.tab_observations' | translate">
          <mat-card class="tab-card">
            @if (observaciones.length === 0) {
              <p class="empty-text">{{ 'students.detail.no_observations' | translate }}</p>
            }
            <mat-list>
              @for (obs of observaciones; track obs.id) {
                <mat-list-item>
                  <mat-icon matListItemIcon [class]="'obs-' + obs.tipo">
                    {{ obs.tipo === 'positiva' ? 'thumb_up' : obs.tipo === 'negativa' ? 'thumb_down' : 'info' }}
                  </mat-icon>
                  <span matListItemTitle>{{ obs.titulo }}</span>
                  <span matListItemLine>{{ obs.descripcion }}</span>
                  <span matListItemMeta>{{ obs.fecha.toDate() | date:'dd/MM/yyyy' }}</span>
                </mat-list-item>
              }
            </mat-list>
          </mat-card>
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; font-size: 24px; }
    .subtitle { color: #666; display: flex; align-items: center; gap: 8px; }
    .header-actions { display: flex; gap: 8px; }
    .estado-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .estado-activo { background: #e8f5e9; color: #2e7d32; }
    .estado-baja { background: #ffebee; color: #c62828; }
    .estado-matriculado { background: #e3f2fd; color: #1565c0; }
    .estado-aprobado { background: #e8f5e9; color: #2e7d32; }
    .estado-suspenso { background: #ffebee; color: #c62828; }
    .summary-cards { display: flex; gap: 16px; margin-bottom: 16px; }
    .summary-card { flex: 1; padding: 20px; text-align: center; border-radius: 12px; }
    .summary-number { font-size: 32px; font-weight: 700; display: block; }
    .summary-label { font-size: 13px; color: #666; }
    .tab-card { margin-top: 16px; padding: 24px; border-radius: 12px; }
    .data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
    .data-item label { display: block; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .data-item span { font-size: 15px; font-weight: 500; }
    .needs-section { margin-top: 16px; padding-top: 16px; }
    .needs-section h4 { color: #e65100; }
    table { width: 100%; }
    .aprobado { color: #2e7d32; }
    .suspenso { color: #c62828; }
    .warn-text { color: #c62828; }
    .asistencia-item { margin-bottom: 20px; }
    .asist-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .asist-modulo { font-weight: 500; }
    .asist-pct { font-weight: 700; font-size: 18px; }
    .asist-detail { font-size: 12px; color: #666; margin-top: 4px; }
    .obs-positiva { color: #4caf50; }
    .obs-negativa { color: #f44336; }
    .obs-informativa { color: #2196f3; }
    .empty-text { text-align: center; color: #999; padding: 32px; }
    @media (max-width: 600px) { .summary-cards { flex-direction: column; } }
  `]
})
export class AlumnoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private alumnosService = inject(AlumnosService);
  private asistenciaService = inject(AsistenciaService);
  private observacionesService = inject(ObservacionesService);
  private gruposService = inject(GruposService);
  private activeModule = inject(ActiveModuleService);
  private exportService = inject(ExportService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  

  alumno: Alumno | null = null;
  resumenesAsistencia: ResumenAsistencia[] = [];
  observaciones: Observacion[] = [];
  stats = { modulosAprobados: 0, modulosSuspensos: 0, modulosPendientes: 0, mediaGeneral: 0 };

  estadoKey(estado: string): string {
    return estado === 'baja' ? 'inactive' : estado === 'trasladado' ? 'transferred' : 'active';
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.alumno = await this.alumnosService.getById(id);
    if (this.alumno) {
      this.stats = await this.alumnosService.getEstadisticas(id);
      this.observacionesService.getByAlumno$(id).subscribe(o => this.observaciones = o);

      for (const mat of this.alumno.matriculas || []) {
        try {
          const resumen = await this.asistenciaService.calcularResumen(id, mat.moduloId, this.alumno.grupoId);
          this.resumenesAsistencia.push(resumen);
        } catch (e) { /* módulo sin registros */ }
      }
    }
  }

  private nombreModulo(moduloId: string): string {
    const mat = this.alumno?.matriculas?.find(m => m.moduloId === moduloId);
    return mat?.moduloNombre || moduloId;
  }

  exportarInforme() {
    if (!this.alumno) return;
    try {
      const grupoNombre = (this.alumno as any).grupoNombre || this.alumno.grupoId || '';
      this.exportService.exportarInformeAlumnoPDF({
        centro: 'Cuaderno Digital FP · Euskadi',
        alumnoNombre: `${this.alumno.apellidos}, ${this.alumno.nombre}`,
        grupo: grupoNombre,
        cursoAcademico: this.activeModule.cursoActual,
        email: this.alumno.email,
        dni: this.alumno.dni,
        stats: {
          modulosAprobados: this.stats.modulosAprobados,
          modulosSuspensos: this.stats.modulosSuspensos,
          mediaGeneral: this.stats.mediaGeneral,
          totalModulos: this.alumno.matriculas?.length || 0
        },
        matriculas: (this.alumno.matriculas || []).map(m => ({
          moduloNombre: m.moduloNombre,
          convocatoria: m.convocatoria,
          estado: m.estado,
          notaFinal: m.notaFinal
        })),
        asistencia: this.resumenesAsistencia.map(r => ({
          modulo: this.nombreModulo(r.moduloId),
          porcentaje: r.porcentajeAsistencia,
          presencias: r.presencias,
          justificadas: r.ausenciasJustificadas,
          injustificadas: r.ausenciasInjustificadas,
          retrasos: r.retrasos,
          superaMinimo: r.superaMinimo
        })),
        observaciones: this.observaciones.map(o => ({
          fecha: o.fecha.toDate().toLocaleDateString('es-ES'),
          tipo: o.tipo,
          titulo: o.titulo,
          descripcion: o.descripcion || ''
        }))
      });
      this.snackBar.open(this.t.instant('students.detail.report_exported'), 'OK', { duration: 3000 });
    } catch (e) {
      console.error('Error generando informe:', e);
      this.snackBar.open(this.t.instant('students.detail.report_error'), 'OK', { duration: 4000 });
    }
  }
}