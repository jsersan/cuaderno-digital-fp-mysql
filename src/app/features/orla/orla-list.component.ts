import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import { LOGO_ZORNOTZA } from './orla-logo';
import { OrlasService, OrlaRegistro, AlumnosService, GruposService, CiclosService, AuthService, ActiveModuleService } from '@core/services';
import { Alumno } from '@core/models';

@Component({
  selector: 'app-orlas-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, TranslateModule],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'orlas.title' | translate }}</h2>
        <p class="subtitle">{{ 'orlas.subtitle' | translate }}</p>
      </div>
      <button mat-raised-button color="primary" routerLink="/orla">
        <mat-icon>add_a_photo</mat-icon> {{ 'orlas.new' | translate }}
      </button>
    </div>

    @if (cargando) {
      <div class="centro"><mat-spinner diameter="40"></mat-spinner></div>
    } @else if (orlas.length === 0) {
      <mat-card class="empty-card">
        <mat-icon>photo_library</mat-icon>
        <p>{{ 'orlas.empty' | translate }}</p>
        <button mat-raised-button color="primary" routerLink="/orla">{{ 'orlas.new' | translate }}</button>
      </mat-card>
    } @else {
      <div class="orlas-grid">
        @for (o of orlas; track o.id) {
          <mat-card class="orla-card">
            <div class="orla-head">
              <mat-icon>school</mat-icon>
              <div>
                <h3>{{ o.grupoNombre }}</h3>
                <span class="ciclo">{{ o.cicloNombre }}{{ o.cursoTexto ? ' · ' + o.cursoTexto : '' }}</span>
              </div>
            </div>
            <div class="orla-meta">
              <span [class.completa]="o.conFoto === o.totalAlumnos" [class.parcial]="o.conFoto < o.totalAlumnos">
                <mat-icon>photo</mat-icon> {{ o.conFoto }} / {{ o.totalAlumnos }} {{ 'orlas.with_photo' | translate }}
              </span>
              <span class="fecha">
                <mat-icon>schedule</mat-icon> {{ formatFecha(o.generadaEn) }}
              </span>
            </div>
            <div class="orla-actions">
              <button mat-raised-button color="primary" (click)="descargar(o)" [disabled]="descargandoId === o.grupoId">
                @if (descargandoId === o.grupoId) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <ng-container><mat-icon>download</mat-icon> {{ 'orlas.download' | translate }}</ng-container>
                }
              </button>
              <button mat-stroked-button [routerLink]="['/orla']" (click)="irAEditar(o)">
                <mat-icon>edit</mat-icon> {{ 'orlas.edit' | translate }}
              </button>
            </div>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .centro { display: flex; justify-content: center; padding: 48px; }
    .orlas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .orla-card { padding: 20px; border-radius: 14px; }
    .orla-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .orla-head mat-icon { font-size: 36px; width: 36px; height: 36px; color: #1565c0; }
    .orla-head h3 { margin: 0; font-size: 18px; }
    .ciclo { font-size: 13px; color: #666; }
    .orla-meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; font-size: 13px; }
    .orla-meta span { display: flex; align-items: center; gap: 6px; color: #555; }
    .orla-meta mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .orla-meta .completa { color: #2e7d32; font-weight: 500; }
    .orla-meta .parcial { color: #e65100; font-weight: 500; }
    .orla-actions { display: flex; gap: 8px; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class OrlasListComponent implements OnInit {
  private orlasService = inject(OrlasService);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private ciclosService = inject(CiclosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private activeModule = inject(ActiveModuleService);

  orlas: OrlaRegistro[] = [];
  cargando = true;
  descargandoId = '';

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) { this.cargando = false; return; }
    try {
      const lista = await firstValueFrom(this.orlasService.getByCentro$(user.centroId, this.activeModule.cursoActual));
      this.orlas = (lista || []).sort((a, b) => a.grupoNombre.localeCompare(b.grupoNombre));
    } catch (e) {
      console.error('Error cargando orlas:', e);
    } finally {
      this.cargando = false;
    }
  }

  formatFecha(fecha: any): string {
    if (!fecha) return '—';
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha.seconds ? fecha.seconds * 1000 : fecha);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Al editar, deja el grupo preseleccionado para la pantalla de Orla (vía sessionStorage no,
  // simplemente navega; la pantalla de Orla ya preselecciona el cuaderno activo).
  irAEditar(o: OrlaRegistro) { /* la navegación la hace routerLink */ }

  // Regenera el PDF al momento desde las fotos actuales del grupo
  async descargar(o: OrlaRegistro) {
    this.descargandoId = o.grupoId;
    try {
      const alumnos = await this.alumnosService.getByGrupo(o.grupoId);
      const conFoto = alumnos
        .filter(a => (a as any).fotoUrl)
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre));

      if (conFoto.length === 0) {
        this.snackBar.open(this.t.instant('orla.no_photos'), 'Cerrar', { duration: 3000 });
        return;
      }

      this.generarPDF(o, conFoto);

      // Actualizar el contador por si hubo altas/bajas desde la última generación
      await this.orlasService.upsert({
        ...o,
        totalAlumnos: alumnos.length,
        conFoto: conFoto.length,
        generadaEn: new Date()
      });
      // refrescar en memoria
      o.totalAlumnos = alumnos.length;
      o.conFoto = conFoto.length;
      o.generadaEn = new Date();
    } catch (e: any) {
      this.snackBar.open(e?.message || 'Error al descargar la orla', 'Cerrar', { duration: 5000 });
    } finally {
      this.descargandoId = '';
    }
  }

  // Misma maquetación que la pantalla de Orla
  private generarPDF(o: OrlaRegistro, conFoto: Alumno[]) {
    const tituloCiclo = o.cicloNombre || '';
    // Encabezado del PDF: 4 líneas (curso académico, centro, ciclo, curso ordinal)
    const cursoAcademicoCorto = (o.cursoAcademico || this.activeModule.cursoActual || '2026-2027')
      .replace(/^(\d{4})-\d{2}(\d{2})$/, '$1/$2');
    const lineasEncabezado = [
      `Curso ${cursoAcademicoCorto}`,
      'CIFP Zornotza LHII',
      tituloCiclo,
      o.cursoTexto || '',
    ].filter(Boolean);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 10;

    const n = conFoto.length;
    let cols: number;
    if (n <= 4) cols = 2;
    else if (n <= 12) cols = 4;
    else cols = 5;

    const top = 48;
    const bottom = 12;
    const gapX = 4;
    const gapY = 5;
    const labelH = 8;

    const rows = Math.ceil(n / cols);
    const cellW = (W - MX * 2 - gapX * (cols - 1)) / cols;
    const availH = H - top - bottom;
    const fotoIdeal = cellW * 4 / 3;
    const fotoMax = (availH - rows * labelH - (rows - 1) * gapY) / rows;
    const fotoH = Math.max(20, Math.min(fotoIdeal, fotoMax));
    const cellH = fotoH + labelH;

    const LOGO_RATIO = 500 / 223;
    const pintarEncabezado = (compacto: boolean) => {
      if (compacto) {
        const lw = 32, lh = lw / LOGO_RATIO;
        try { doc.addImage(LOGO_ZORNOTZA, 'PNG', MX, 6, lw, lh); } catch {}
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(21, 101, 192);
        const tx = MX + lw + 6;
        doc.text(lineasEncabezado.join(' · '), tx, 14, { maxWidth: W - tx - MX });
        doc.setDrawColor(21, 101, 192); doc.setLineWidth(0.6); doc.line(MX, 6 + lh + 2, W - MX, 6 + lh + 2);
      } else {
        const lw = 52, lh = lw / LOGO_RATIO;
        try { doc.addImage(LOGO_ZORNOTZA, 'PNG', MX, 8, lw, lh); } catch {}
        const tx = MX + lw + 8;
        const maxTextW = W - tx - MX;
        let yEnc = 14;
        lineasEncabezado.forEach((linea, idx) => {
          if (idx === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(21, 101, 192); }
          else if (idx === 1) { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(40, 40, 40); }
          else { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60, 60, 60); }
          doc.text(linea, tx, yEnc, { maxWidth: maxTextW });
          yEnc += idx === 0 ? 8 : 6;
        });
        const lineaY = Math.max(yEnc, 8 + lh + 2);
        doc.setDrawColor(21, 101, 192); doc.setLineWidth(0.8); doc.line(MX, lineaY, W - MX, lineaY);
      }
    };

    pintarEncabezado(false);
    let x = MX; let y = top;

    for (let i = 0; i < n; i++) {
      const a = conFoto[i];
      const foto = (a as any).fotoUrl as string;
      if (y + cellH > H - bottom + 0.5) {
        doc.addPage(); pintarEncabezado(true); y = 26; x = MX;
      }
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cellW, fotoH, 1.5, 1.5, 'S');
      try {
        const fmt = (foto || '').includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(foto, fmt, x + 1, y + 1, cellW - 2, fotoH - 2);
      } catch { /* imagen no válida */ }
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(a.apellidos, x + cellW / 2, y + fotoH + 3.5, { align: 'center', maxWidth: cellW });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(a.nombre, x + cellW / 2, y + fotoH + 7, { align: 'center', maxWidth: cellW });
      x += cellW + gapX;
      if ((i + 1) % cols === 0) { x = MX; y += cellH + gapY; }
    }

    const total = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150);
      doc.text('Cuaderno Digital FP · Euskadi', MX, H - 7);
      doc.text(new Date().toLocaleDateString('es-ES'), W - MX, H - 7, { align: 'right' });
      doc.setTextColor(0);
    }

    const nombreArchivo = `Orla_${o.grupoNombre || 'grupo'}`.replace(/[,\s]+/g, '_');
    doc.save(`${nombreArchivo}.pdf`);
  }
}