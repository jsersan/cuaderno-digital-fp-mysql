# Cuaderno Digital FP · Euskadi (versión MySQL)
 
Aplicación web de gestión integral para **Formación Profesional** en Euskadi:
cuadernos por módulo, alumnado, tareas, exámenes, recuperaciones, calificaciones
por RA/CE, asistencia, programación, horarios, orlas e informes, con interfaz
bilingüe (castellano / euskera).
 
Esta versión sustituye **Firebase / Firestore** por un backend propio de
**MySQL + API REST en PHP**, pensado para funcionar en local con **MAMP** y
desplegable en cualquier hosting con PHP + MySQL.
 
> Es la variante MySQL del proyecto original en Firebase. El frontend Angular se
> mantiene prácticamente igual gracias a una capa de compatibilidad
> (`firebase-shim.ts`) que reemplaza `@angular/fire` hablando con la API REST.
 
---
 
## Arquitectura
 
```
Angular 17  ──►  firebase-shim.ts  ──►  API REST (PHP)  ──►  MySQL
  (SPA)          (capa compat.)         backend-php/         (1 tabla por colección)
```
 
- **Modelo de datos documental sobre MySQL:** cada colección de Firestore es una
  tabla con `id` (string) + `data` (JSON) + `created_at` / `updated_at`. Esto
  conserva los arrays embebidos (`matriculas[]`, `entregas[]`, `notasPorRA[]`,
  `registros[]`…) sin reescribir los componentes.
- **IDs de Firestore preservados:** se mantienen los mismos identificadores string.
- **Autenticación propia:** las credenciales viven en la tabla `usuarios`
  (`password_hash` con bcrypt) y se emite un token firmado (HMAC) que el frontend
  adjunta en cada petición como `Authorization: Bearer …`.
- **Subcolecciones** (p. ej. `backups/{id}/fragmentos`) se guardan en la tabla
  `subdocumentos`, identificadas por su ruta completa.
### Diferencias respecto a la versión Firebase
 
- **Sin *realtime*:** `collectionData` / `docData` hacen una lectura HTTP puntual
  (no streaming en vivo). Suficiente para un cuaderno CRUD.
- **Acceso con Google** y **restablecer contraseña por email:** deshabilitados
  (dependían de Firebase Auth). El login es por email + contraseña.
- **Paginación por cursor** (`startAfter`): se ignora (devuelve la primera página).
---
 
## Stack
 
- **Frontend:** Angular 17.3 · Angular Material · ngx-translate · jsPDF · SheetJS · FullCalendar
- **Backend:** PHP 7/8 (sin frameworks ni dependencias externas) · PDO
- **Base de datos:** MySQL / MariaDB (InnoDB · utf8mb4)
- **Entorno local:** MAMP · Node 20+ · npm
---
 
## Estructura del proyecto
 
```
cuaderno-digital-fp-mysql/
├── src/                              # Aplicación Angular
│   ├── app/core/firebase-shim.ts     # ← reemplazo de @angular/fire (REST)
│   ├── app/core/services/            # servicios (auth.service.ts reescrito)
│   ├── app/app.config.ts             # sin providers de Firebase
│   └── environments/                 # apiUrl del backend
├── backend-php/                      # API REST + scripts CLI
│   ├── index.php                     # front controller / router
│   ├── config.php                    # credenciales MySQL, CORS, colecciones
│   ├── db.php                        # PDO + repositorio de documentos JSON
│   ├── helpers.php                   # respuestas, CORS, tokens
│   ├── routes_auth.php               # /auth/login · /auth/register · /auth/me
│   ├── seed-admin.php                # crea un admin nuevo (CLI)
│   ├── set-password.php              # pone contraseña a un usuario por email (CLI)
│   ├── importar.php                  # importa un backup JSON a una tabla (CLI)
│   └── sql/cuaderno_digital_fp.sql   # esquema (crea BBDD y tablas)
└── scripts/
    └── firebase-to-mysql.mjs         # volcado directo de Firestore → MySQL
```
 
---
 
## Puesta en marcha (local, MAMP)
 
### 1. Crear la base de datos
 
En phpMyAdmin (Importar) o por terminal (MySQL de MAMP suele estar en el 8889):
 
```bash
/Applications/MAMP/Library/bin/mysql -u root -p -h 127.0.0.1 -P 8889 \
  < backend-php/sql/cuaderno_digital_fp.sql
```
 
### 2. Publicar el backend
 
Copia `backend-php/` dentro de `htdocs` de MAMP (o déjalo dentro del proyecto si
el proyecto ya está en `htdocs`). Revisa las credenciales en `config.php`
(por defecto MAMP: `root` / `root`, puerto `8889`).
 
### 3. Configurar la URL de la API
 
En `src/environments/environment.ts`, apunta `apiUrl` a tu backend. Se usa el
formato `index.php?path=…`, que funciona **con o sin `mod_rewrite`**:
 
```ts
apiUrl: 'http://localhost:8888/RUTA/backend-php/index.php',
```
 
### 4. Crear el usuario administrador
 
```bash
cd backend-php
PHP=/Applications/MAMP/bin/php/php8.2.0/bin/php   # ajusta a tu versión
$PHP seed-admin.php admin@tudominio.com "TuContraseña" "Nombre" "Apellidos"
```
 
### 5. Arrancar la aplicación
 
```bash
npm install
npm start          # ng serve → http://localhost:4200
```
 
---
 
## Migrar los datos desde Firestore
 
El script `scripts/firebase-to-mysql.mjs` vuelca todas las colecciones de
Firestore a MySQL, convirtiendo los `Timestamp` al formato `{ seconds, nanoseconds }`.
 
Requisitos: `serviceAccount.json` (clave de servicio de Firebase) en `scripts/`
y las dependencias `firebase-admin` (ya incluida) y `mysql2`.
 
```bash
npm install mysql2
 
# Dry-run: solo cuenta documentos
node scripts/firebase-to-mysql.mjs
 
# Volcado real (idempotente, upsert)
node scripts/firebase-to-mysql.mjs --commit
 
# Opciones
node scripts/firebase-to-mysql.mjs --commit --only=alumnos,grupos
node scripts/firebase-to-mysql.mjs --key=otra-clave.json
```
 
> Firestore no guardaba contraseñas (las tenía Firebase Auth), así que los
> profesores migrados entran sin contraseña. Asígnalas con `set-password.php`.
 
### Contraseñas de los profesores
 
```bash
$PHP set-password.php profesor@centro.eus "ContraseñaTemporal"
```
 
Cada profesor entra con su email y su contraseña, y verá sus propios cuadernos
(los módulos se asocian al profesor por su `uid`, que es el mismo que en Firestore).
 
---
 
## API REST (resumen)
 
Todas las rutas de datos requieren `Authorization: Bearer <token>`.
 
| Método | Ruta                       | Acción                          |
|--------|----------------------------|---------------------------------|
| POST   | `/auth/login`              | `{email,password}` → `{token,user}` |
| POST   | `/auth/register`           | crea usuario → `{token,user}`   |
| GET    | `/auth/me`                 | usuario del token               |
| GET    | `/{coleccion}`             | todos los documentos            |
| POST   | `/{coleccion}:query`       | `{filters,orderBy,limit}`       |
| POST   | `/{coleccion}`             | crear (id autogenerado)         |
| GET    | `/{coleccion}/{id}`        | un documento                    |
| PUT    | `/{coleccion}/{id}`        | reemplazar                      |
| PATCH  | `/{coleccion}/{id}`        | fusionar                        |
| DELETE | `/{coleccion}/{id}`        | borrar                          |
 
**Colecciones:** `usuarios`, `centros`, `ciclos`, `modulos`, `grupos`, `alumnos`,
`tareas`, `examenes`, `recuperaciones`, `calificaciones`, `asistencia`,
`asistencia_mensual`, `observaciones`, `periodos_evaluacion`,
`eventos_programacion`, `orlas`, `backups`, `cuadernos_generados`.
 
---
 
## Despliegue
 
1. Sube `backend-php/` a un hosting con PHP + MySQL e importa el `.sql`.
2. Ajusta `config.php` (host, puerto, usuario, contraseña, nombre de BBDD) y
   añade el origen del frontend a `cors_origins`.
3. Compila el frontend con `environment.prod.ts` apuntando al `apiUrl` del backend
   (`npm run build:prod`) y publica el contenido de `dist/`.
---
 
## Seguridad y protección de datos
 
- Cambia `jwt_secret` en `config.php` por una cadena larga y aleatoria.
- Sirve la API por **HTTPS** en producción.
- El endpoint `/auth/register` está abierto (para que el panel de admin cree
  profesores). Si despliegas de cara a producción, conviene protegerlo por rol.
- **Datos personales:** la aplicación gestiona datos reales de alumnado (a menudo
  menores). Trátalos conforme al RGPD: hosting en la UE, copias de seguridad, y
  para demos públicas usa datos **anonimizados**.
- **No subas claves a Git:** `serviceAccount.json` y cualquier fichero de
  credenciales deben quedar fuera del control de versiones (`.gitignore`).
---
 
## Notas
 
- El script `deploy` (`firebase deploy`) del `package.json` es un resto de la
  versión Firebase y ya no aplica en esta variante MySQL.
- Autoría y uso docente: José María Serrano (CIFP Zornotza).
