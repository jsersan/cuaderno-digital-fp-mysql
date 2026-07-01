import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  Firestore, collection, collectionData, query, where, doc, setDoc, updateDoc, deleteDoc
} from '@core/firebase-shim';
import { AuthService, ActiveModuleService, ModulosService } from '@core/services';
import { Usuario, Rol, ConfiguracionUsuario, ModuloProfesional } from '@core/models';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { buildUrl } from '@core/firebase-shim';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-profesores-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatSnackBarModule, MatDividerModule, MatMenuModule, MatTooltipModule, MatCheckboxModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div><h2>{{ 'teachers.title' | translate }}</h2><p class="subtitle">{{ 'teachers.subtitle' | translate }}</p></div>
      <button mat-raised-button (click)="fileInput.click()" class="import-btn">
        <mat-icon>upload_file</mat-icon> {{ 'teachers.import_excel' | translate }}
      </button>
      <input #fileInput type="file" hidden accept=".xlsx,.xls,.csv" (change)="onFileSelected($event)">
      <button mat-raised-button color="primary" (click)="showForm = !showForm">
        <mat-icon>{{ showForm ? 'close' : 'person_add' }}</mat-icon>
        {{ showForm ? ('common.cancel' | translate) : ('teachers.new' | translate) }}
      </button>
    </div>

    <!-- Previsualización de importación -->
    @if (importPreview.length > 0) {
      <mat-card class="import-card">
        <div class="import-header">
          <h3><mat-icon>upload_file</mat-icon> Previsualización ({{ importPreview.length }} profesores)</h3>
          <div>
            <button mat-button (click)="cancelImport()">Cancelar</button>
            <button mat-raised-button color="primary" (click)="confirmarImport()" [disabled]="importing">
              <mat-icon>check</mat-icon> {{ importing ? 'Importando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
        <table mat-table [dataSource]="importPreview">
          <ng-container matColumnDef="nombre"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let r">{{ r.nombre }}</td></ng-container>
          <ng-container matColumnDef="apellidos"><th mat-header-cell *matHeaderCellDef>Apellidos</th><td mat-cell *matCellDef="let r">{{ r.apellidos }}</td></ng-container>
          <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_email' | translate }}</th><td mat-cell *matCellDef="let r">{{ r.email }}</td></ng-container>
          <ng-container matColumnDef="rol"><th mat-header-cell *matHeaderCellDef>Rol</th><td mat-cell *matCellDef="let r">{{ r.rol }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="['nombre','apellidos','email','rol']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['nombre','apellidos','email','rol'];" [class.error-row]="row._error"></tr>
        </table>
        <p class="import-hint"><mat-icon>info</mat-icon> Columnas: <strong>nombre, apellidos, email, password</strong> (obligatorias), rol, departamento, especialidad (opcionales)</p>
      </mat-card>
    }

    <!-- Formulario nuevo profesor -->
    @if (showForm) {
      <mat-card class="form-card">
        <h3><mat-icon>person_add</mat-icon> Registrar nuevo profesor/a</h3>
        <form [formGroup]="profForm" (ngSubmit)="crearProfesor()">
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
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Contraseña temporal</mat-label>
              <input matInput formControlName="password" type="text">
              <mat-hint>Mín. 6 caracteres. El profesor deberá cambiarla</mat-hint>
            </mat-form-field>
          </div>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Rol</mat-label>
              <mat-select formControlName="rol">
                <mat-option value="profesor">Profesor</mat-option>
                <mat-option value="tutor">Tutor</mat-option>
                <mat-option value="jefe_estudios">Jefe de estudios</mat-option>
                <mat-option value="admin">Administrador</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Departamento</mat-label>
              <input matInput formControlName="departamento">
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Especialidad</mat-label>
            <input matInput formControlName="especialidad" placeholder="Ej: Informática y Comunicaciones">
          </mat-form-field>

          <div class="form-actions">
            <button mat-button type="button" (click)="showForm = false">Cancelar</button>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="profForm.invalid || saving">
              <mat-icon>save</mat-icon>
              {{ saving ? 'Creando...' : 'Crear profesor/a' }}
            </button>
          </div>
        </form>
      </mat-card>
    }

    <!-- Búsqueda -->
    <mat-card class="filters-card">
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>{{ 'teachers.search_placeholder' | translate }}</mat-label>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="filter()" [placeholder]="'teachers.search_placeholder' | translate">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
    </mat-card>

    <!-- Tabla -->
    <mat-card class="table-card">
      <table mat-table [dataSource]="filteredProfesores">
        <ng-container matColumnDef="nombre">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_name' | translate }}</th>
          <td mat-cell *matCellDef="let p">
            <div class="prof-name">
              <div class="avatar">{{ getInitials(p) }}</div>
              <div>
                <strong>{{ p.nombre }} {{ p.apellidos }}</strong>
                <span class="dept">{{ p.departamento || '' }}</span>
              </div>
            </div>
          </td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_email' | translate }}</th>
          <td mat-cell *matCellDef="let p">{{ p.email }}</td>
        </ng-container>
        <ng-container matColumnDef="rol">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_role' | translate }}</th>
          <td mat-cell *matCellDef="let p">
            <mat-chip [class]="'rol-' + rolEnGrupo(p)">{{ (rolEnGrupo(p) === 'tutor' ? 'teachers.role_tutor' : 'teachers.role_teacher') | translate }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="modulos">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_modules' | translate }}</th>
          <td mat-cell *matCellDef="let p">
            @if (p.uid && modulosPorProfesor[p.uid] && modulosPorProfesor[p.uid].length) {
              <span class="mods-cell">
                @for (ab of modulosPorProfesor[p.uid]; track ab) {
                  <mat-chip class="mod-chip">{{ ab }}</mat-chip>
                }
              </span>
            } @else {
              <span class="sin-mod">—</span>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="estado">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_status' | translate }}</th>
          <td mat-cell *matCellDef="let p">
            <span class="badge" [class]="p.activo ? 'activo' : 'inactivo'">
              {{ (p.activo ? 'teachers.status_active' : 'teachers.status_inactive') | translate }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="acciones">
          <th mat-header-cell *matHeaderCellDef>{{ 'teachers.col_actions' | translate }}</th>
          <td mat-cell *matCellDef="let p">
            <button mat-icon-button [matMenuTriggerFor]="rolMenu" [matTooltip]="'teachers.role_in_group' | translate">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #rolMenu="matMenu">
              <div class="menu-title">{{ 'teachers.role_in_group' | translate }}</div>
              <button mat-menu-item (click)="marcarProfesor(p)" [disabled]="rolEnGrupo(p) === 'profesor'">
                <mat-icon>school</mat-icon><span>{{ 'teachers.role_teacher' | translate }}</span>
                @if (rolEnGrupo(p) === 'profesor') { <mat-icon class="check">check</mat-icon> }
              </button>
              <button mat-menu-item (click)="marcarTutor(p)" [disabled]="rolEnGrupo(p) === 'tutor'">
                <mat-icon>supervisor_account</mat-icon><span>{{ 'teachers.tutor_of_group' | translate }}</span>
                @if (rolEnGrupo(p) === 'tutor') { <mat-icon class="check">check</mat-icon> }
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="gestionarModulos(p)">
                <mat-icon>library_books</mat-icon><span>{{ 'teachers.manage_modules' | translate }}</span>
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item class="danger-item" (click)="eliminarProfesor(p)" [disabled]="esYoMismo(p)"
                      [matTooltip]="esYoMismo(p) ? ('teachers.cannot_delete_self' | translate) : ''">
                <mat-icon color="warn">delete</mat-icon><span>{{ 'teachers.delete' | translate }}</span>
              </button>
            </mat-menu>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="['nombre','email','rol','modulos','estado','acciones']"></tr>
        <tr mat-row *matRowDef="let row; columns: ['nombre','email','rol','modulos','estado','acciones'];"></tr>
      </table>

      @if (filteredProfesores.length === 0) {
        <div class="empty-state"><mat-icon>people</mat-icon><p>No se encontraron profesores</p></div>
      }
    </mat-card>

    <!-- Modal gestionar módulos -->
    @if (editandoModulosProf) {
      <div class="modal-overlay" (click)="editandoModulosProf = null">
        <mat-card class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3><mat-icon>library_books</mat-icon> Módulos de {{ editandoModulosProf.nombre }} {{ editandoModulosProf.apellidos }}</h3>
            <button mat-icon-button (click)="editandoModulosProf = null"><mat-icon>close</mat-icon></button>
          </div>
          <p class="modal-hint">Marca los módulos que imparte en este grupo:</p>
          <div class="mod-list">
            @for (m of modulosCiclo; track m.id) {
              <label class="mod-row" [class.active]="profImparteModulo(editandoModulosProf!, m)">
                <mat-checkbox
                  [checked]="profImparteModulo(editandoModulosProf!, m)"
                  (change)="toggleModulo(editandoModulosProf!, m)"
                  color="primary">
                </mat-checkbox>
                <span class="mod-info">
                  <strong>{{ m.abreviatura }}</strong>
                  <span>{{ m.nombre }}</span>
                </span>
              </label>
            }
          </div>
          <div class="modal-actions">
            <button mat-raised-button color="primary" (click)="editandoModulosProf = null">
              <mat-icon>check</mat-icon> Hecho
            </button>
          </div>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .import-btn { background: #fff3e0 !important; color: #e65100 !important; }
    .import-card { margin-bottom: 16px; padding: 20px; border-radius: 12px; border-left: 4px solid #ff9800; }
    .import-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .import-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; color: #e65100; }
    .import-hint { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #888; margin: 12px 0 0; }
    .import-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .error-row { background: #fff8e1; }
    .form-card { margin-bottom: 16px; padding: 24px; border-radius: 12px; border-left: 4px solid #1565c0; }
    .form-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; color: #1565c0; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; padding-top: 16px; border-top: 1px solid #eee; }
    .filters-card { margin-bottom: 16px; padding: 16px; border-radius: 12px; }
    .search-field { width: 100%; max-width: 400px; }
    .table-card { border-radius: 12px; overflow: hidden; }
    table { width: 100%; }
    .prof-name { display: flex; align-items: center; gap: 12px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #1565c0; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .dept { display: block; font-size: 12px; color: #999; }
    .rol-admin { background: #e8eaf6 !important; color: #283593 !important; }
    .rol-profesor { background: #e3f2fd !important; color: #1565c0 !important; }
    .rol-tutor { background: #fff3e0 !important; color: #e65100 !important; }
    .badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .activo { background: #e8f5e9; color: #2e7d32; }
    .inactivo { background: #f5f5f5; color: #999; }
    .empty-state { text-align: center; padding: 48px; color: #999; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .mods-cell { display: flex; flex-wrap: wrap; gap: 4px; }
    .mod-chip { font-size: 11px !important; min-height: 22px !important; background: #ede7f6 !important; color: #4527a0 !important; font-weight: 600; }
    .sin-mod { color: #ccc; }
    .menu-title { padding: 8px 16px; font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; }
    .check { color: #2e7d32; margin-left: auto; }
    .danger-item span { color: #c62828; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal-content { width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; padding: 24px !important; border-radius: 16px !important; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .modal-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; color: #4527a0; font-size: 18px; }
    .modal-hint { color: #666; font-size: 13px; margin: 0 0 16px; }
    .mod-list { display: flex; flex-direction: column; gap: 4px; }
    .mod-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; border: 1px solid #eee; }
    .mod-row:hover { background: #f5f5f5; }
    .mod-row.active { background: #ede7f6; border-color: #b39ddb; }
    .mod-info { display: flex; flex-direction: column; }
    .mod-info strong { font-size: 14px; color: #4527a0; }
    .mod-info span { font-size: 12px; color: #666; }
    .modal-actions { display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; }
    @media (max-width: 600px) { .form-row { flex-direction: column; gap: 0; } }
  `]
})
export class ProfesoresListComponent implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private activeModule = inject(ActiveModuleService);
  private modulosService = inject(ModulosService);
  private confirm = inject(ConfirmService);
  private t = inject(TranslateService);

  profesores: Usuario[] = [];
  filteredProfesores: Usuario[] = [];
  modulosPorProfesor: { [profesorId: string]: string[] } = {};
  modulosCiclo: any[] = [];
  editandoModulosProf: Usuario | null = null;
  searchTerm = '';
  showForm = false;
  saving = false;
  profForm!: FormGroup;
  importPreview: any[] = [];
  importing = false;

  async ngOnInit() {
    this.profForm = this.fb.group({
      nombre: ['', Validators.required],
      apellidos: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rol: ['profesor', Validators.required],
      departamento: [''],
      especialidad: ['']
    });

    const user = this.auth.currentUser;
    if (!user) return;

    // Cargar los módulos del ciclo del grupo activo y construir el mapa
    // profesorId -> [abreviaturas de módulos que imparte en este grupo]
    await this.cargarModulosDelGrupo();

    const ref = collection(this.firestore, 'usuarios');
    const q = query(ref, where('centroId', '==', user.centroId));
    (collectionData(q, { idField: 'uid' }) as Observable<Usuario[]>).subscribe(p => {
      this.profesores = p;
      this.filter();
    });
  }

  /** Carga los módulos del ciclo del grupo activo y mapea profesor -> módulos. */
  private async cargarModulosDelGrupo() {
    this.modulosPorProfesor = {};
    this.modulosCiclo = [];
    const grupo = this.activeModule.currentGrupo;
    if (!grupo?.cicloId) return;
    let modulos: ModuloProfesional[] = [];
    try {
      modulos = await this.modulosService.queryByField('cicloId', grupo.cicloId);
    } catch { return; }
    this.modulosCiclo = modulos;
    this.recalcularModulosPorProfesor();
  }

  /** Reconstruye el mapa profesorId → [abreviaturas] a partir de modulosCiclo. */
  private recalcularModulosPorProfesor() {
    this.modulosPorProfesor = {};
    for (const m of this.modulosCiclo) {
      const ids: string[] = (m as any).profesoresIds?.length
        ? (m as any).profesoresIds
        : ((m as any).profesorId ? [(m as any).profesorId] : []);
      for (const pid of ids) {
        (this.modulosPorProfesor[pid] ||= []).push(m.abreviatura || '¿?');
      }
    }
  }

  filter() {
    const term = this.searchTerm.toLowerCase();
    let base = [...this.profesores];

    // Si hay un grupo activo, mostrar solo los profesores que imparten algún
    // módulo de ese grupo, más el tutor del grupo (si está marcado).
    const grupo = this.activeModule.currentGrupo as any;
    const hayGrupo = !!grupo?.cicloId && Object.keys(this.modulosPorProfesor).length > 0;
    if (hayGrupo) {
      base = base.filter(p =>
        (p.uid && this.modulosPorProfesor[p.uid] && this.modulosPorProfesor[p.uid].length) ||
        (grupo.tutorId && p.uid === grupo.tutorId)
      );
    }

    this.filteredProfesores = term
      ? base.filter(p => `${p.nombre} ${p.apellidos} ${p.email}`.toLowerCase().includes(term))
      : base;
  }

  getInitials(p: Usuario): string {
    return ((p.nombre?.[0] || '') + (p.apellidos?.[0] || '')).toUpperCase();
  }

  /** Rol del profesor EN ESTE GRUPO: 'tutor' si es el tutorId del grupo, si no 'profesor'. */
  rolEnGrupo(p: Usuario): string {
    const grupo = this.activeModule.currentGrupo as any;
    if (grupo?.tutorId && p.uid === grupo.tutorId) return 'tutor';
    return 'profesor';
  }

  /** True si el profesor de la fila es el usuario que ha iniciado sesión. */
  esYoMismo(p: Usuario): boolean {
    return !!p.uid && p.uid === this.auth.currentUser?.uid;
  }

  /** Abre el modal para gestionar los módulos que imparte este profesor. */
  gestionarModulos(p: Usuario) {
    this.editandoModulosProf = p;
  }

  /** Comprueba si un profesor imparte un módulo (usa profesoresIds con fallback a profesorId). */
  profImparteModulo(p: Usuario, m: any): boolean {
    if (m.profesoresIds?.length) {
      return m.profesoresIds.includes(p.uid);
    }
    return m.profesorId === p.uid;
  }

  /** Añade o quita un profesor de un módulo (actualiza profesoresIds en Firestore). */
  async toggleModulo(p: Usuario, m: any) {
    if (!p.uid || !m.id) return;
    // Construir el array actual
    let ids: string[] = [...(m.profesoresIds || [])];
    // Fallback: si profesoresIds vacío pero profesorId existe, inicializar desde él
    if (!ids.length && m.profesorId) {
      ids = [m.profesorId];
    }

    const idx = ids.indexOf(p.uid);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(p.uid);
    }

    try {
      const modRef = doc(this.firestore, `modulos/${m.id}`);
      await updateDoc(modRef, {
        profesoresIds: ids,
        profesorId: ids[0] || '',   // mantener profesorId sincronizado (compatibilidad)
        updatedAt: new Date()
      });

      // Actualizar estado local
      m.profesoresIds = ids;
      m.profesorId = ids[0] || '';

      // Recalcular mapa y refrescar tabla
      this.recalcularModulosPorProfesor();
      this.filter();

      this.snackBar.open(
        idx >= 0
          ? `${p.nombre} ya no imparte ${m.abreviatura}`
          : `${p.nombre} ahora co-imparte ${m.abreviatura}`,
        'OK', { duration: 3000 }
      );
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  /** Elimina el documento del profesor en Firestore, con confirmación elegante. */
  async eliminarProfesor(p: Usuario) {
    if (!p.uid) return;
    if (this.esYoMismo(p)) {
      this.snackBar.open(this.t.instant('teachers.cannot_delete_self_msg'), 'OK', { duration: 4000 });
      return;
    }

    // Si es tutor del grupo activo, avisamos de que perderá la tutoría
    const grupo = this.activeModule.currentGrupo as any;
    const esTutorDelGrupo = grupo?.tutorId && p.uid === grupo.tutorId;

    const ok = await this.confirm.ask({
      title: this.t.instant('teachers.delete'),
      message: this.t.instant('teachers.confirm_delete', { nombre: `${p.nombre} ${p.apellidos}` })
        + (esTutorDelGrupo ? this.t.instant('teachers.confirm_delete_tutor', { grupo: grupo.nombre }) : '')
        + this.t.instant('teachers.confirm_delete_undo'),
      confirmText: this.t.instant('teachers.delete'),
      variant: 'danger'
    });
    if (!ok) return;

    try {
      // Si era el tutor del grupo, liberar la tutoría antes de borrar
      if (esTutorDelGrupo) {
        const gRef = doc(this.firestore, `grupos/${grupo.id}`);
        await updateDoc(gRef, { tutorId: '', updatedAt: new Date() });
        this.activeModule.setGrupo({ ...grupo, tutorId: '' });
      }
      await deleteDoc(doc(this.firestore, `usuarios/${p.uid}`));
      // La tabla se actualiza sola por el collectionData en tiempo real,
      // pero refrescamos el filtro por si acaso.
      this.profesores = this.profesores.filter(x => x.uid !== p.uid);
      this.filter();
      this.snackBar.open(this.t.instant('teachers.deleted'), 'OK', { duration: 4000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  /** Quita a este profesor como tutor del grupo (pasa a Profesor). */
  async marcarProfesor(p: Usuario) {
    const grupo = this.activeModule.currentGrupo as any;
    if (!grupo?.id) { this.snackBar.open('No hay grupo activo.', 'OK', { duration: 3000 }); return; }
    if (grupo.tutorId !== p.uid) return; // ya es profesor
    try {
      const ref = doc(this.firestore, `grupos/${grupo.id}`);
      await updateDoc(ref, { tutorId: '', updatedAt: new Date() });
      this.activeModule.setGrupo({ ...grupo, tutorId: '' });
      this.snackBar.open(`${p.nombre} ya no es tutor del grupo.`, 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  /** Marca a este profesor como tutor del grupo (sustituye al anterior). */
  async marcarTutor(p: Usuario) {
    const grupo = this.activeModule.currentGrupo as any;
    if (!grupo?.id) { this.snackBar.open('No hay grupo activo.', 'OK', { duration: 3000 }); return; }
    if (!p.uid) return;
    try {
      const ref = doc(this.firestore, `grupos/${grupo.id}`);
      await updateDoc(ref, { tutorId: p.uid, updatedAt: new Date() });
      this.activeModule.setGrupo({ ...grupo, tutorId: p.uid });
      this.snackBar.open(`${p.nombre} ${p.apellidos} es ahora tutor/a de ${grupo.nombre}.`, 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  async crearProfesor() {
    if (this.profForm.invalid) return;
    this.saving = true;
    const v = this.profForm.value;
    const currentUser = this.auth.currentUser;

    try {
      // Crear la cuenta del profesor en el backend (MySQL). No afecta a la sesión
      // actual porque no guardamos el token que devuelve el registro.
      const token = localStorage.getItem('cuaderno_token') || '';
      const authRes = await fetch(buildUrl(environment.apiUrl, 'auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: v.email,
          password: v.password,
          nombre: v.nombre,
          apellidos: v.apellidos,
          rol: v.rol,
          centroId: currentUser?.centroId || 'default',
          departamento: v.departamento,
          especialidad: v.especialidad,
          esTutor: v.rol === 'tutor'
        })
      });

      if (!authRes.ok) {
        const errData = await authRes.json().catch(() => ({}));
        throw new Error(errData?.error || 'No se pudo crear el profesor.');
      }

      this.snackBar.open(
        `✓ Profesor/a ${v.nombre} ${v.apellidos} creado correctamente`,
        'OK', { duration: 4000 }
      );
      this.profForm.reset({ rol: 'profesor' });
      this.showForm = false;
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  // ====== IMPORTACIÓN DESDE EXCEL ======

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      this.importPreview = rows.map(row => ({
        nombre: this.findCol(row, ['nombre', 'Nombre', 'name']) || '',
        apellidos: this.findCol(row, ['apellidos', 'Apellidos', 'apellido']) || '',
        email: this.findCol(row, ['email', 'Email', 'correo']) || '',
        password: this.findCol(row, ['password', 'Password', 'contraseña', 'Contraseña']) || 'Temp2025#',
        rol: this.findCol(row, ['rol', 'Rol', 'role']) || 'profesor',
        departamento: this.findCol(row, ['departamento', 'Departamento', 'dept']) || '',
        especialidad: this.findCol(row, ['especialidad', 'Especialidad']) || '',
        _error: !this.findCol(row, ['nombre', 'Nombre']) || !this.findCol(row, ['email', 'Email', 'correo'])
      }));
      this.snackBar.open(`${this.importPreview.length} filas leídas`, 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    input.value = '';
  }

  private findCol(row: any, variants: string[]): string {
    for (const v of variants) { if (row[v] !== undefined && row[v] !== '') return String(row[v]).trim(); }
    return '';
  }

  cancelImport() { this.importPreview = []; }

  async confirmarImport() {
    this.importing = true;
    const token = localStorage.getItem('cuaderno_token') || '';
    const currentUser = this.auth.currentUser;
    let created = 0, errors = 0;

    for (const row of this.importPreview.filter(r => !r._error)) {
      try {
        const res = await fetch(buildUrl(environment.apiUrl, 'auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: row.email, password: row.password,
            nombre: row.nombre, apellidos: row.apellidos,
            rol: row.rol, departamento: row.departamento, especialidad: row.especialidad,
            centroId: currentUser?.centroId || 'default', esTutor: row.rol === 'tutor'
          })
        });
        if (!res.ok) { errors++; continue; }
        created++;
      } catch { errors++; }
    }

    this.importing = false;
    this.importPreview = [];
    this.snackBar.open(`✓ ${created} profesores importados` + (errors > 0 ? ` (${errors} errores)` : ''), 'OK', { duration: 5000 });
  }
}