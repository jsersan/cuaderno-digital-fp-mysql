<?php
// =============================================================================
//  DB.PHP  ·  Conexión PDO + repositorio genérico de documentos JSON
// =============================================================================

class DB
{
    private static ?PDO $pdo = null;
    private static array $cfg = [];

    public static function init(array $config): void
    {
        self::$cfg = $config;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = self::$cfg['db'];
            $dsn = "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset={$c['charset']}";
            self::$pdo = new PDO($dsn, $c['user'], $c['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    /** Comprueba que el nombre de colección está en la whitelist. */
    public static function assertCollection(string $name): void
    {
        if (!in_array($name, self::$cfg['collections'], true)) {
            Response::error(400, "Colección no permitida: $name");
        }
    }
}

// -----------------------------------------------------------------------------
//  Repositorio de documentos: cada fila = { id, data(JSON), created_at, updated_at }
//  Devuelve siempre objetos planos  { id, ...data }  (estilo Firestore).
// -----------------------------------------------------------------------------
class Repo
{
    /** Une los metadatos de fila + el JSON en un único objeto plano. */
    private static function hydrate(array $row): array
    {
        $data = json_decode($row['data'] ?? '{}', true) ?: [];
        $data['id'] = $row['id'];
        return $data;
    }

    public static function all(string $table): array
    {
        DB::assertCollection($table);
        $stmt = DB::pdo()->query("SELECT id, data FROM `$table`");
        return array_map([self::class, 'hydrate'], $stmt->fetchAll());
    }

    public static function get(string $table, string $id): ?array
    {
        DB::assertCollection($table);
        $stmt = DB::pdo()->prepare("SELECT id, data FROM `$table` WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::hydrate($row) : null;
    }

    /** Crea con id autogenerado (estilo push de Firestore: 20 chars). */
    public static function create(string $table, array $data): string
    {
        DB::assertCollection($table);
        $id = $data['id'] ?? self::pushId();
        unset($data['id']);
        if ($table === 'usuarios') { self::setUsuario($id, $data); return $id; }
        $stmt = DB::pdo()->prepare("INSERT INTO `$table` (id, data) VALUES (?, ?)");
        $stmt->execute([$id, json_encode($data, JSON_UNESCAPED_UNICODE)]);
        return $id;
    }

    /** Reemplaza el documento entero (PUT / setDoc). Upsert. */
    public static function set(string $table, string $id, array $data): void
    {
        DB::assertCollection($table);
        unset($data['id']);
        if ($table === 'usuarios') { self::setUsuario($id, $data); return; }
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        $stmt = DB::pdo()->prepare(
            "INSERT INTO `$table` (id, data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)"
        );
        $stmt->execute([$id, $json]);
    }

    /** Upsert para usuarios: mantiene la columna email sincronizada y NO toca password_hash. */
    private static function setUsuario(string $id, array $data): void
    {
        $email = $data['email'] ?? ($id . '@local');
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        $stmt = DB::pdo()->prepare(
            "INSERT INTO usuarios (id, email, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email), data = VALUES(data)"
        );
        $stmt->execute([$id, $email, $json]);
    }

    /** Fusiona campos en el documento existente (PATCH / updateDoc). */
    public static function merge(string $table, string $id, array $data): void
    {
        DB::assertCollection($table);
        unset($data['id']);
        $current = self::get($table, $id) ?? [];
        unset($current['id']);
        $merged = array_merge($current, $data);
        self::set($table, $id, $merged);
    }

    public static function delete(string $table, string $id): void
    {
        DB::assertCollection($table);
        $stmt = DB::pdo()->prepare("DELETE FROM `$table` WHERE id = ?");
        $stmt->execute([$id]);
    }

    /**
     * Consulta con filtros sobre campos del JSON.
     *  $filters: [ ['field'=>..,'op'=>'==','value'=>..], ... ]
     *  $orderBy: [ ['field'=>..,'dir'=>'asc'|'desc'], ... ]
     *  $limit:   int|null
     */
    public static function query(string $table, array $filters, array $orderBy, ?int $limit): array
    {
        DB::assertCollection($table);
        $where = [];
        $params = [];

        foreach ($filters as $f) {
            $field = $f['field'] ?? null;
            $op    = $f['op'] ?? '==';
            $val   = $f['value'] ?? null;
            if ($field === null) continue;
            $path = '$.' . str_replace('`', '', $field);
            $expr = "JSON_UNQUOTE(JSON_EXTRACT(`data`, " . DB::pdo()->quote($path) . "))";

            switch ($op) {
                case '==':  $where[] = "$expr = ?";  $params[] = self::scalar($val); break;
                case '!=':  $where[] = "$expr <> ?"; $params[] = self::scalar($val); break;
                case '<':   $where[] = "CAST($expr AS DECIMAL(20,6)) < ?";  $params[] = $val; break;
                case '<=':  $where[] = "CAST($expr AS DECIMAL(20,6)) <= ?"; $params[] = $val; break;
                case '>':   $where[] = "CAST($expr AS DECIMAL(20,6)) > ?";  $params[] = $val; break;
                case '>=':  $where[] = "CAST($expr AS DECIMAL(20,6)) >= ?"; $params[] = $val; break;
                case 'in':
                    $vals = is_array($val) ? $val : [$val];
                    $ph = implode(',', array_fill(0, count($vals), '?'));
                    $where[] = "$expr IN ($ph)";
                    foreach ($vals as $v) $params[] = self::scalar($v);
                    break;
                case 'array-contains':
                    $where[] = "JSON_CONTAINS(JSON_EXTRACT(`data`, " . DB::pdo()->quote('$.' . $field) . "), ?)";
                    $params[] = json_encode($val, JSON_UNESCAPED_UNICODE);
                    break;
                default:
                    $where[] = "$expr = ?"; $params[] = self::scalar($val);
            }
        }

        $sql = "SELECT id, data FROM `$table`";
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);

        if ($orderBy) {
            $parts = [];
            foreach ($orderBy as $o) {
                $field = str_replace('`', '', $o['field'] ?? '');
                if ($field === '') continue;
                $dir = (strtolower($o['dir'] ?? 'asc') === 'desc') ? 'DESC' : 'ASC';
                $parts[] = "JSON_UNQUOTE(JSON_EXTRACT(`data`, " . DB::pdo()->quote('$.' . $field) . ")) $dir";
            }
            if ($parts) $sql .= ' ORDER BY ' . implode(', ', $parts);
        }

        if ($limit !== null && $limit > 0) $sql .= ' LIMIT ' . (int) $limit;

        $stmt = DB::pdo()->prepare($sql);
        $stmt->execute($params);
        return array_map([self::class, 'hydrate'], $stmt->fetchAll());
    }

    /** Convierte bool/num a la representación textual que guarda JSON_UNQUOTE. */
    private static function scalar($v): string
    {
        if (is_bool($v))  return $v ? 'true' : 'false';
        if (is_null($v))  return '';
        return (string) $v;
    }

    /** Genera un ID pseudo-aleatorio de 20 caracteres (estilo Firestore). */
    public static function pushId(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        $id = '';
        for ($i = 0; $i < 20; $i++) $id .= $chars[random_int(0, strlen($chars) - 1)];
        return $id;
    }
}

// -----------------------------------------------------------------------------
//  Subdocumentos (subcolecciones tipo backups/{id}/fragmentos)
// -----------------------------------------------------------------------------
class SubRepo
{
    public static function all(string $path): array
    {
        $stmt = DB::pdo()->prepare("SELECT id, data FROM subdocumentos WHERE path = ?");
        $stmt->execute([$path]);
        return array_map(function ($r) {
            $d = json_decode($r['data'], true) ?: [];
            $d['id'] = $r['id'];
            return $d;
        }, $stmt->fetchAll());
    }

    public static function get(string $path, string $id): ?array
    {
        $stmt = DB::pdo()->prepare("SELECT id, data FROM subdocumentos WHERE path = ? AND id = ?");
        $stmt->execute([$path, $id]);
        $r = $stmt->fetch();
        if (!$r) return null;
        $d = json_decode($r['data'], true) ?: [];
        $d['id'] = $r['id'];
        return $d;
    }

    public static function set(string $path, string $id, array $data): void
    {
        unset($data['id']);
        $stmt = DB::pdo()->prepare(
            "INSERT INTO subdocumentos (path, id, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)"
        );
        $stmt->execute([$path, $id, json_encode($data, JSON_UNESCAPED_UNICODE)]);
    }

    public static function delete(string $path, string $id): void
    {
        $stmt = DB::pdo()->prepare("DELETE FROM subdocumentos WHERE path = ? AND id = ?");
        $stmt->execute([$path, $id]);
    }
}
