import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  ExportService, AlumnosService, CalificacionesService,
  AsistenciaService, GruposService, ModulosService, AuthService, ActiveModuleService
} from '@core/services';
import { Grupo, ModuloProfesional, TipoEvaluacion } from '@core/models';

@Component({
  selector: 'app-informes',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <h2>{{ 'reports.title' | translate }}</h2>
      <p class="subtitle">{{ 'reports.subtitle' | translate }}</p>
    </div>

    <!-- Selección común -->
    <mat-card class="filters-card">
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.group' | translate }}</mat-label>
          <mat-select [(ngModel)]="grupoId">
            @for (g of grupos; track g.id) { <mat-option [value]="g.id">{{ g.nombre }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.module' | translate }}</mat-label>
          <mat-select [(ngModel)]="moduloId">
            @for (m of modulos; track m.id) { <mat-option [value]="m.id">{{ m.abreviatura }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.evaluation' | translate }}</mat-label>
          <mat-select [(ngModel)]="evaluacion">
            @for (ev of evaluaciones; track ev) { <mat-option [value]="ev">{{ ev }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-card>

    <!-- Tipos de informes -->
    <div class="reports-grid">
      <mat-card class="report-card" (click)="generarListadoAlumnos()">
        <mat-icon class="report-icon" style="color: #1565c0">people</mat-icon>
        <h3>{{ 'reports.cards.students' | translate }}</h3>
        <p>{{ 'reports.cards.students_desc' | translate }}</p>
        <button mat-raised-button color="primary"><mat-icon>download</mat-icon> {{ 'common.export' | translate }}</button>
      </mat-card>

      <mat-card class="report-card" (click)="generarCalificaciones()">
        <mat-icon class="report-icon" style="color: #2e7d32">grade</mat-icon>
        <h3>{{ 'reports.cards.grades' | translate }}</h3>
        <p>{{ 'reports.cards.grades_desc' | translate }}</p>
        <button mat-raised-button color="primary"><mat-icon>download</mat-icon> {{ 'common.export' | translate }}</button>
      </mat-card>

      <mat-card class="report-card" (click)="generarAsistencia()">
        <mat-icon class="report-icon" style="color: #e65100">event_available</mat-icon>
        <h3>{{ 'reports.cards.attendance' | translate }}</h3>
        <p>{{ 'reports.cards.attendance_desc' | translate }}</p>
        <button mat-raised-button color="primary"><mat-icon>download</mat-icon> {{ 'common.export' | translate }}</button>
      </mat-card>

      <mat-card class="report-card" (click)="generarActa()">
        <mat-icon class="report-icon" style="color: #6a1b9a">description</mat-icon>
        <h3>{{ 'reports.cards.record' | translate }}</h3>
        <p>{{ 'reports.cards.record_desc' | translate }}</p>
        <button mat-raised-button color="primary"><mat-icon>download</mat-icon> {{ 'common.export' | translate }}</button>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .filters-card { margin-bottom: 20px; padding: 16px; border-radius: 12px; }
    .filters-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .reports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .report-card { padding: 24px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; text-align: center; }
    .report-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .report-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    .report-card h3 { margin: 0 0 8px; font-size: 16px; }
    .report-card p { color: #666; font-size: 13px; margin: 0 0 16px; line-height: 1.5; }
    @media (max-width: 600px) { .reports-grid { grid-template-columns: 1fr; } }
  `]
})
export class InformesComponent implements OnInit {
  private alumnosService = inject(AlumnosService);
  private califService = inject(CalificacionesService);
  private asistenciaService = inject(AsistenciaService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private exportService = inject(ExportService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private activeModule = inject(ActiveModuleService);
  private t = inject(TranslateService);

  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  evaluaciones = Object.values(TipoEvaluacion);
  grupoId = '';
  moduloId = '';
  evaluacion: TipoEvaluacion = TipoEvaluacion.PRIMERA;

  ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);
    this.modulosService.getByProfesor$(user.uid).subscribe(m => this.modulos = m);
  }

  // Nombre completo del profesor para firmas/encabezados: "Nombre Apellidos".
  // Si no hay apellidos, cae a displayName y, en último término, al email.
  private nombreProfesor(): string {
    const u: any = this.auth.currentUser;
    if (!u) return '';
    const completo = `${u.nombre || ''} ${u.apellidos || ''}`.trim();
    if (completo) return completo;
    return u.displayName || u.email || '';
  }

  async generarListadoAlumnos() {
    if (!this.grupoId) { this.snackBar.open(this.t.instant('reports.select_group'), 'OK', { duration: 3000 }); return; }
    const alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    this.exportService.exportarAlumnosExcel(alumnos, 'Listado_Alumnos');
    this.snackBar.open(this.t.instant('reports.generated'), 'OK', { duration: 3000 });
  }

  async generarCalificaciones() {
    if (!this.grupoId || !this.moduloId) { this.snackBar.open(this.t.instant('reports.select_group_module'), 'OK', { duration: 3000 }); return; }
    const alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    const mod = this.modulos.find(m => m.id === this.moduloId);
    this.califService.getByModuloGrupoEvaluacion$(this.moduloId, this.grupoId, this.evaluacion)
      .subscribe(califs => {
        this.exportService.exportarCalificacionesExcel(califs, alumnos, mod?.abreviatura || '', this.evaluacion);
        this.snackBar.open(this.t.instant('reports.grades_exported'), 'OK', { duration: 3000 });
      });
  }

  async generarAsistencia() {
    if (!this.grupoId || !this.moduloId) { this.snackBar.open(this.t.instant('reports.select_group_module'), 'OK', { duration: 3000 }); return; }
    const alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    const resumenes = [];
    for (const a of alumnos) {
      try {
        const r = await this.asistenciaService.calcularResumen(a.id!, this.moduloId, this.grupoId);
        resumenes.push(r);
      } catch {}
    }
    const mod = this.modulos.find(m => m.id === this.moduloId);
    const grp = this.grupos.find(g => g.id === this.grupoId);
    // Resumen de asistencia como PDF (mismas columnas que el Excel)
    this.exportService.exportarAsistenciaPDF(resumenes, alumnos, mod?.abreviatura || 'Modulo', {
      centro: 'Cuaderno Digital FP · Euskadi',
      grupo: grp?.nombre || '',
      cursoAcademico: this.activeModule.cursoActual,
      profesor: this.nombreProfesor()
    });
    this.snackBar.open(this.t.instant('reports.attendance_exported'), 'OK', { duration: 3000 });
  }

  async generarActa() {
    if (!this.grupoId || !this.moduloId) {
      this.snackBar.open(this.t.instant('reports.select_group_module'), 'OK', { duration: 3000 });
      return;
    }
    this.snackBar.open(this.t.instant('reports.record_generating'), '', { duration: 1500 });

    try {
      const alumnos = await this.alumnosService.getByGrupo(this.grupoId);
      const califs = await firstValueFrom(
        this.califService.getByModuloGrupoEvaluacion$(this.moduloId, this.grupoId, this.evaluacion)
      );

      if (!califs || califs.length === 0) {
        this.snackBar.open(this.t.instant('reports.no_grades'), 'OK', { duration: 4000 });
        return;
      }

      const nombreAlumno = (id: string) => {
        const a = alumnos.find(x => x.id === id);
        return a ? `${a.apellidos}, ${a.nombre}` : id;
      };

      const filas = califs.map(c => ({
        alumnoNombre: nombreAlumno(c.alumnoId),
        nota: c.notaFinal,
        aprobado: c.aprobado,
        observaciones: c.observaciones || ''
      }));

      const notas = califs.map(c => c.notaFinal).filter(n => n != null);
      const aprobados = califs.filter(c => c.aprobado).length;
      const estadisticas = {
        totalAlumnos: califs.length,
        aprobados,
        suspensos: califs.length - aprobados,
        noEvaluados: califs.length - notas.length,
        notaMedia: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100 : 0,
        porcentajeAprobados: califs.length ? Math.round((aprobados / califs.length) * 100) : 0
      };

      const mod = this.modulos.find(m => m.id === this.moduloId);
      const grp = this.grupos.find(g => g.id === this.grupoId);

      this.exportService.exportarActaPDF({
        centro: 'Cuaderno Digital FP · Euskadi',
        grupo: grp?.nombre || '',
        modulo: mod?.abreviatura || '',
        cursoAcademico: '2025-2026',
        evaluacion: this.evaluacion,
        profesor: this.nombreProfesor(),
        filas,
        estadisticas
      });

      this.snackBar.open(this.t.instant('reports.record_exported'), 'OK', { duration: 3000 });
    } catch (e) {
      console.error('Error generando acta:', e);
      this.snackBar.open(this.t.instant('reports.record_error'), 'OK', { duration: 4000 });
    }
  }
}