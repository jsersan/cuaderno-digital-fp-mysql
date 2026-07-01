# Migración de Firebase a MySQL — Cuaderno Digital FP

Esta versión sustituye **Firebase/Firestore** por **MySQL + una API REST en PHP**
(pensada para correr en **MAMP**, sin instalar nada extra). El frontend Angular
apenas cambia: se ha sustituido `@angular/fire` por un *shim* compatible
(`src/app/core/firebase-shim.ts`) que habla con la API REST.

> ✅ Verificado: el proyecto compila con `ng build` (Angular 17).
> ⚠️ No se ha probado en ejecución contra una BBDD real; pueden hacer falta
> ajustes menores de configuración (puertos, ruta del backend).

---

## Arquitectura

```
Angular (shim REST)  ⇄  API PHP (backend-php/)  ⇄  MySQL (una tabla por colección)
```

- Cada colección de Firestore es una **tabla** con columnas `id` (string) + `data` (JSON)
  + `created_at` / `updated_at`. Esto conserva los arrays embebidos
  (`matriculas[]`, `entregas[]`, `notasPorRA[]`, …) sin reescribir los componentes.
- Los **IDs string** de Firestore se mantienen tal cual.
- Las subcolecciones (p. ej. `backups/{id}/fragmentos`) van a la tabla `subdocumentos`.
- **Login**: ya no usa Firebase Auth. Las credenciales viven en la tabla `usuarios`
  (`password_hash` con bcrypt) y se emite un token firmado que el shim adjunta como
  `Authorization: Bearer …`.

### Cambios de comportamiento a tener en cuenta
- **Sin *realtime***: `collectionData` / `docData` hacen una lectura única (no streaming).
  Los listados se refrescan al recargar o tras cada operación (los componentes ya
  quitaban/añadían en local por inmediatez).
- **Acceso con Google** y **restablecer contraseña por email**: no disponibles con el
  backend local (lanzan un aviso). Se crean profesores con email+contraseña.
- **Paginación por cursor** (`startAfter`): se ignora (devuelve la primera página).

---

## Puesta en marcha (MAMP, local)

### 1. Crear la base de datos
En phpMyAdmin (Importar) o por terminal:
```bash
/Applications/MAMP/Library/bin/mysql -u root -p -h 127.0.0.1 -P 8889 \
  < backend-php/sql/cuaderno_digital_fp.sql
```
(MAMP: MySQL suele estar en el puerto **8889**, usuario `root`, contraseña `root`.)

### 2. Copiar el backend a MAMP
Copia la carpeta `backend-php/` dentro de `htdocs` de MAMP y renómbrala
`cuaderno-backend` (o el nombre que prefieras):
```
/Applications/MAMP/htdocs/cuaderno-backend/
```
Revisa `cuaderno-backend/config.php` y ajusta credenciales/puerto si tu MAMP
usa otros. El Apache de MAMP suele servir en el puerto **8888**, así que la API
quedará en:  `http://localhost:8888/cuaderno-backend`
(ya configurado en `src/environments/environment.ts`).

### 3. Crear el usuario administrador
```bash
cd /Applications/MAMP/htdocs/cuaderno-backend
/Applications/MAMP/bin/php/php8.x.x/bin/php seed-admin.php \
  jsersan@gmail.com "TU_CONTRASEÑA" "Txema" "Serrano" 21m6mMuCAieZ7ZpcR2xfm9kH9yc2
```

### 4. (Opcional) Importar tus datos existentes
Tus backups JSON de Firestore son arrays de documentos. Cárgalos por colección:
```bash
php importar.php alumnos ../alumnos-backup-2026-06-21T15-51-54-422Z.json
php importar.php grupos  ../grupos-borrados-backup-2026-06-21T16-04-50-250Z.json
# …una llamada por cada colección/fichero
```
(Para `usuarios`, `importar.php` NO fija contraseñas; usa `seed-admin.php` o el
registro desde la app.)

### 5. Arrancar Angular
```bash
npm install
npm start        # ng serve en http://localhost:4200
```

---

## API REST (resumen)

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/auth/login` | `{email,password}` → `{token,user}` |
| POST | `/auth/register` | crea usuario → `{token,user}` |
| GET | `/auth/me` | usuario del token |
| GET | `/{coleccion}` | todos los documentos |
| POST | `/{coleccion}:query` | `{filters,orderBy,limit}` |
| POST | `/{coleccion}` | crear (id autogenerado) |
| GET | `/{coleccion}/{id}` | un documento |
| PUT | `/{coleccion}/{id}` | reemplazar |
| PATCH | `/{coleccion}/{id}` | fusionar |
| DELETE | `/{coleccion}/{id}` | borrar |

Todas las rutas de datos requieren `Authorization: Bearer <token>`.

---

## Notas de seguridad (para localhost / despliegue)
- El secreto de firma de tokens está en `config.php` (`jwt_secret`): **cámbialo**.
- El endpoint `/auth/register` está abierto (para que el panel de admin pueda crear
  profesores). Si despliegas en producción, conviene protegerlo (exigir rol admin).
- Sirve la API por **HTTPS** en producción (en `environment.prod.ts` ya apunta a
  `https://txemaserrano.com/cuaderno-backend`).
- Las claves `serviceAccount.json` de los scripts Node siguen siendo de Firebase;
  no son necesarias para esta versión MySQL.

## Qué se ha tocado en el frontend
- **Nuevo**: `src/app/core/firebase-shim.ts` (reemplazo de `@angular/fire/firestore`).
- **Reescrito**: `src/app/core/services/auth.service.ts` (login contra la API).
- **Reescrito**: `src/app/app.config.ts` (sin providers de Firebase).
- **Actualizado**: `src/environments/environment*.ts` (campo `apiUrl`).
- **Import-swap** `@angular/fire/firestore` → `@core/firebase-shim` en ~23 ficheros.
- **Adaptado**: creación de profesores en los dos `profesores-list` (de Firebase Auth
  REST a `/auth/register`).
- `package.json`: fuera `@angular/fire` y `firebase` (se mantiene `firebase-admin`
  para los scripts de `scripts/`).
