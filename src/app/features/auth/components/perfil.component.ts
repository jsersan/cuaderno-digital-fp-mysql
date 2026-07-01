import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatButtonModule,
    MatIconModule, MatTabsModule, MatProgressSpinnerModule, MatSnackBarModule
  ],
  template: `
    <div class="perfil-container">
      <h2>Mi Perfil</h2>

      <mat-tab-group>
        <!-- Datos personales -->
        <mat-tab label="Datos Personales">
          <mat-card class="tab-card">

            <!-- Avatar / foto de perfil -->
            <div class="avatar-section">
              <div class="avatar-wrap">
                @if (procesando) {
                  <div class="avatar-spinner"><mat-spinner diameter="40"></mat-spinner></div>
                } @else if (fotoUrl) {
                  <img [src]="fotoUrl" alt="Foto de perfil" class="avatar-img">
                } @else {
                  <div class="avatar-placeholder"><mat-icon>person</mat-icon></div>
                }
              </div>
              <div class="avatar-actions">
                <input #fileInput type="file" accept="image/*" hidden (change)="onFotoSeleccionada($event)">
                <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="procesando">
                  <mat-icon>photo_camera</mat-icon> {{ fotoUrl ? 'Cambiar foto' : 'Subir foto' }}
                </button>
                @if (fotoUrl) {
                  <button mat-button color="warn" type="button" (click)="quitarFoto()" [disabled]="procesando">
                    <mat-icon>delete</mat-icon> Quitar
                  </button>
                }
              </div>
            </div>

            <form [formGroup]="perfilForm" (ngSubmit)="guardarPerfil()">
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
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" readonly>
              </mat-form-field>
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Teléfono</mat-label>
                  <input matInput formControlName="telefono">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Departamento</mat-label>
                  <input matInput formControlName="departamento">
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Especialidad</mat-label>
                <input matInput formControlName="especialidad">
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit">
                <mat-icon>save</mat-icon> Guardar cambios
              </button>
            </form>
          </mat-card>
        </mat-tab>

        <!-- Configuración -->
        <mat-tab label="Preferencias">
          <mat-card class="tab-card">
            <form [formGroup]="configForm" (ngSubmit)="guardarConfig()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Idioma</mat-label>
                <mat-select formControlName="idioma">
                  <mat-option value="es">Castellano</mat-option>
                  <mat-option value="eu">Euskera</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-slide-toggle formControlName="temaOscuro">
                Tema oscuro
              </mat-slide-toggle>
              <br><br>
              <mat-slide-toggle formControlName="notificacionesEmail">
                Notificaciones por email
              </mat-slide-toggle>
              <br><br>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Vista de calificaciones</mat-label>
                <mat-select formControlName="vistaCalificaciones">
                  <mat-option value="tabla">Tabla</mat-option>
                  <mat-option value="tarjetas">Tarjetas</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit">
                <mat-icon>save</mat-icon> Guardar preferencias
              </button>
            </form>
          </mat-card>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .perfil-container { max-width: 700px; }
    .tab-card { margin-top: 16px; padding: 24px; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .full-width { width: 100%; }

    .avatar-section {
      display: flex; align-items: center; gap: 20px;
      margin-bottom: 24px; padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .avatar-wrap {
      width: 88px; height: 88px; border-radius: 50%;
      overflow: hidden; flex: 0 0 88px;
      background: #e3f2fd; display: flex; align-items: center; justify-content: center;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder mat-icon { font-size: 48px; width: 48px; height: 48px; color: #90a4ae; }
    .avatar-spinner { display: flex; align-items: center; justify-content: center; }
    .avatar-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  `]
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  perfilForm!: FormGroup;
  configForm!: FormGroup;
  fotoUrl: string | null = null;
  procesando = false;

  ngOnInit(): void {
    const user = this.auth.currentUser;
    this.fotoUrl = (user as any)?.fotoUrl || null;

    this.perfilForm = this.fb.group({
      nombre: [user?.nombre || '', Validators.required],
      apellidos: [user?.apellidos || '', Validators.required],
      email: [user?.email || ''],
      telefono: [user?.telefono || ''],
      departamento: [user?.departamento || ''],
      especialidad: [user?.especialidad || '']
    });
    this.configForm = this.fb.group({
      idioma: [user?.configuracion?.idioma || 'es'],
      temaOscuro: [user?.configuracion?.temaOscuro || false],
      notificacionesEmail: [user?.configuracion?.notificacionesEmail || true],
      vistaCalificaciones: [user?.configuracion?.vistaCalificaciones || 'tabla']
    });

    this.applyDarkTheme(user?.configuracion?.temaOscuro || false);
    this.configForm.get('temaOscuro')?.valueChanges.subscribe(dark => {
      this.applyDarkTheme(dark);
    });
  }

  async onFotoSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('El archivo debe ser una imagen', 'Cerrar', { duration: 4000 });
      input.value = '';
      return;
    }

    this.procesando = true;
    try {
      // Redimensionar y comprimir la imagen a un data URL pequeño (cabe en Firestore)
      const dataUrl = await this.redimensionarImagen(file, 200, 0.8);

      // Guardar el data URL como fotoUrl en el documento del usuario (Firestore, sin Storage)
      await this.auth.updateUserProfile({ fotoUrl: dataUrl } as any);
      this.fotoUrl = dataUrl;
      this.snackBar.open('Foto de perfil actualizada', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e?.message || 'Error al procesar la foto', 'Cerrar', { duration: 5000 });
    } finally {
      this.procesando = false;
      input.value = ''; // permite volver a elegir el mismo archivo
    }
  }

  /**
   * Lee un archivo de imagen, lo escala a un cuadrado de `tamMax` px (recortando
   * al centro para mantener proporción) y devuelve un data URL JPEG comprimido.
   * Esto mantiene el tamaño muy por debajo del límite de 1 MB por documento de Firestore.
   */
  private redimensionarImagen(file: File, tamMax: number, calidad: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = tamMax;
          canvas.height = tamMax;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo crear el lienzo')); return; }

          // Recorte cuadrado centrado (cover)
          const lado = Math.min(img.width, img.height);
          const sx = (img.width - lado) / 2;
          const sy = (img.height - lado) / 2;
          ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tamMax, tamMax);

          const dataUrl = canvas.toDataURL('image/jpeg', calidad);
          resolve(dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async quitarFoto(): Promise<void> {
    this.procesando = true;
    try {
      await this.auth.updateUserProfile({ fotoUrl: '' } as any);
      this.fotoUrl = null;
      this.snackBar.open('Foto eliminada', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e?.message || 'Error al quitar la foto', 'Cerrar', { duration: 5000 });
    } finally {
      this.procesando = false;
    }
  }

  async guardarPerfil() {
    if (this.perfilForm.invalid) return;
    try {
      await this.auth.updateUserProfile(this.perfilForm.value);
      this.snackBar.open('Perfil actualizado', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e.message, 'Cerrar', { duration: 5000 });
    }
  }

  async guardarConfig() {
    try {
      const config = this.configForm.value;
      await this.auth.updateConfiguracion(config);
      this.applyDarkTheme(config.temaOscuro);
      this.snackBar.open('Preferencias guardadas', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e.message, 'Cerrar', { duration: 5000 });
    }
  }

  private applyDarkTheme(dark: boolean) {
    if (dark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}