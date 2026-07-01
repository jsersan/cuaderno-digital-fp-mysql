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
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TareasService, AuthService, GruposService, ModulosService, ActiveModuleService } from '@core/services';
import { Tarea, Grupo, ModuloProfesional, EstadoTarea } from '@core/models';
import { ConfirmService } from '../../../shared/confirm/confirm.service';

@Component({
  selector: 'app-tareas-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatMenuModule, MatDividerModule, MatBadgeModule, MatTooltipModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'tasks.title' | translate }}</h2>
        <p class="subtitle">{{ 'tasks.subtitle' | translate }}</p>
      </div>
      <button mat-raised-button color="primary" routerLink="/tareas/nueva">
        <mat-icon>add_task</mat-icon> {{ 'tasks.new' | translate }}
      </button>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module"><mat-icon>menu_book</mat-icon> {{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a></mat-card>
    }

    <div class="tareas-grid">
      @for (tarea of tareas; track tarea.id; let i = $index) {
        <mat-card class="tarea-card">
          <div class="tarea-header">
            <div class="tarea-info">
              <h3>{{ tarea.titulo }}</h3>
              <div class="tarea-meta">
                <mat-chip>{{ tarea.evaluacion }}</mat-chip>
                <span class="fecha">
                  <mat-icon>event</mat-icon>
                  {{ 'tasks.delivery' | translate }}: {{ tarea.fechaEntrega.toDate() | date:'dd/MM/yyyy HH:mm' }}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <button mat-icon-button (click)="moverArriba(i)" [disabled]="i === 0" [matTooltip]="'tasks.move_up' | translate">
                <mat-icon>arrow_upward</mat-icon>
              </button>
              <button mat-icon-button (click)="moverAbajo(i)" [disabled]="i === tareas.length - 1" [matTooltip]="'tasks.move_down' | translate">
                <mat-icon>arrow_downward</mat-icon>
              </button>
              <button mat-icon-button [matMenuTriggerFor]="tareaMenu">
                <mat-icon>more_vert</mat-icon>
              </button>
            </div>
            <mat-menu #tareaMenu="matMenu">
              <button mat-menu-item [routerLink]="['/tareas', tarea.id]">
                <mat-icon>visibility</mat-icon> {{ 'common.view_detail' | translate }}
              </button>
              <button mat-menu-item [routerLink]="['/tareas', tarea.id, 'editar']">
                <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
              </button>
              <button mat-menu-item [routerLink]="['/tareas', tarea.id, 'corregir']">
                <mat-icon>rate_review</mat-icon> {{ 'tasks.correct' | translate }}
              </button>
              <button mat-menu-item (click)="eliminarTarea(tarea)">
                <mat-icon color="warn">delete</mat-icon> {{ 'common.delete' | translate }}
              </button>
            </mat-menu>
          </div>

          <p class="tarea-desc">{{ tarea.descripcion | slice:0:120 }}{{ tarea.descripcion.length > 120 ? '...' : '' }}</p>

          <!-- Barra de progreso de entregas -->
          <div class="entregas-progress">
            <div class="progress-bar">
              <div class="progress-segment corregidas" [style.width.%]="getStats(tarea).pctCorregidas"></div>
              <div class="progress-segment entregadas" [style.width.%]="getStats(tarea).pctEntregadas"></div>
            </div>
            <div class="progress-legend">
              <span class="legend-item"><span class="dot corregidas"></span> {{ getStats(tarea).corregidas }} {{ 'tasks.corrected' | translate }}</span>
              <span class="legend-item"><span class="dot entregadas"></span> {{ getStats(tarea).pendientes }} {{ 'tasks.pending' | translate }}</span>
              <span class="legend-item"><span class="dot no-entregadas"></span> {{ getStats(tarea).noEntregadas }} {{ 'tasks.not_delivered' | translate }}</span>
            </div>
          </div>

          <mat-divider></mat-divider>
          <div class="tarea-actions">
            <span class="puntuacion">{{ 'tasks.points_pct' | translate:{ pts: tarea.puntuacionMaxima, pct: tarea.porcentajeNotaFinal } }}</span>
            <button mat-button color="primary" [routerLink]="['/tareas', tarea.id, 'corregir']"
                    *ngIf="getStats(tarea).pendientes > 0">
              <mat-icon>rate_review</mat-icon> {{ 'tasks.correct' | translate }} ({{ getStats(tarea).pendientes }})
            </button>
          </div>
        </mat-card>
      }

      @if (tareas.length === 0) {
        <mat-card class="empty-card">
          <mat-icon>assignment</mat-icon>
          <p>{{ 'tasks.empty' | translate }}</p>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .no-module { display: flex; align-items: center; gap: 8px; padding: 16px; border-radius: 12px; color: #777; margin-bottom: 16px; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .tareas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; }
    .tarea-card { padding: 20px; border-radius: 12px; }
    .tarea-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-actions { display: flex; align-items: center; }
    .card-actions button { width: 36px; height: 36px; line-height: 36px; }
    .tarea-info h3 { margin: 0 0 8px; font-size: 17px; }
    .tarea-meta { display: flex; align-items: center; gap: 12px; }
    .fecha { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #666; }
    .fecha mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tarea-desc { color: #555; font-size: 14px; line-height: 1.5; margin: 12px 0; }
    .entregas-progress { margin: 12px 0; }
    .progress-bar { height: 8px; background: #eee; border-radius: 4px; display: flex; overflow: hidden; }
    .progress-segment { height: 100%; transition: width 0.3s; }
    .progress-segment.corregidas { background: #4caf50; }
    .progress-segment.entregadas { background: #ff9800; }
    .progress-legend { display: flex; gap: 16px; margin-top: 6px; font-size: 12px; color: #666; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot.corregidas { background: #4caf50; }
    .dot.entregadas { background: #ff9800; }
    .dot.no-entregadas { background: #eee; }
    .tarea-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; }
    .puntuacion { font-size: 13px; color: #999; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
    @media (max-width: 600px) { .tareas-grid { grid-template-columns: 1fr; } }
  `]
})
export class TareasListComponent implements OnInit {
  private tareasService = inject(TareasService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private confirm = inject(ConfirmService);
  activeModule = inject(ActiveModuleService);

  tareas: Tarea[] = [];
  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];

  async ngOnInit() {
    await this.loadTareas();
  }

  async loadTareas() {
    const user = this.auth.currentUser;
    if (!user || !this.activeModule.moduloId) return;
    try {
      let todas = await this.tareasService.queryByField('profesorId', user.uid);
      todas = todas.filter(t => t.moduloId === this.activeModule.moduloId);
      if (this.activeModule.grupoId) todas = todas.filter(t => t.grupoId === this.activeModule.grupoId);
      this.tareas = todas.filter(t => !t.archivada)
        .sort((a: any, b: any) => {
          // Si hay 'orden' definido, ordenar por él; si no, por fecha de entrega
          const oa = a.orden, ob = b.orden;
          if (oa != null && ob != null) return oa - ob;
          if (oa != null) return -1;
          if (ob != null) return 1;
          return (a.fechaEntrega?.seconds || 0) - (b.fechaEntrega?.seconds || 0);
        });
    } catch { this.tareas = []; }
  }

  getStats(tarea: Tarea) {
    const entregas = tarea.entregas || [];
    const total = entregas.length || 1;
    const corregidas = entregas.filter(e => e.estado === EstadoTarea.CORREGIDA).length;
    const pendientes = entregas.filter(e => e.estado === EstadoTarea.ENTREGADA).length;
    const noEntregadas = entregas.filter(e => e.estado === EstadoTarea.NO_ENTREGADA).length;
    return {
      corregidas, pendientes, noEntregadas,
      pctCorregidas: (corregidas / total) * 100,
      pctEntregadas: (pendientes / total) * 100
    };
  }

  async eliminarTarea(tarea: Tarea) {
    if (!tarea.id) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('common.delete'),
      message: this.t.instant('tasks.confirm_delete', { titulo: tarea.titulo }),
      confirmText: this.t.instant('common.delete'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await this.tareasService.delete(tarea.id);
      this.tareas = this.tareas.filter(t => t.id !== tarea.id);
      this.snackBar.open(this.t.instant('tasks.deleted'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  moverArriba(i: number) {
    if (i <= 0) return;
    [this.tareas[i - 1], this.tareas[i]] = [this.tareas[i], this.tareas[i - 1]];
    this.persistirOrden();
  }

  moverAbajo(i: number) {
    if (i >= this.tareas.length - 1) return;
    [this.tareas[i + 1], this.tareas[i]] = [this.tareas[i], this.tareas[i + 1]];
    this.persistirOrden();
  }

  // Guarda el campo 'orden' (índice) de cada tarea en Firestore
  private async persistirOrden() {
    try {
      await Promise.all(
        this.tareas.map((t, idx) =>
          t.id ? this.tareasService.update(t.id, { orden: idx } as any) : Promise.resolve()
        )
      );
      this.snackBar.open(this.t.instant('tasks.order_saved'), 'OK', { duration: 2000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }
}