import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  /**
   * Abre el diálogo de confirmación y resuelve a true si el usuario confirma.
   * Uso: if (await this.confirm.ask({ message: '...', variant: 'danger' })) { ... }
   */
  async ask(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '420px',
      panelClass: 'confirm-dialog-panel',
      autoFocus: false,
      restoreFocus: true
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}