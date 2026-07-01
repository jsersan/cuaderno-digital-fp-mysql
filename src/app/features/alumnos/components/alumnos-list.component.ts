import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AlumnosService, GruposService, ModulosService, AuthService, ExportService, ActiveModuleService } from '@core/services';
import { Alumno, EstadoAlumno, Grupo, Matricula } from '@core/models';

@Component({
  selector: 'app-alumnos-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatMenuModule, MatTooltipModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'students.title' | translate }}</h2>
        <p class="subtitle">{{ 'students.subtitle' | translate }}</p>
      </div>
      <div class="header-actions">
        <button mat-raised-button (click)="fileInput.click()" class="import-btn">
          <mat-icon>upload_file</mat-icon> {{ 'common.import_excel' | translate }}
        </button>
        <input #fileInput type="file" hidden accept=".xlsx,.xls,.csv"
               (change)="onFileSelected($event)">
        <button mat-raised-button color="primary" routerLink="/alumnos/nuevo">
          <mat-icon>person_add</mat-icon> {{ 'students.new' | translate }}
        </button>
      </div>
    </div>

    <!-- Panel de previsualización de importación -->
    @if (importPreview.length > 0) {
      <mat-card class="import-card">
        <div class="import-header">
          <h3><mat-icon>upload_file</mat-icon> {{ 'students.import.preview_title' | translate:{ count: importPreview.length } }}</h3>
          <div class="import-actions">
            <button mat-button (click)="cancelImport()">{{ 'common.cancel' | translate }}</button>
            <button mat-raised-button color="primary" (click)="confirmarImport()" [disabled]="importing">
              <mat-icon>check</mat-icon> {{ (importing ? 'students.import.importing' : 'students.import.confirm') | translate }}
            </button>
          </div>
        </div>
        @if (!filtroGrupo) {
          <div class="import-warning">
            <mat-icon>warning</mat-icon>
            <span>{{ 'students.import.no_group_warning' | translate }}</span>
          </div>
        }
        @if (importErrors.length > 0) {
          <div class="import-errors">
            <mat-icon>warning</mat-icon>
            <span>{{ 'students.import.errors' | translate:{ count: importErrors.length } }}</span>
          </div>
        }
        <table mat-table [dataSource]="importPreview" class="import-table">
          <ng-container matColumnDef="fila">
            <th mat-header-cell *matHeaderCellDef>#</th>
            <td mat-cell *matCellDef="let row; let i = index">{{ i + 1 }}</td>
          </ng-container>
          <ng-container matColumnDef="nombre">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th>
            <td mat-cell *matCellDef="let row">{{ row.nombre }}</td>
          </ng-container>
          <ng-container matColumnDef="apellidos">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.surname' | translate }}</th>
            <td mat-cell *matCellDef="let row">{{ row.apellidos }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th>
            <td mat-cell *matCellDef="let row">{{ row.email }}</td>
          </ng-container>
          <ng-container matColumnDef="dni">
            <th mat-header-cell *matHeaderCellDef>{{ 'students.form.dni' | translate }}</th>
            <td mat-cell *matCellDef="let row">{{ row.dni || '—' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['fila','nombre','apellidos','email','dni']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['fila','nombre','apellidos','email','dni'];"
              [class.error-row]="row._error"></tr>
        </table>
        <p class="import-hint">
          <mat-icon>info</mat-icon>
          {{ 'students.import.hint' | translate }}
        </p>
      </mat-card>
    }

    <!-- Filtros -->
    <mat-card class="filters-card">
      <div class="filters-row">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>{{ 'common.search' | translate }}</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()"
                 [placeholder]="'students.search_placeholder' | translate">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.group' | translate }}</mat-label>
          <mat-select [(ngModel)]="filtroGrupo" (ngModelChange)="loadAlumnos()">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            @for (grupo of gruposCombo; track grupo.id) {
              <mat-option [value]="grupo.id">{{ grupo.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.status' | translate }}</mat-label>
          <mat-select [(ngModel)]="filtroEstado" (ngModelChange)="applyFilter()">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            <mat-option value="activo">{{ 'students.status_active' | translate }}</mat-option>
            <mat-option value="baja">{{ 'students.status_inactive' | translate }}</mat-option>
            <mat-option value="trasladado">{{ 'students.status_transferred' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-icon-button [matTooltip]="'common.export' | translate" (click)="exportar()">
          <mat-icon>download</mat-icon>
        </button>
      </div>
    </mat-card>

    <!-- Tabla de alumnos -->
    <mat-card class="table-card">
      <table mat-table [dataSource]="filteredAlumnos" matSort (matSortChange)="sortData($event)">

        <ng-container matColumnDef="apellidos">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'common.surname' | translate }}</th>
          <td mat-cell *matCellDef="let a">
            <a [routerLink]="['/alumnos', a.id]" class="alumno-link">{{ a.apellidos }}</a>
          </td>
        </ng-container>

        <ng-container matColumnDef="nombre">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'common.name' | translate }}</th>
          <td mat-cell *matCellDef="let a">{{ a.nombre }}</td>
        </ng-container>

        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th>
          <td mat-cell *matCellDef="let a">{{ a.email }}</td>
        </ng-container>

        <ng-container matColumnDef="grupo">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.group' | translate }}</th>
          <td mat-cell *matCellDef="let a">
            <mat-chip>{{ getGrupoNombre(a.grupoId) }}</mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="estado">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.status' | translate }}</th>
          <td mat-cell *matCellDef="let a">
            <span class="estado-badge" [class]="'estado-' + a.estado">
              {{ ('students.status_' + estadoKey(a.estado)) | translate }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="acciones">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | translate }}</th>
          <td mat-cell *matCellDef="let a">
            <button mat-icon-button [matMenuTriggerFor]="menuAlumno" [matMenuTriggerData]="{alumno: a}">
              <mat-icon>more_vert</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
            class="clickable-row"></tr>
      </table>

      @if (filteredAlumnos.length === 0) {
        <div class="empty-state">
          <mat-icon>person_search</mat-icon>
          <p>{{ 'students.empty' | translate }}</p>
        </div>
      }

      <mat-paginator [length]="filteredAlumnos.length"
                     [pageSize]="25"
                     [pageSizeOptions]="[10, 25, 50]"
                     showFirstLastButtons>
      </mat-paginator>
    </mat-card>

    <!-- Menú contextual -->
    <mat-menu #menuAlumno="matMenu">
      <ng-template matMenuContent let-alumno="alumno">
        <button mat-menu-item [routerLink]="['/alumnos', alumno.id]">
          <mat-icon>visibility</mat-icon> {{ 'common.view_detail' | translate }}
        </button>
        <button mat-menu-item [routerLink]="['/alumnos', alumno.id, 'editar']">
          <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
        </button>
        <button mat-menu-item (click)="darDeBaja(alumno)" *ngIf="alumno.estado === 'activo'">
          <mat-icon color="warn">person_remove</mat-icon> {{ 'students.deactivate' | translate }}
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; font-size: 14px; }
    .header-actions { display: flex; gap: 8px; }
    .import-btn { background: #fff3e0 !important; color: #e65100 !important; }
    .import-card { margin-bottom: 16px; padding: 20px; border-radius: 12px; border-left: 4px solid #ff9800; }
    .import-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .import-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; color: #e65100; }
    .import-actions { display: flex; gap: 8px; }
    .import-warning { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff3e0; border-radius: 8px; color: #e65100; font-size: 13px; margin-bottom: 12px; }
    .import-errors { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ffebee; border-radius: 8px; color: #c62828; font-size: 13px; margin-bottom: 12px; }
    .import-table { width: 100%; }
    .error-row { background: #fff8e1; }
    .import-hint { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #888; margin: 12px 0 0; }
    .import-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .filters-card { margin-bottom: 16px; padding: 16px; border-radius: 12px; }
    .filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .search-field { flex: 1; min-width: 250px; }
    .table-card { border-radius: 12px; overflow: hidden; }
    table { width: 100%; }
    .alumno-link { color: #1565c0; text-decoration: none; font-weight: 500; }
    .alumno-link:hover { text-decoration: underline; }
    .clickable-row:hover { background: #f5f5f5; }
    .estado-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .estado-activo { background: #e8f5e9; color: #2e7d32; }
    .estado-baja { background: #ffebee; color: #c62828; }
    .estado-trasladado { background: #fff3e0; color: #e65100; }
    .empty-state { text-align: center; padding: 48px 24px; color: #999; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class AlumnosListComponent implements OnInit {
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private exportService = inject(ExportService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  activeModule = inject(ActiveModuleService);

  alumnos: Alumno[] = [];
  filteredAlumnos: Alumno[] = [];
  grupos: Grupo[] = [];
  searchTerm = '';
  filtroGrupo = '';

  // Combo de grupos: solo los del ciclo + curso del cuaderno activo.
  // Así en DBDR/PROI (SMR) solo sale 2SM2, y en DWEC/PROY (DAW) solo 2AW3.
  get gruposCombo(): Grupo[] {
    const g = this.activeModule.currentGrupo;
    if (!g) return this.grupos;
    return this.grupos.filter(x =>
      x.cicloId === g.cicloId && Number((x as any).curso) === Number((g as any).curso)
    );
  }
  filtroEstado = '';
  displayedColumns = ['apellidos', 'nombre', 'email', 'grupo', 'estado', 'acciones'];

  // Import Excel
  importPreview: any[] = [];
  importErrors: string[] = [];
  importing = false;

  // Mapea el valor de estado a la clave i18n (activo→active, baja→inactive, trasladado→transferred)
  estadoKey(estado: string): string {
    return estado === 'baja' ? 'inactive' : estado === 'trasladado' ? 'transferred' : 'active';
  }

  async ngOnInit() {
    // Esperar a que el usuario esté disponible (puede no estar resuelto
    // de forma síncrona justo tras recargar/navegar). Si lo leyéramos de
    // golpe con this.auth.currentUser y fuera null, la pantalla quedaría vacía.
    let user = this.auth.currentUser;
    if (!user) {
      user = await firstValueFrom(
        this.auth.currentUser$.pipe(filter(u => !!u), take(1))
      );
    }
    if (!user) return;

    await this.activeModule.restore();
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);

    if (this.activeModule.grupoId) {
      this.filtroGrupo = this.activeModule.grupoId;
    }
    await this.loadAlumnos();
  }

  async loadAlumnos() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      if (this.filtroGrupo) {
        this.alumnos = await this.alumnosService.getByGrupo(this.filtroGrupo);
      } else {
        this.alumnos = await this.alumnosService.queryByField('centroId', user.centroId);
      }

      // Se muestran TODOS los alumnos del grupo (no se filtra por módulo activo),
      // de modo que el listado coincide en número y composición con Calificaciones
      // y con la Orla. Antes se filtraba por matrícula en el módulo del cuaderno
      // activo, lo que ocultaba a los alumnos no matriculados en ese módulo.

      // Orden alfabético ascendente por apellidos (igual que Calificaciones/Orla),
      // con desempate por nombre.
      this.alumnos.sort((a, b) =>
        a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre)
      );
    } catch (e) {
      console.error('Error cargando alumnos:', e);
      this.alumnos = [];
    }
    this.applyFilter();
  }

  applyFilter() {
    let result = [...this.alumnos];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(a =>
        a.nombre.toLowerCase().includes(term) ||
        a.apellidos.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term)
      );
    }
    if (this.filtroEstado) {
      result = result.filter(a => a.estado === this.filtroEstado);
    }
    this.filteredAlumnos = result;
  }

  sortData(sort: Sort) {
    const data = [...this.filteredAlumnos];
    if (!sort.active || sort.direction === '') {
      // Sin orden de columna explícito → volver al orden alfabético por apellidos
      this.filteredAlumnos = data.sort((a, b) =>
        a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre)
      );
      return;
    }
    this.filteredAlumnos = data.sort((a: any, b: any) => {
      const isAsc = sort.direction === 'asc';
      return (a[sort.active] < b[sort.active] ? -1 : 1) * (isAsc ? 1 : -1);
    });
  }

  getGrupoNombre(grupoId: string): string {
    return this.grupos.find(g => g.id === grupoId)?.nombre || grupoId;
  }

  async darDeBaja(alumno: Alumno) {
    const msg = this.t.instant('students.confirm_deactivate', { nombre: alumno.nombre, apellidos: alumno.apellidos });
    if (confirm(msg)) {
      await this.alumnosService.darDeBaja(alumno.id!, 'Baja manual');
      this.snackBar.open(this.t.instant('students.deactivated'), 'OK', { duration: 3000 });
      await this.loadAlumnos();
    }
  }

  exportar() {
    this.exportService.exportarAlumnosExcel(this.filteredAlumnos, 'Listado_Alumnos');
  }

  // ====== IMPORTACIÓN DESDE EXCEL ======

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        this.snackBar.open(this.t.instant('students.import.empty_file'), 'Cerrar', { duration: 3000 });
        return;
      }

      this.importErrors = [];
      this.importPreview = rows.map((row, i) => {
        const mapped = {
          nombre: this.findCol(row, ['nombre', 'name', 'Nombre']) || '',
          apellidos: this.findCol(row, ['apellidos', 'apellido', 'Apellidos', 'Apellido', 'surname', 'last_name']) || '',
          email: this.findCol(row, ['email', 'Email', 'correo', 'Correo', 'e-mail']) || '',
          dni: this.findCol(row, ['dni', 'DNI', 'nie', 'NIE', 'documento']) || '',
          telefono: this.findCol(row, ['telefono', 'teléfono', 'Teléfono', 'phone', 'tel']) || '',
          localidad: this.findCol(row, ['localidad', 'Localidad', 'ciudad', 'City']) || '',
          direccion: this.findCol(row, ['direccion', 'dirección', 'Dirección', 'address']) || '',
          _error: false
        };

        if (!mapped.nombre || !mapped.apellidos || !mapped.email) {
          mapped._error = true;
          this.importErrors.push(this.t.instant('students.import.row_missing', { row: i + 2 }));
        }

        return mapped;
      });

      this.snackBar.open(
        this.t.instant('students.import.rows_read', { count: this.importPreview.length }),
        'OK', { duration: 4000 }
      );
    } catch (e: any) {
      this.snackBar.open(this.t.instant('students.import.read_error', { msg: e.message }), 'Cerrar', { duration: 5000 });
    }

    input.value = '';
  }

  private findCol(row: any, variants: string[]): string {
    for (const v of variants) {
      if (row[v] !== undefined && row[v] !== '') return String(row[v]).trim();
    }
    return '';
  }

  cancelImport() {
    this.importPreview = [];
    this.importErrors = [];
  }

  async confirmarImport() {
    this.importing = true;
    const user = this.auth.currentUser;
    if (!user) { this.importing = false; return; }

    // Si hay grupo de destino, resolver su ciclo y matricular a los alumnos
    // importados en TODOS los módulos de ese ciclo (evita que el filtro por
    // módulo de otras pantallas los oculte y deja cicloId correcto).
    let cicloId = '';
    let matriculasBase: Matricula[] = [];
    if (this.filtroGrupo) {
      try {
        const grupo = await this.gruposService.getById(this.filtroGrupo);
        if (grupo) {
          cicloId = grupo.cicloId || '';
          if (cicloId) {
            const mods = await this.modulosService.queryByField('cicloId', cicloId);
            matriculasBase = mods
              .filter(m => m.activo !== false)
              .map(m => ({
                moduloId: m.id!,
                moduloNombre: m.nombre,
                convocatoria: 1,
                estado: 'matriculado' as const
              }));
          }
        }
      } catch (e) {
        console.warn('No se pudieron cargar los módulos del grupo destino:', e);
      }
    }

    // Para no duplicar, precargar los DNI ya existentes en el grupo destino.
    const dnisExistentes = new Set(
      this.alumnos
        .map(a => (a.dni || '').trim().toUpperCase().replace(/[\s-]/g, ''))
        .filter(Boolean)
    );

    const validRows = this.importPreview.filter(r => !r._error);
    let created = 0;
    let errors = 0;
    let saltados = 0;

    for (const row of validRows) {
      const dniNorm = (row.dni || '').trim().toUpperCase().replace(/[\s-]/g, '');
      // Saltar si ya existe un alumno con ese DNI en el grupo
      if (dniNorm && dnisExistentes.has(dniNorm)) { saltados++; continue; }

      try {
        const alumno: Partial<Alumno> = {
          nombre: row.nombre,
          apellidos: row.apellidos,
          email: row.email,
          dni: row.dni || undefined,
          telefono: row.telefono || undefined,
          localidad: row.localidad || undefined,
          direccion: row.direccion || undefined,
          centroId: user.centroId,
          grupoId: this.filtroGrupo || '',
          cicloId,
          curso: 1,
          estado: EstadoAlumno.ACTIVO,
          cursoAcademico: this.activeModule.cursoActual,
          repetidor: false,
          matriculas: matriculasBase.map(m => ({ ...m }))
        };
        await this.alumnosService.create(alumno);
        if (dniNorm) dnisExistentes.add(dniNorm);
        created++;
      } catch {
        errors++;
      }
    }

    this.importing = false;
    this.importPreview = [];
    this.importErrors = [];

    const key = errors > 0 ? 'students.import.imported_errors' : 'students.import.imported';
    this.snackBar.open(this.t.instant(key, { count: created, errors }), 'OK', { duration: 5000 });
    await this.loadAlumnos();
  }
}