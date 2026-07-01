-- =============================================================================
--  CUADERNO DIGITAL FP EUSKADI  ·  Esquema MySQL  (modelo documento-en-JSON)
-- =============================================================================
--  Una tabla por colección de Firestore. Cada documento se guarda como:
--    id (string, el mismo ID que tenías en Firestore)  +  data (JSON)  +  fechas
--  Esto preserva los arrays embebidos (matriculas[], entregas[], notasPorRA[]...)
--  sin reescribir los componentes que los consumen.
--
--  Motor: InnoDB · utf8mb4 · MySQL 5.7+ / 8.0  (MAMP)
--  Importar:  mysql -u root -p -h 127.0.0.1 -P 8889 < cuaderno_digital_fp.sql
--             (puerto MySQL por defecto en MAMP = 8889; usuario root / pass root)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `cuaderno_digital_fp`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cuaderno_digital_fp`;

-- -----------------------------------------------------------------------------
--  USUARIOS (profesores)  ·  tabla especial: incluye credenciales de login
--  Antes el login lo hacía Firebase Auth. Ahora vive aquí (password_hash).
--  El campo data guarda el resto del perfil (rol, modulosIds[], configuracion...).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`            VARCHAR(64)  NOT NULL,          -- uid (mantiene el UID previo)
  `email`         VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,      -- bcrypt (password_hash de PHP)
  `data`          JSON         NOT NULL,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  COLECCIONES DE DATOS  (una tabla por colección)
--  Plantilla idéntica para todas: id (string) + data (JSON) + fechas.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `centros` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ciclos` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `modulos` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grupos` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `alumnos` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tareas` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `examenes` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recuperaciones` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calificaciones` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asistencia` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asistencia_mensual` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cuadernos_generados` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `observaciones` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `periodos_evaluacion` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `eventos_programacion` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orlas` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backups` (
  `id` VARCHAR(64) NOT NULL, `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  SUBDOCUMENTOS  ·  para subcolecciones tipo  backups/{id}/fragmentos/{n}
--  Se identifican por su ruta completa (path) + id.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subdocumentos` (
  `path`       VARCHAR(255) NOT NULL,    -- p.ej. 'backups/ABC123/fragmentos'
  `id`         VARCHAR(64)  NOT NULL,
  `data`       JSON         NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`path`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
--  ÍNDICES OPCIONALES (solo MySQL 8.0.13+).  Aceleran los where() más usados.
--  Descoméntalos si tu MAMP usa MySQL 8. En 5.7 déjalos comentados.
-- -----------------------------------------------------------------------------
-- ALTER TABLE `alumnos`  ADD INDEX idx_alu_grupo  ((CAST(`data`->>'$.grupoId'  AS CHAR(64))));
-- ALTER TABLE `alumnos`  ADD INDEX idx_alu_centro ((CAST(`data`->>'$.centroId' AS CHAR(64))));
-- ALTER TABLE `grupos`   ADD INDEX idx_gru_centro ((CAST(`data`->>'$.centroId' AS CHAR(64))));
-- ALTER TABLE `grupos`   ADD INDEX idx_gru_ciclo  ((CAST(`data`->>'$.cicloId'  AS CHAR(64))));
-- ALTER TABLE `modulos`  ADD INDEX idx_mod_ciclo  ((CAST(`data`->>'$.cicloId'  AS CHAR(64))));
-- ALTER TABLE `tareas`   ADD INDEX idx_tar_modulo ((CAST(`data`->>'$.moduloId' AS CHAR(64))));
-- ALTER TABLE `examenes` ADD INDEX idx_exa_modulo ((CAST(`data`->>'$.moduloId' AS CHAR(64))));

-- =============================================================================
--  SEMILLA MÍNIMA: un usuario admin para poder entrar.
--  La contraseña se establece con el script  seed-admin.php  (bcrypt).
--  No se inserta el hash aquí en texto plano por seguridad.
-- =============================================================================
