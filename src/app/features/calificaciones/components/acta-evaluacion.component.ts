import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-acta-evaluacion',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <div class="page-header">
      <h2>{{ 'grades.record.title' | translate }}</h2>
      <button mat-button routerLink="/calificaciones"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
    </div>
    <mat-card class="info-card">
      <mat-icon>info</mat-icon>
      <p>{{ 'grades.record.info' | translate }}</p>
    </mat-card>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .info-card { padding: 32px; border-radius: 12px; display: flex; align-items: center; gap: 16px; }
    .info-card mat-icon { font-size: 36px; width: 36px; height: 36px; color: #1565c0; }
    .info-card a { color: #1565c0; }
  `]
})
export class ActaEvaluacionComponent {}