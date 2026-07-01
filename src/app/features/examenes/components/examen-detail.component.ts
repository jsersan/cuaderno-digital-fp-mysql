import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { ExamenesService } from '@core/services';
import { Examen } from '@core/models';

@Component({
  selector: 'app-examen-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatTableModule, MatDividerModule, TranslateModule],
  template: `
    @if (examen) {
      <div class="page-header">
        <div>
          <h2>{{ examen.titulo }}</h2>
          <div class="meta">
            <mat-chip>{{ examen.tipo | titlecase }}</mat-chip>
            <mat-chip>{{ examen.evaluacion }}</mat-chip>
            <span>{{ 'exams.points' | translate:{ pts: examen.puntuacionMaxima, min: examen.notaMinimaAprobado } }}</span>
          </div>
        </div>
        <div class="actions">
          <button mat-raised-button color="primary" [routerLink]="['/examenes', examen.id, 'calificar']">
            <mat-icon>grading</mat-icon> {{ 'exams.correct' | translate }}
          </button>
          <button mat-button routerLink="/examenes"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
        </div>
      </div>

      <div class="stats-grid">
        <mat-card class="stat"><strong>{{ stats.corregidos }}</strong><span>{{ 'exams.detail.graded' | translate }}</span></mat-card>
        <mat-card class="stat aprobado"><strong>{{ stats.aprobados }}</strong><span>{{ 'exams.detail.approved' | translate }}</span></mat-card>
        <mat-card class="stat suspenso"><strong>{{ stats.suspensos }}</strong><span>{{ 'exams.detail.failed' | translate }}</span></mat-card>
        <mat-card class="stat"><strong>{{ stats.notaMedia | number:'1.1-1' }}</strong><span>{{ 'common.average' | translate }}</span></mat-card>
        <mat-card class="stat"><strong>{{ stats.corregidos ? ((stats.aprobados / stats.corregidos) * 100 | number:'1.0-0') : 0 }}%</strong><span>{{ 'exams.detail.pct_approved' | translate }}</span></mat-card>
      </div>

      @if (examen.calificaciones.length) {
        <mat-card class="table-card">
          <h3>{{ 'exams.detail.grades' | translate }}</h3>
          <table mat-table [dataSource]="examen.calificaciones">
            <ng-container matColumnDef="alumno">
              <th mat-header-cell *matHeaderCellDef>{{ 'recovery.detail.student' | translate }}</th>
              <td mat-cell *matCellDef="let c">{{ c.alumnoNombre }}</td>
            </ng-container>
            <ng-container matColumnDef="nota">
              <th mat-header-cell *matHeaderCellDef>{{ 'common.grade' | translate }}</th>
              <td mat-cell *matCellDef="let c">
                @if (c.noPresente) { <span class="np">{{ 'exams.detail.not_present' | translate }}</span> }
                @else { <strong [class.aprobado]="(c.nota||0)>=examen.notaMinimaAprobado" [class.suspenso-text]="(c.nota||0)<examen.notaMinimaAprobado">{{ c.nota | number:'1.1-1' }}</strong> }
              </td>
            </ng-container>
            <ng-container matColumnDef="obs">
              <th mat-header-cell *matHeaderCellDef>{{ 'common.observations' | translate }}</th>
              <td mat-cell *matCellDef="let c">{{ c.observaciones || '' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="['alumno','nota','obs']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['alumno','nota','obs'];"></tr>
          </table>
        </mat-card>
      } @else {
        <mat-card class="empty"><mat-icon>grading</mat-icon><p>{{ 'exams.detail.no_grades' | translate }}</p></mat-card>
      }
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; }
    .meta { display: flex; align-items: center; gap: 8px; color: #666; margin-top: 8px; font-size: 14px; }
    .actions { display: flex; gap: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { text-align: center; padding: 16px; border-radius: 12px; }
    .stat strong { display: block; font-size: 28px; }
    .stat span { font-size: 12px; color: #666; }
    .stat.aprobado strong { color: #2e7d32; }
    .stat.suspenso strong { color: #c62828; }
    .table-card { padding: 24px; border-radius: 12px; }
    table { width: 100%; }
    .aprobado { color: #2e7d32; }
    .suspenso-text { color: #c62828; }
    .np { color: #999; font-style: italic; }
    .empty { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class ExamenDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private examenesService = inject(ExamenesService);
  examen: Examen | null = null;
  stats: any = { corregidos: 0, aprobados: 0, suspensos: 0, notaMedia: 0 };

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.examen = await this.examenesService.getById(id);
    if (this.examen) this.stats = this.examenesService.getEstadisticas(this.examen);
  }
}