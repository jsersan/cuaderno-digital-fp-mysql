import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="auth-wrapper">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-icon class="header-icon">lock_reset</mat-icon>
          <mat-card-title>Recuperar Contraseña</mat-card-title>
          <mat-card-subtitle>Te enviaremos un email para restablecer tu contraseña</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (!emailSent) {
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Correo electrónico</mat-label>
                <input matInput formControlName="email" type="email">
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit"
                      class="full-width" [disabled]="form.invalid">
                Enviar enlace
              </button>
            </form>
          } @else {
            <div class="success-message">
              <mat-icon>check_circle</mat-icon>
              <p>Se ha enviado un email a <strong>{{ form.value.email }}</strong> con las instrucciones.</p>
            </div>
          }
        </mat-card-content>
        <mat-card-actions>
          <a mat-button routerLink="/login">Volver al login</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 24px; }
    .auth-card { max-width: 420px; width: 100%; padding: 24px; border-radius: 16px; }
    .header-icon { font-size: 40px; width: 40px; height: 40px; color: #3f51b5; }
    .full-width { width: 100%; }
    .success-message { text-align: center; padding: 24px; }
    .success-message mat-icon { font-size: 48px; width: 48px; height: 48px; color: #4caf50; }
  `]
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  emailSent = false;

  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });

  async onSubmit() {
    try {
      await this.auth.resetPassword(this.form.value.email!);
      this.emailSent = true;
    } catch (e: any) {
      this.snackBar.open(e.message, 'Cerrar', { duration: 5000 });
    }
  }
}
