import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExamenesService, AuthService, GruposService, ModulosService, ActiveModuleService, RecuperacionesService } from '@core/services';
import { firstValueFrom } from 'rxjs';
import { Examen, Grupo, ModuloProfesional, TipoExamen } from '@core/models';
import { ConfirmService } from '../../../shared/confirm/confirm.service';

@Component({
  selector: 'app-examenes-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatMenuModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div><h2>{{ 'exams.title' | translate }}</h2><p class="subtitle">{{ 'exams.subtitle' | translate }}</p></div>
      <button mat-raised-button color="primary" routerLink="/examenes/nuevo">
        <mat-icon>post_add</mat-icon> {{ 'exams.new' | translate }}
      </button>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module"><mat-icon>menu_book</mat-icon> {{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a></mat-card>
    }

    <mat-card class="filters-card">
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'exams.type' | translate }}</mat-label>
          <mat-select [(ngModel)]="filtroTipo" (ngModelChange)="filterExamenes()">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            @for (t of tipos; track t) { <mat-option [value]="t">{{ t | titlecase }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-card>

    <div class="examenes-grid">
      @for (examen of filteredExamenes; track examen.id) {
        <mat-card class="examen-card" [class.pasado]="isPast(examen)">
          <div class="examen-header">
            <div>
              <h3>{{ examen.titulo }}</h3>
              <div class="examen-meta">
                <mat-chip>{{ examen.tipo | titlecase }}</mat-chip>
                <mat-chip>{{ examen.evaluacion }}</mat-chip>
              </div>
            </div>
            <div class="header-actions">
              <button mat-raised-button color="primary" [routerLink]="['/examenes', examen.id, 'calificar']" class="btn-calif">
                <mat-icon>grading</mat-icon> {{ 'exams.correct' | translate }}
              </button>
              <button mat-icon-button [matMenuTriggerFor]="menu">
                <mat-icon>more_vert</mat-icon>
              </button>
            </div>
            <mat-menu #menu="matMenu">
              <button mat-menu-item [routerLink]="['/examenes', examen.id]"><mat-icon>visibility</mat-icon> {{ 'common.view_detail' | translate }}</button>
              <button mat-menu-item [routerLink]="['/examenes', examen.id, 'calificar']"><mat-icon>grading</mat-icon> {{ 'exams.correct' | translate }}</button>
              @if (!todosAprobados(examen)) {
                <button mat-menu-item (click)="generarRecuperacion(examen)"><mat-icon>refresh</mat-icon> {{ 'exams.generate_recovery' | translate }}</button>
              }
              <button mat-menu-item (click)="eliminarExamen(examen)"><mat-icon color="warn">delete</mat-icon> {{ 'common.delete' | translate }}</button>
            </mat-menu>
          </div>

          <div class="examen-info">
            <div class="info-item"><mat-icon>star</mat-icon>{{ 'exams.points' | translate:{ pts: examen.puntuacionMaxima, min: examen.notaMinimaAprobado } }}</div>
          </div>

          @if (examen.calificaciones.length) {
            <div class="examen-stats">
              <span class="stat-aprobados">{{ 'exams.stat_approved' | translate:{ count: getAprobados(examen) } }}</span>
              <span class="stat-suspensos">{{ 'exams.stat_failed' | translate:{ count: getSuspensos(examen) } }}</span>
              <span class="stat-media">{{ 'exams.stat_avg' | translate:{ avg: (getMedia(examen) | number:'1.1-1') } }}</span>
            </div>
          }
          @if (examen.permiteRecuperacion && getSuspensos(examen) > 0) {
            <div class="recovery-badge">
              <mat-icon>refresh</mat-icon> {{ 'exams.need_recovery' | translate:{ count: getSuspensos(examen) } }}
            </div>
          }
        </mat-card>
      }
      @if (filteredExamenes.length === 0) {
        <mat-card class="empty-card"><mat-icon>quiz</mat-icon><p>{{ 'exams.empty' | translate }}</p></mat-card>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .no-module { display: flex; align-items: center; gap: 8px; padding: 16px; border-radius: 12px; color: #777; margin-bottom: 16px; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .filters-card { margin-bottom: 16px; padding: 16px; border-radius: 12px; }
    .filters-row { display: flex; gap: 12px; }
    .examenes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
    .examen-card { padding: 20px; border-radius: 12px; border-left: 4px solid #2196f3; }
    .examen-card.pasado { border-left-color: #9e9e9e; opacity: 0.85; }
    .examen-header { display: flex; justify-content: space-between; }
    .header-actions { display: flex; align-items: center; gap: 4px; }
    .btn-calif { font-size: 12px !important; }
    .examen-header h3 { margin: 0 0 8px; }
    .examen-meta { display: flex; gap: 8px; }
    .examen-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
    .info-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #555; }
    .info-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: #999; }
    .examen-stats { display: flex; gap: 16px; font-size: 13px; padding: 8px 0; border-top: 1px solid #eee; }
    .stat-aprobados { color: #2e7d32; font-weight: 500; }
    .stat-suspensos { color: #c62828; font-weight: 500; }
    .stat-media { color: #1565c0; font-weight: 500; }
    .recovery-badge { display: flex; align-items: center; gap: 4px; margin-top: 8px; padding: 6px 12px; background: #fff3e0; border-radius: 8px; font-size: 12px; color: #e65100; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
    @media (max-width: 600px) { .examenes-grid { grid-template-columns: 1fr; } }
  `]
})
export class ExamenesListComponent implements OnInit {
  private examenesService = inject(ExamenesService);
  private gruposService = inject(GruposService);
  private recService = inject(RecuperacionesService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private confirm = inject(ConfirmService);
  activeModule = inject(ActiveModuleService);

  examenes: Examen[] = [];
  filteredExamenes: Examen[] = [];
  grupos: Grupo[] = [];
  filtroTipo = '';
  tipos = Object.values(TipoExamen);

  async ngOnInit() {
    await this.loadExamenes();
  }

  async loadExamenes() {
    const user = this.auth.currentUser;
    if (!user || !this.activeModule.moduloId) return;
    try {
      let todos = await this.examenesService.queryByField('profesorId', user.uid);
      todos = todos.filter(e => e.moduloId === this.activeModule.moduloId);
      if (this.activeModule.grupoId) todos = todos.filter(e => e.grupoId === this.activeModule.grupoId);
      this.examenes = todos.sort((a: any, b: any) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
      this.filterExamenes();
      // La recuperación automática ahora se crea al GUARDAR las notas en
      // examen-calificar.component.ts (punto de disparo más fiable).
      // Aquí dejamos solo la opción manual "Generar recuperación" del menú.
    } catch (e) { console.error('Error cargando exámenes:', e); }
  }

  // Para cada examen corregido que NO tenga el 100% de aprobados y aún no tenga
  // recuperación vinculada, crea una recuperación con fecha = fecha examen + 7 días.
  private async sincronizarRecuperaciones() {
    let creadas = 0;
    for (const examen of this.examenes) {
      if (!examen.id) continue;
      if (examen.examenRecuperacionId) continue;      // ya tiene recuperación
      if (!this.tieneCorregidos(examen)) continue;    // sin notas aún, nada que recuperar
      if (this.todosAprobados(examen)) continue;       // 100% aprobados, no hace falta
      try {
        const fechaRecup = this.fechaMasUnaSemana(examen);
        await this.recService.crearDesdeExamen(examen, fechaRecup, examen.notaMinimaAprobado >= 5 ? 6 : examen.notaMinimaAprobado);
        examen.examenRecuperacionId = 'creada'; // marca local para no duplicar en esta sesión
        creadas++;
      } catch (e) { console.warn('No se pudo crear recuperación automática:', e); }
    }
    if (creadas > 0) {
      this.snackBar.open(this.t.instant('exams.recovery_auto', { count: creadas }), 'OK', { duration: 4000 });
    }
  }

  private fechaMasUnaSemana(examen: Examen): Date {
    const base = examen.fecha?.toDate ? examen.fecha.toDate() : new Date();
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return d;
  }

  // Crear/regenerar manualmente la recuperación de un examen
  async generarRecuperacion(examen: Examen) {
    if (!examen.id) return;
    if (!this.tieneCorregidos(examen)) {
      this.snackBar.open(this.t.instant('exams.recovery_no_grades'), 'OK', { duration: 4000 });
      return;
    }
    try {
      const fechaRecup = this.fechaMasUnaSemana(examen);
      await this.recService.crearDesdeExamen(examen, fechaRecup, examen.notaMinimaAprobado >= 5 ? 6 : examen.notaMinimaAprobado);
      examen.examenRecuperacionId = 'creada';
      this.snackBar.open(this.t.instant('exams.recovery_created'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  // ¿Hay al menos una calificación puesta?
  tieneCorregidos(e: Examen): boolean {
    return (e.calificaciones || []).some(c => !c.noPresente && c.nota != null);
  }

  // 100% de aprobados entre los presentados (si no hay notas, se considera que no)
  todosAprobados(e: Examen): boolean {
    const conNota = (e.calificaciones || []).filter(c => !c.noPresente && c.nota != null);
    if (conNota.length === 0) return false;
    return conNota.every(c => (c.nota || 0) >= e.notaMinimaAprobado);
  }

  filterExamenes() {
    this.filteredExamenes = this.filtroTipo
      ? this.examenes.filter(e => e.tipo === this.filtroTipo)
      : [...this.examenes];
  }

  async eliminarExamen(examen: Examen) {
    if (!examen.id) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('common.delete'),
      message: this.t.instant('exams.confirm_delete', { titulo: examen.titulo }),
      confirmText: this.t.instant('common.delete'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await this.examenesService.delete(examen.id);
      this.examenes = this.examenes.filter(e => e.id !== examen.id);
      this.filterExamenes();
      this.snackBar.open(this.t.instant('exams.deleted'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  isPast(examen: Examen): boolean {
    return examen.fecha.toDate() < new Date();
  }

  getAprobados(e: Examen): number {
    return (e.calificaciones || []).filter(c => !c.noPresente && (c.nota || 0) >= e.notaMinimaAprobado).length;
  }
  getSuspensos(e: Examen): number {
    return (e.calificaciones || []).filter(c => c.necesitaRecuperacion).length;
  }
  getMedia(e: Examen): number {
    const notas = (e.calificaciones || []).filter(c => !c.noPresente && c.nota != null).map(c => c.nota!);
    return notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
  }
}