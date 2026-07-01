import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
    TranslateModule
  ],
  template: `
    <div class="login-wrapper">
      <!-- Selector de idioma estilo ES | EU -->
      <div class="lang-switch" style="position:fixed; top:20px; right:24px; z-index:1000; display:flex; align-items:center; gap:8px;">
        <button type="button" class="lang-link" [class.active]="currentLang==='es'" (click)="cambiarIdioma('es')">ES</button>
        <span class="lang-sep">|</span>
        <button type="button" class="lang-link" [class.active]="currentLang==='eu'" (click)="cambiarIdioma('eu')">EU</button>
      </div>

      <div class="login-branding">
        <mat-icon class="brand-icon">school</mat-icon>
        <h1>Cuaderno Digital FP</h1>
        <p>{{ 'login.tagline' | translate }}</p>
      </div>

      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>{{ 'login.title' | translate }}</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'login.email' | translate }}</mat-label>
              <input matInput formControlName="email" type="email" autocomplete="email">
              <mat-icon matPrefix>email</mat-icon>
              @if (loginForm.get('email')?.hasError('required') && loginForm.get('email')?.touched) {
                <mat-error>{{ 'login.email_required' | translate }}</mat-error>
              }
              @if (loginForm.get('email')?.hasError('email')) {
                <mat-error>{{ 'login.email_invalid' | translate }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'login.password' | translate }}</mat-label>
              <input matInput formControlName="password"
                     [type]="hidePassword ? 'password' : 'text'"
                     autocomplete="current-password">
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="hidePassword = !hidePassword">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
                <mat-error>{{ 'login.password_required' | translate }}</mat-error>
              }
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit"
                    class="full-width login-btn"
                    [disabled]="loading || loginForm.invalid">
              @if (loading) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                {{ 'login.submit' | translate }}
              }
            </button>
          </form>

          <div class="divider"><span>{{ 'login.or' | translate }}</span></div>

          <button mat-stroked-button class="full-width google-btn"
                  type="button" (click)="onGoogle()" [disabled]="loading">
            <img class="google-logo" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
            {{ 'login.google' | translate }}
          </button>
        </mat-card-content>

        <mat-card-actions>
          <a mat-button routerLink="/recuperar-password" color="accent">
            {{ 'login.forgot' | translate }}
          </a>
          <a mat-button routerLink="/registro" color="primary">
            {{ 'login.create_account' | translate }}
          </a>
        </mat-card-actions>
      </mat-card>

      <p class="footer-text">
        © {{ currentYear }} Cuaderno Digital FP · Euskadi
      </p>
    </div>
  `,
  styles: [`
    .login-wrapper {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      /* Degradado en la familia de azules del logotipo (sin foto: no se deforma) */
      background: linear-gradient(135deg, rgba(232,244,251,0.35) 0%, rgba(191,224,242,0.3) 40%, rgba(111,184,222,0.25) 100%),
            url('/assets/img/fondo.jpg') center/cover no-repeat fixed;
    }
    .login-wrapper > * { position: relative; z-index: 1; }

    .lang-switch {
      position: fixed;
      top: 20px; right: 24px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lang-link {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      color: #0d3a5c;
      opacity: 0.6;
      padding: 2px 4px;
      letter-spacing: 0.5px;
    }
    .lang-link:hover { opacity: 0.85; }
    .lang-link.active {
      opacity: 1;
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    .lang-sep { color: #0d3a5c; opacity: 0.4; }

    .login-branding {
      text-align: center;
      margin-bottom: 28px;
      color: #0d3a5c;
    }
    .brand-icon {
      font-size: 64px; width: 64px; height: 64px;
      color: #0277bd;
    }
    .login-branding h1 { font-size: 28px; font-weight: 700; margin: 12px 0 4px; }
    .login-branding p { opacity: 0.8; font-size: 14px; }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 20px 24px 28px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      box-shadow: 0 14px 44px rgba(0, 30, 60, 0.22);
    }
    .login-card ::ng-deep .mat-mdc-card-header { padding: 0; }
    .login-card ::ng-deep .mat-mdc-card-title { margin: 0 0 16px; font-size: 22px; }
    .login-card ::ng-deep .mat-mdc-card-content { padding: 0; }

    .full-width { width: 100%; }
    .login-btn { height: 48px; font-size: 16px; margin-top: 8px; }

    .divider {
      display: flex; align-items: center;
      text-align: center; margin: 18px 0 14px;
      color: #888; font-size: 13px;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; border-bottom: 1px solid #d0d0d0;
    }
    .divider span { padding: 0 12px; }

    .google-btn {
      height: 46px; font-size: 15px; font-weight: 500;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: #fff;
    }
    .google-logo { width: 20px; height: 20px; }

    mat-card-actions {
      display: flex; justify-content: space-between; padding: 8px 0 0;
    }

    .footer-text {
      color: #0d3a5c;
      opacity: 0.6;
      margin-top: 24px;
      font-size: 12px;
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  hidePassword = true;
  loading = false;
  currentYear = new Date().getFullYear();
  currentLang = this.translate.currentLang || 'es';

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  cambiarIdioma(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.loading = true;
    try {
      const { email, password } = this.loginForm.value;
      await this.authService.login(email, password);
    } catch (error: any) {
      this.snackBar.open(error.message, 'Cerrar', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }

  async onGoogle(): Promise<void> {
    this.loading = true;
    try {
      await this.authService.loginConGoogle();
    } catch (error: any) {
      this.snackBar.open(error.message, 'Cerrar', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }
}