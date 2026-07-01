import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { TareasService } from '@core/services';
import { Tarea, EstadoTarea } from '@core/models';

@Component({
  selector: 'app-tarea-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatListModule, MatDividerModule, TranslateModule],
  template: `
    @if (tarea) {
      <div class="page-header">
        <div>
          <h2>{{ tarea.titulo }}</h2>
          <div class="meta">
            <mat-chip>{{ tarea.evaluacion }}</mat-chip>
            <span>{{ 'tasks.delivery' | translate }}: {{ tarea.fechaEntrega.toDate() | date:'dd/MM/yyyy HH:mm' }}</span>
            <span>{{ tarea.puntuacionMaxima }} pts</span>
          </div>
        </div>
        <div class="actions">
          <button mat-raised-button color="primary" [routerLink]="['/tareas', tarea.id, 'corregir']">
            <mat-icon>rate_review</mat-icon> {{ 'tasks.correct' | translate }}
          </button>
          <button mat-button routerLink="/tareas"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
        </div>
      </div>

      <mat-card class="detail-card">
        <h3>{{ 'tasks.detail.description' | translate }}</h3>
        <p class="desc">{{ tarea.descripcion }}</p>
        <mat-divider></mat-divider>
        <div class="stats-row">
          <div class="stat"><strong>{{ stats.totalEntregas }}</strong><span>{{ 'tasks.detail.total_deliveries' | translate }}</span></div>
          <div class="stat"><strong>{{ stats.corregidas }}</strong><span>{{ 'tasks.detail.corrected' | translate }}</span></div>
          <div class="stat"><strong>{{ stats.pendientes }}</strong><span>{{ 'tasks.detail.pending' | translate }}</span></div>
          <div class="stat"><strong>{{ stats.noEntregadas }}</strong><span>{{ 'tasks.detail.not_delivered' | translate }}</span></div>
          <div class="stat"><strong>{{ stats.notaMedia | number:'1.1-1' }}</strong><span>{{ 'common.average' | translate }}</span></div>
        </div>
      </mat-card>

      <mat-card class="entregas-card">
        <h3>{{ 'tasks.detail.deliveries' | translate }}</h3>
        <mat-list>
          @for (e of tarea.entregas || []; track e.alumnoId) {
            <mat-list-item>
              <mat-icon matListItemIcon [class]="'estado-icon estado-' + e.estado">
                {{ e.estado === 'corregida' ? 'check_circle' : e.estado === 'entregada' ? 'schedule' : 'cancel' }}
              </mat-icon>
              <span matListItemTitle>{{ e.alumnoNombre || e.alumnoId }}</span>
              <span matListItemLine>
                {{ e.estado | titlecase }}
                @if (e.nota !== undefined) { · {{ 'common.grade' | translate }}: {{ e.nota }}/{{ tarea.puntuacionMaxima }} }
                @if (e.fechaEntrega) { · {{ e.fechaEntrega.toDate() | date:'dd/MM HH:mm' }} }
              </span>
            </mat-list-item>
          }
        </mat-list>
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; }
    .meta { display: flex; align-items: center; gap: 12px; color: #666; margin-top: 8px; font-size: 14px; }
    .actions { display: flex; gap: 8px; }
    .detail-card, .entregas-card { padding: 24px; border-radius: 12px; margin-bottom: 16px; }
    .desc { white-space: pre-wrap; line-height: 1.6; }
    .stats-row { display: flex; gap: 32px; padding-top: 16px; flex-wrap: wrap; }
    .stat { text-align: center; }
    .stat strong { display: block; font-size: 24px; }
    .stat span { font-size: 12px; color: #666; }
    .estado-icon.estado-corregida { color: #4caf50; }
    .estado-icon.estado-entregada { color: #ff9800; }
    .estado-icon.estado-no_entregada { color: #f44336; }
  `]
})
export class TareaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tareasService = inject(TareasService);
  tarea: Tarea | null = null;
  stats: any = {};

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.tarea = await this.tareasService.getById(id);
    if (this.tarea) this.stats = this.tareasService.getEstadisticas(this.tarea);
  }
}