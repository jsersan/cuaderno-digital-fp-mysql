import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject } from 'rxjs';
import { Usuario, Rol, ConfiguracionUsuario } from '@core/models';
import { environment } from '@env/environment';
import { TOKEN_KEY, buildUrl } from '@core/firebase-shim';

// ============================================================================
//  AuthService  ·  Autenticación contra la API REST (MySQL), sin Firebase.
//  El token se guarda en localStorage (TOKEN_KEY) y el shim lo adjunta en
//  cada petición como cabecera Authorization: Bearer.
// ============================================================================

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private base = (environment as any).apiUrl?.replace(/\/$/, '') || '';

  private currentUserSubject = new BehaviorSubject<Usuario | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Si hay token guardado, restaurar la sesión consultando /auth/me.
    const token = this.getToken();
    if (token) {
      this.fetchJson('GET', 'auth/me')
        .then(user => this.currentUserSubject.next(user as Usuario))
        .catch(() => this.clearToken());
    }
  }

  // ---------- Getters de estado ----------
  get currentUser(): Usuario | null {
    return this.currentUserSubject.value;
  }
  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }
  get isAdmin(): boolean {
    return this.currentUser?.rol === Rol.ADMIN;
  }
  get isProfesor(): boolean {
    return this.currentUser?.rol === Rol.PROFESOR || this.isAdmin;
  }

  // ---------- Login / Registro / Logout ----------
  async login(email: string, password: string): Promise<void> {
    try {
      const res = await this.fetchJson('POST', 'auth/login', { email, password });
      this.setToken(res.token);
      this.currentUserSubject.next(res.user as Usuario);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * El acceso con Google requería Firebase. Con el backend local no está
   * disponible; se mantiene el método para no romper la pantalla de login.
   */
  async loginConGoogle(): Promise<void> {
    throw new Error('El acceso con Google no está disponible con el servidor local. Usa email y contraseña.');
  }

  async register(email: string, password: string, userData: Partial<Usuario>): Promise<void> {
    try {
      const res = await this.fetchJson('POST', 'auth/register', {
        email,
        password,
        nombre: userData.nombre || '',
        apellidos: userData.apellidos || '',
        rol: userData.rol || Rol.PROFESOR,
        centroId: userData.centroId || 'default'
      });
      this.setToken(res.token);
      this.currentUserSubject.next(res.user as Usuario);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  async logout(): Promise<void> {
    this.clearToken();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * El reseteo por email requería Firebase. En el backend local no hay envío de
   * correo: avisa al usuario de que contacte con el administrador.
   */
  async resetPassword(_email: string): Promise<void> {
    throw new Error('El restablecimiento por email no está disponible con el servidor local. Contacta con el administrador para cambiar tu contraseña.');
  }

  // ---------- Perfil ----------
  async updateUserProfile(data: Partial<Usuario>): Promise<void> {
    const user = this.currentUser;
    if (!user?.uid && !user?.id) throw new Error('No hay usuario activo');
    const uid = user.uid || user.id!;
    await this.fetchJson('PATCH', `usuarios/${uid}`, { ...data, updatedAt: new Date() });
    this.currentUserSubject.next({ ...user, ...data } as Usuario);
  }

  async updateConfiguracion(config: Partial<ConfiguracionUsuario>): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    const newConfig = { ...user.configuracion, ...config };
    await this.updateUserProfile({ configuracion: newConfig } as any);
  }

  // ---------- Token ----------
  private getToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  }
  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  }
  private clearToken(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }

  // ---------- HTTP helper ----------
  private async fetchJson(method: string, path: string, body?: any): Promise<any> {
    const token = this.getToken();
    const res = await fetch(buildUrl(this.base, path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json().catch(() => null);
  }

  private handleAuthError(error: any): Error {
    if (error?.status === 401) return new Error('Email o contraseña incorrectos.');
    if (error?.status === 403) return new Error(error.message || 'Cuenta desactivada.');
    if (error?.status === 409) return new Error('Este email ya está registrado.');
    return new Error(error?.message || 'Error de autenticación.');
  }
}
