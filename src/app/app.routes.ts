import { Routes } from '@angular/router';
import { authGuard, adminGuard, noAuthGuard, profesorGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  // --- AUTH ---
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/components/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'registro',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/components/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'recuperar-password',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./features/auth/components/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },

  // --- APP PRINCIPAL (requiere autenticación) ---
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },

      // --- ALUMNOS ---
      {
        path: 'alumnos',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/alumnos/components/alumnos-list.component').then(m => m.AlumnosListComponent)
          },
          {
            path: 'nuevo',
            loadComponent: () => import('./features/alumnos/components/alumno-form.component').then(m => m.AlumnoFormComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/alumnos/components/alumno-detail.component').then(m => m.AlumnoDetailComponent)
          },
          {
            path: ':id/editar',
            loadComponent: () => import('./features/alumnos/components/alumno-form.component').then(m => m.AlumnoFormComponent)
          }
        ]
      },

      // --- GRUPOS ---
      {
        path: 'grupos',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/grupos/components/grupos-list.component').then(m => m.GruposListComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/grupos/components/grupo-detail.component').then(m => m.GrupoDetailComponent)
          }
        ]
      },

      // --- MÓDULOS ---
      {
        path: 'modulos',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/modulos/components/modulos-list.component').then(m => m.ModulosListComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/modulos/components/modulo-detail.component').then(m => m.ModuloDetailComponent)
          }
        ]
      },
      {
        path: 'programacion',
        loadComponent: () => import('./features/programacion/programacion.component').then(m => m.ProgramacionComponent)
      },

      // --- TAREAS ---
      {
        path: 'tareas',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/tareas/components/tareas-list.component').then(m => m.TareasListComponent)
          },
          {
            path: 'nueva',
            loadComponent: () => import('./features/tareas/components/tarea-form.component').then(m => m.TareaFormComponent)
          },
          {
            path: ':id/editar',
            loadComponent: () => import('./features/tareas/components/tarea-form.component').then(m => m.TareaFormComponent)
          },
          {
            path: ':id/corregir',
            loadComponent: () => import('./features/tareas/components/tarea-corregir.component').then(m => m.TareaCorregirComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/tareas/components/tarea-detail.component').then(m => m.TareaDetailComponent)
          }
        ]
      },

      // --- EXÁMENES ---
      {
        path: 'examenes',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/examenes/components/examenes-list.component').then(m => m.ExamenesListComponent)
          },
          {
            path: 'nuevo',
            loadComponent: () => import('./features/examenes/components/examen-form.component').then(m => m.ExamenFormComponent)
          },
          {
            path: ':id/calificar',
            loadComponent: () => import('./features/examenes/components/examen-calificar.component').then(m => m.ExamenCalificarComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/examenes/components/examen-detail.component').then(m => m.ExamenDetailComponent)
          }
        ]
      },

      // --- RECUPERACIONES ---
      {
        path: 'recuperaciones',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/recuperaciones/components/recuperaciones-list.component').then(m => m.RecuperacionesListComponent)
          },
          {
            path: 'nueva',
            loadComponent: () => import('./features/recuperaciones/components/recuperacion-form.component').then(m => m.RecuperacionFormComponent)
          },
          {
            path: ':id/editar',
            loadComponent: () => import('./features/recuperaciones/components/recuperacion-form.component').then(m => m.RecuperacionFormComponent)
          },
          {
            path: ':id',
            loadComponent: () => import('./features/recuperaciones/components/recuperacion-detail.component').then(m => m.RecuperacionDetailComponent)
          }
        ]
      },

      // --- CALIFICACIONES ---
      {
        path: 'calificaciones',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/calificaciones/components/calificaciones-panel.component').then(m => m.CalificacionesPanelComponent)
          },
          {
            path: 'acta',
            loadComponent: () => import('./features/calificaciones/components/acta-evaluacion.component').then(m => m.ActaEvaluacionComponent)
          }
        ]
      },

      // --- ASISTENCIA ---
      {
        path: 'asistencia',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/asistencia/components/asistencia-panel.component').then(m => m.AsistenciaPanelComponent)
          },
          {
            path: 'pasar-lista',
            loadComponent: () => import('./features/asistencia/components/pasar-lista.component').then(m => m.PasarListaComponent)
          },
          {
            path: 'resumen',
            loadComponent: () => import('./features/asistencia/components/asistencia-resumen.component').then(m => m.AsistenciaResumenComponent)
          },
          {
            path: 'mensual',
            loadComponent: () => import('./features/asistencia/components/asistencia-mensual.component').then(m => m.AsistenciaMensualComponent)
          }
        ]
      },

      // --- CUADERNO COMPLETO ---
      {
        path: 'cuaderno',
        loadComponent: () => import('./features/cuaderno/cuaderno-completo.component').then(m => m.CuadernoCompletoComponent)
      },

      // --- ORLA ---
      {
        path: 'orla',
        loadComponent: () => import('./features/orla/orla.component').then(m => m.OrlaComponent)
      },

      // --- INFORMES ---
      {
        path: 'informes',
        loadComponent: () => import('./features/informes/components/informes.component').then(m => m.InformesComponent)
      },

      // --- PROFESORES (solo admin) ---
      {
        path: 'profesores',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/components/profesores-list.component').then(m => m.ProfesoresListComponent)
      },

      // --- CONFIGURACIÓN ---
      {
        path: 'horario',
        loadComponent: () => import('./features/horario/horario.component').then(m => m.HorarioComponent)
      },
      {
        path: 'evaluaciones',
        loadComponent: () => import('./features/evaluaciones/periodos-evaluacion.component').then(m => m.PeriodosEvaluacionComponent)
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./features/auth/components/perfil.component').then(m => m.PerfilComponent)
      },

      // Backup

      { path: 'backup', loadComponent: () => import('./features/backup/backup.component').then(m => m.BackupComponent) },

      // Redirección por defecto
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // Wildcard
  { path: '**', redirectTo: '/login' }
];