import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '@core/services/auth.service';
import { Rol } from '@core/models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule
  ],
  template: `
    <div class="auth-wrapper">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-icon class="header-icon">person_add</mat-icon>
          <mat-card-title>Crear Cuenta</mat-card-title>
          <mat-card-subtitle>Registro para profesorado</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput formControlName="nombre">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Apellidos</mat-label>
                <input matInput formControlName="apellidos">
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Correo electrónico</mat-label>
              <input matInput formControlName="email" type="email">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contraseña</mat-label>
              <input matInput formControlName="password" type="password">
              <mat-hint>Mínimo 6 caracteres</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirmar contraseña</mat-label>
              <input matInput formControlName="confirmPassword" type="password">
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit"
                    class="full-width" [disabled]="loading || form.invalid">
              @if (loading) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Crear cuenta
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions align="end">
          <a mat-button routerLink="/login">¿Ya tienes cuenta? Inicia sesión</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 24px;
    }
    .auth-card { max-width: 500px; width: 100%; padding: 24px; border-radius: 16px; }
    .header-icon { font-size: 40px; width: 40px; height: 40px; color: #3f51b5; margin-bottom: 8px; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  loading = false;

  form: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  async onSubmit() {
    if (this.form.invalid) return;
    const { email, password, confirmPassword, ...userData } = this.form.value;
    if (password !== confirmPassword) {
      this.snackBar.open('Las contraseñas no coinciden', 'Cerrar', { duration: 3000 });
      return;
    }
    this.loading = true;
    try {
      await this.auth.register(email, password, { ...userData, rol: Rol.PROFESOR });
      this.snackBar.open('Cuenta creada correctamente', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e.message, 'Cerrar', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }
}
