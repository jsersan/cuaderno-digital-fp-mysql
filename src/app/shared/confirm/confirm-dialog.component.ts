import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' para acciones destructivas (eliminar), 'primary' para el resto */
  variant?: 'danger' | 'primary';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <div class="confirm-dialog" [class.danger]="data.variant === 'danger'">
      <div class="icon-circle">
        <mat-icon>{{ data.icon || (data.variant === 'danger' ? 'delete_outline' : 'help_outline') }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title || ('common.confirm' | translate) }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="close(false)">
          {{ data.cancelText || ('common.cancel' | translate) }}
        </button>
        <button mat-flat-button
                [color]="data.variant === 'danger' ? 'warn' : 'primary'"
                (click)="close(true)" cdkFocusInitial>
          {{ data.confirmText || ('common.confirm' | translate) }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog { padding: 8px 8px 0; text-align: center; max-width: 380px; }
    .icon-circle {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 8px auto 16px; background: #e3f2fd;
    }
    .icon-circle mat-icon {
      font-size: 34px; width: 34px; height: 34px; color: #1565c0;
    }
    .confirm-dialog.danger .icon-circle { background: #ffebee; }
    .confirm-dialog.danger .icon-circle mat-icon { color: #c62828; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
    mat-dialog-content p { color: #555; font-size: 15px; line-height: 1.5; margin: 0; }
    mat-dialog-actions { padding: 20px 0 8px; gap: 8px; }
    mat-dialog-actions button { min-width: 96px; }
  `]
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialogComponent>);

  close(result: boolean) { this.ref.close(result); }
}