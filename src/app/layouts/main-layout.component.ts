import { Component, inject, OnInit, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router
} from '@angular/router'
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatMenuModule } from '@angular/material/menu'
import { MatBadgeModule } from '@angular/material/badge'
import { MatDividerModule } from '@angular/material/divider'
import { MatTooltipModule } from '@angular/material/tooltip'
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout'
import { AuthService } from '@core/services/auth.service'
import { ActiveModuleService } from '@core/services/active-module.service'
import { LanguageService } from '@core/services/language.service'
import { TranslateModule } from '@ngx-translate/core'
import { Rol } from '@core/models'

interface NavItem {
  icon: string
  label: string
  route: string
  roles?: Rol[]
  badge?: number
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatTooltipModule,
    TranslateModule
  ],
  template: `
    <div class="app-layout">
      <!-- SIDEBAR -->
      <aside class="app-sidenav">
        <div class="sidenav-header">
          <div class="logo-container" routerLink="/dashboard" matTooltip="Panel de Control">
            <mat-icon class="logo-icon">school</mat-icon>
            <div class="logo-text">
              <span class="app-title">Cuaderno Digital</span>
              <span class="app-subtitle">FP Euskadi</span>
            </div>
          </div>
        </div>

        <nav class="nav-list">
          @for (item of navItems; track item.route) { @if (!item.roles ||
          hasRole(item.roles)) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active-link"
            [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
          >
            <mat-icon>{{ item.icon }}</mat-icon>
            <span>{{ item.label | translate }}</span>
          </a>
          } }
        </nav>

        <div class="nav-separator"></div>

        <nav class="nav-list bottom-nav">
          <a routerLink="/cuaderno" routerLinkActive="active-link">
            <mat-icon>menu_book</mat-icon
            ><span>{{ 'nav.notebook' | translate }}</span>
          </a>
          <a routerLink="/orla" routerLinkActive="active-link">
            <mat-icon>photo_library</mat-icon
            ><span>{{ 'nav.orla' | translate }}</span>
          </a>
          <a routerLink="/informes" routerLinkActive="active-link">
            <mat-icon>assessment</mat-icon
            ><span>{{ 'nav.reports' | translate }}</span>
          </a>
          <a routerLink="/evaluaciones" routerLinkActive="active-link">
            <mat-icon>date_range</mat-icon
            ><span>{{ 'nav.eval_dates' | translate }}</span>
          </a>
          <a routerLink="/horario" routerLinkActive="active-link">
            <mat-icon>schedule</mat-icon
            ><span>{{ 'nav.schedule' | translate }}</span>
          </a>
          <a routerLink="/configuracion" routerLinkActive="active-link">
            <mat-icon>settings</mat-icon
            ><span>{{ 'common.settings' | translate }}</span>
          </a>
          <a routerLink="/backup" routerLinkActive="active-link">
            <mat-icon>backup</mat-icon
            ><span>{{ 'nav.backup' | translate }}</span>
          </a>
        </nav>

        <div class="user-info-sidebar">
          @if (auth.currentUser?.fotoUrl) {
          <img
            [src]="auth.currentUser?.fotoUrl"
            alt="avatar"
            class="sidebar-avatar"
          />
          } @else {
          <mat-icon>account_circle</mat-icon>
          }
          <div class="user-details">
            <span class="user-name">{{ auth.currentUser?.nombre }}</span>
            <span class="user-role">{{
              auth.currentUser?.rol | titlecase
            }}</span>
          </div>
        </div>
      </aside>

      <!-- CONTENIDO PRINCIPAL -->
      <div class="app-main">
        <mat-toolbar class="app-toolbar" color="primary">
          <span class="toolbar-title">{{ getPageTitle() }}</span>
          <span class="toolbar-spacer"></span>

          @if (activeModule.current) {
          <div
            class="active-module-badge"
            (click)="goToDashboard()"
            matTooltip="Cambiar cuaderno"
          >
            <mat-icon>menu_book</mat-icon>
            <span>{{ activeModule.current.abreviatura }}</span>
          </div>
          }

          <!-- CURSO ACADÉMICO DINÁMICO -->
          <span class="curso-badge" (click)="goToDashboard()" matTooltip="Cambiar curso académico">
            {{ activeModule.cursoActual }}
          </span>

          <button
            mat-icon-button
            [matMenuTriggerFor]="userMenu"
            matTooltip="Mi cuenta"
            class="avatar-btn"
          >
            @if (auth.currentUser?.fotoUrl) {
            <img
              [src]="auth.currentUser?.fotoUrl"
              alt="avatar"
              class="toolbar-avatar"
            />
            } @else {
            <mat-icon>account_circle</mat-icon>
            }
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="user-menu-header">
              <strong
                >{{ auth.currentUser?.nombre }}
                {{ auth.currentUser?.apellidos }}</strong
              >
              <small>{{ auth.currentUser?.email }}</small>
            </div>
            <mat-divider></mat-divider>
            <button mat-menu-item routerLink="/configuracion">
              <mat-icon>settings</mat-icon
              ><span>{{ 'common.settings' | translate }}</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon
              ><span>{{ 'common.logout' | translate }}</span>
            </button>
          </mat-menu>

          <!-- Selector de idioma -->
          <button
            mat-button
            class="lang-btn"
            [matMenuTriggerFor]="langMenu"
            matTooltip="{{ 'language.select' | translate }}"
          >
            <mat-icon>language</mat-icon>
            <span class="lang-code">{{
              language.current().toUpperCase()
            }}</span>
            <mat-icon class="lang-caret">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #langMenu="matMenu">
            @for (idi of language.idiomas; track idi.code) {
            <button
              mat-menu-item
              (click)="language.use(idi.code)"
              [class.lang-active]="language.current() === idi.code"
            >
              <span class="lang-badge">{{ idi.label }}</span>
              <span>{{ idi.nombre }}</span>
              @if (language.current() === idi.code) {
              <mat-icon class="lang-check">check</mat-icon> }
            </button>
            }
          </mat-menu>
        </mat-toolbar>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .app-layout {
        display: flex;
        height: 100vh;
      }

      .app-sidenav {
        width: 260px;
        min-width: 260px;
        background: #fff;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #e0e0e0;
        overflow-y: auto;
      }

      .sidenav-header {
        padding: 20px 16px;
        background: #1565c0;
        color: white;
      }
      .logo-container {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }
      .logo-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: #bbdefb;
      }
      .logo-text {
        display: flex;
        flex-direction: column;
      }
      .app-title {
        font-size: 16px;
        font-weight: 700;
        color: white;
      }
      .app-subtitle {
        font-size: 12px;
        opacity: 0.85;
        color: #bbdefb;
      }

      .nav-list {
        display: flex;
        flex-direction: column;
        padding: 8px 0;
      }
      .nav-list a {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        margin: 1px 12px 1px 0;
        color: #444;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        border-radius: 0 24px 24px 0;
        transition: background 0.15s;
      }
      .nav-list a mat-icon {
        color: #757575;
      }
      .nav-list a:hover {
        background: #e3f2fd;
        color: #1565c0;
      }
      .nav-list a:hover mat-icon {
        color: #1565c0;
      }
      .active-link {
        background: #e3f2fd !important;
        color: #1565c0 !important;
        font-weight: 600 !important;
      }
      .active-link mat-icon {
        color: #1565c0 !important;
      }

      .nav-separator {
        flex: 1;
        border-bottom: 1px solid #e0e0e0;
        margin: 8px 0;
      }
      .bottom-nav {
        margin-top: 0;
      }

      .user-info-sidebar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
      }
      .user-details {
        display: flex;
        flex-direction: column;
      }
      .user-name {
        font-size: 13px;
        font-weight: 600;
        color: #333;
      }
      .user-role {
        font-size: 11px;
        color: #888;
      }
      .user-info-sidebar > mat-icon {
        color: #1565c0;
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .app-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .app-toolbar {
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .toolbar-title {
        font-size: 18px;
        font-weight: 500;
      }
      .toolbar-spacer {
        flex: 1;
      }
      .curso-badge {
        background: rgba(255, 255, 255, 0.15);
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        margin-right: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .curso-badge:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .active-module-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 14px;
        border-radius: 20px;
        margin-right: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: background 0.2s;
      }
      .active-module-badge:hover {
        background: rgba(255, 255, 255, 0.35);
      }
      .active-module-badge mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .main-content {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
        overflow-y: auto;
        flex: 1;
        width: 100%;
        box-sizing: border-box;
      }

      .user-menu-header {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .user-menu-header small {
        color: rgba(0, 0, 0, 0.54);
      }
      .lang-btn {
        color: white !important;
        min-width: 0;
        padding: 0 8px;
      }
      .lang-btn .mat-icon,
      .lang-btn .lang-code,
      .lang-btn .lang-caret {
        color: white !important;
      }
      .lang-code {
        font-weight: 700;
        font-size: 13px;
        margin: 0 2px;
      }
      .lang-caret {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-left: -4px;
      }
      .lang-badge {
        display: inline-block;
        min-width: 28px;
        font-weight: 700;
        font-size: 12px;
        color: #1565c0;
      }
      .lang-active {
        background: #e3f2fd;
      }
      .lang-check {
        color: #1565c0;
        margin-left: auto;
      }

      /* Avatares con foto de perfil */
      .avatar-btn {
        padding: 0;
      }
      .toolbar-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, 0.6);
      }
      .sidebar-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        flex: 0 0 32px;
      }
    `
  ]
})
export class MainLayoutComponent implements OnInit {
  auth = inject(AuthService)
  activeModule = inject(ActiveModuleService)
  language = inject(LanguageService)
  private router = inject(Router)
  private breakpointObserver = inject(BreakpointObserver)

  @ViewChild('sidenav') sidenav!: MatSidenav

  isMobile = false

  navItems: NavItem[] = [
    { icon: 'dashboard', label: 'nav.dashboard', route: '/dashboard' },
    { icon: 'groups', label: 'nav.students', route: '/alumnos' },
    { icon: 'event_note', label: 'nav.programming', route: '/programacion' },
    { icon: 'assignment', label: 'nav.tasks', route: '/tareas', badge: 0 },
    { icon: 'quiz', label: 'nav.exams', route: '/examenes' },
    { icon: 'refresh', label: 'nav.recovery', route: '/recuperaciones' },
    { icon: 'grade', label: 'nav.grades', route: '/calificaciones' },
    { icon: 'event_available', label: 'nav.attendance', route: '/asistencia' },
    {
      icon: 'people',
      label: 'nav.teachers',
      route: '/profesores',
      roles: [Rol.ADMIN]
    }
  ]

  ngOnInit (): void {
    // Rehidratar el cuaderno activo tras recargar la página
    this.activeModule.restore()

    // Usar 768px en vez de Handset (600px) para que el sidebar aguante con DevTools abierto
    this.breakpointObserver
      .observe(['(max-width: 768px)'])
      .subscribe(result => {
        this.isMobile = result.matches
      })

    // Aplicar tema oscuro si está configurado
    this.auth.currentUser$.subscribe(user => {
      if (user?.configuracion?.temaOscuro) {
        document.body.classList.add('dark-theme')
      } else {
        document.body.classList.remove('dark-theme')
      }
    })
  }

  hasRole (roles: Rol[]): boolean {
    const userRole = this.auth.currentUser?.rol
    return userRole ? roles.includes(userRole) || userRole === Rol.ADMIN : false
  }

  getPageTitle (): string {
    const url = this.router.url
    const titles: { [key: string]: string } = {
      '/dashboard': 'Panel de Control',
      '/alumnos': 'Gestión de Alumnos',
      '/grupos': 'Grupos',
      '/modulos': 'Módulos Profesionales',
      '/programacion': 'Programación temporal',
      '/tareas': 'Tareas',
      '/examenes': 'Exámenes',
      '/recuperaciones': 'Recuperaciones',
      '/calificaciones': 'Calificaciones',
      '/asistencia': 'Control de Asistencia',
      '/cuaderno': 'Cuaderno Completo',
      '/orla': 'Orla del grupo',
      '/informes': 'Informes',
      '/evaluaciones': 'Fechas de evaluación',
      '/horario': 'Horario semanal',
      '/profesores': 'Profesores',
      '/configuracion': 'Configuración'
    }

    for (const [path, title] of Object.entries(titles)) {
      if (url.startsWith(path)) return title
    }
    return 'Cuaderno Digital FP'
  }

  async logout (): Promise<void> {
    this.activeModule.clear()
    await this.auth.logout()
  }

  goToDashboard () {
    this.router.navigate(['/dashboard'])
  }
}