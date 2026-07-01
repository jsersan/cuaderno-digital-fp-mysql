// ============= RECUPERACIONES LIST =============
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RecuperacionesService, AuthService, ActiveModuleService } from '@core/services';
import { Recuperacion } from '@core/models';
import { ConfirmService } from '../../../shared/confirm/confirm.service';

@Component({
  selector: 'app-recuperaciones-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatMenuModule, MatSnackBarModule, TranslateModule],
  template: `
    <div class="page-header">
      <div><h2>{{ 'recovery.title' | translate }}</h2><p class="subtitle">{{ 'recovery.subtitle' | translate }}</p></div>
      <button mat-raised-button color="primary" routerLink="/recuperaciones/nueva">
        <mat-icon>add</mat-icon> {{ 'recovery.new' | translate }}
      </button>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module"><mat-icon>menu_book</mat-icon> {{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a></mat-card>
    }

    <div class="recup-grid">
      @for (rec of recuperaciones; track rec.id) {
        <mat-card class="recup-card">
          <div class="recup-header">
            <h3>{{ rec.titulo }}</h3>
            <button mat-icon-button [matMenuTriggerFor]="m"><mat-icon>more_vert</mat-icon></button>
            <mat-menu #m="matMenu">
              <button mat-menu-item [routerLink]="['/recuperaciones', rec.id]"><mat-icon>visibility</mat-icon> {{ 'common.view_detail' | translate }}</button>
              <button mat-menu-item [routerLink]="['/recuperaciones', rec.id, 'editar']"><mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}</button>
              <button mat-menu-item (click)="eliminarRecuperacion(rec)"><mat-icon color="warn">delete</mat-icon> {{ 'common.delete' | translate }}</button>
            </mat-menu>
          </div>
          <div class="recup-meta">
            <mat-chip>{{ rec.evaluacion }}</mat-chip>
            <mat-chip>{{ rec.tipoRecuperacion | titlecase }}</mat-chip>
            <span class="fecha"><mat-icon>event</mat-icon>{{ rec.fecha.toDate() | date:'dd/MM/yyyy' }}</span>
          </div>
          <div class="recup-stats">
            <span><strong>{{ rec.alumnosConvocados.length || 0 }}</strong> {{ 'recovery.summoned' | translate }}</span>
            <span class="aprobados"><strong>{{ getAprobados(rec) }}</strong> {{ 'recovery.approved' | translate }}</span>
            <span class="suspensos"><strong>{{ getSuspensos(rec) }}</strong> {{ 'recovery.failed' | translate }}</span>
          </div>
          <div class="recup-nota">
            {{ 'recovery.max_grade' | translate }}: <strong>{{ rec.notaMaximaRecuperacion }}</strong>
          </div>
        </mat-card>
      }
      @if (recuperaciones.length === 0) {
        <mat-card class="empty-card"><mat-icon>refresh</mat-icon><p>{{ 'recovery.empty' | translate }}</p></mat-card>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .no-module { display: flex; align-items: center; gap: 8px; padding: 16px; border-radius: 12px; color: #777; margin-bottom: 16px; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .recup-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
    .recup-card { padding: 20px; border-radius: 12px; border-left: 4px solid #ff9800; }
    .recup-header { display: flex; justify-content: space-between; }
    .recup-header h3 { margin: 0 0 8px; }
    .recup-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .fecha { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #666; }
    .fecha mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .recup-stats { display: flex; gap: 16px; font-size: 14px; }
    .recup-stats .aprobados strong { color: #2e7d32; }
    .recup-stats .suspensos strong { color: #c62828; }
    .recup-nota { margin-top: 8px; font-size: 13px; color: #666; padding-top: 8px; border-top: 1px solid #eee; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class RecuperacionesListComponent implements OnInit {
  private recService = inject(RecuperacionesService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private confirm = inject(ConfirmService);
  activeModule = inject(ActiveModuleService);
  recuperaciones: Recuperacion[] = [];

  async ngOnInit() {
    // Rehidratar el cuaderno activo tras recargar la página (igual que Exámenes/Tareas)
    await this.activeModule.restore();

    const modId = this.activeModule.moduloId;
    const grpId = this.activeModule.grupoId;

    // Sin cuaderno activo (módulo + grupo) no se muestra ninguna recuperación.
    // Así, en módulos sin recuperaciones (p. ej. Proyecto), la lista sale vacía.
    if (!modId || !grpId) {
      this.recuperaciones = [];
      return;
    }

    this.recService.getByModuloYGrupo$(modId, grpId)
      .subscribe(r => this.recuperaciones = r);
  }

  getAprobados(r: Recuperacion) { return (r.alumnosConvocados || []).filter(a => a.estado === 'aprobado').length; }
  getSuspensos(r: Recuperacion) { return (r.alumnosConvocados || []).filter(a => a.estado === 'suspenso').length; }

  async eliminarRecuperacion(rec: Recuperacion) {
    if (!rec.id) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('common.delete'),
      message: this.t.instant('recovery.confirm_delete', { titulo: rec.titulo }),
      confirmText: this.t.instant('common.delete'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await this.recService.delete(rec.id);
      this.recuperaciones = this.recuperaciones.filter(r => r.id !== rec.id);
      this.snackBar.open(this.t.instant('recovery.deleted'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }
}