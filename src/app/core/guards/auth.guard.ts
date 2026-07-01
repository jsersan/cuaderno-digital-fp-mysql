import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { Rol } from '@core/models';

// Guard: requiere estar autenticado
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (user) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};

// Guard: requiere rol de admin
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (user?.rol === Rol.ADMIN) return true;
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

// Guard: requiere ser profesor o admin
export const profesorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (user?.rol === Rol.PROFESOR || user?.rol === Rol.ADMIN || user?.rol === Rol.TUTOR) {
        return true;
      }
      router.navigate(['/login']);
      return false;
    })
  );
};

// Guard: redirigir si ya está logueado
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (!user) return true;
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
