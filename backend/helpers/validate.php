<?php
// ============================================================
//  MODAICA — Input Validation Yardımcıları
//  Kullanım:
//    $name  = vString($body['name'] ?? '', 2, 100) ?? badRequest('Ad gerekli.');
//    $email = vEmail($body['email'] ?? '')         ?? badRequest('E-posta hatalı.');
//    $page  = vInt($body['page']   ?? 1, 1, 1000)  ?? 1;
// ============================================================

function vString(mixed $val, int $min = 1, int $max = 255): ?string {
    if (!is_string($val) && !is_numeric($val)) return null;
    $v = trim((string)$val);
    $len = mb_strlen($v, 'UTF-8');
    return ($len >= $min && $len <= $max) ? $v : null;
}

function vEmail(mixed $val): ?string {
    $e = filter_var(trim((string)($val ?? '')), FILTER_VALIDATE_EMAIL);
    return $e !== false ? strtolower($e) : null;
}

function vInt(mixed $val, int $min = 0, int $max = PHP_INT_MAX): ?int {
    $i = filter_var($val, FILTER_VALIDATE_INT);
    return ($i !== false && (int)$i >= $min && (int)$i <= $max) ? (int)$i : null;
}

function vFloat(mixed $val, float $min = 0.0, float $max = PHP_FLOAT_MAX): ?float {
    $f = filter_var($val, FILTER_VALIDATE_FLOAT);
    return ($f !== false && (float)$f >= $min && (float)$f <= $max) ? (float)$f : null;
}

function vSlug(mixed $val, int $maxLen = 100): ?string {
    $v = vString($val, 1, $maxLen);
    return ($v !== null && preg_match('/^[a-z0-9\-_]+$/i', $v)) ? $v : null;
}

function vEnum(mixed $val, array $allowed): mixed {
    return in_array($val, $allowed, true) ? $val : null;
}

/**
 * Birden fazla alanı doğrula, ilk hatayla badRequest() ile çık.
 *
 * $rules = [
 *   'name'  => ['string', 'min' => 2, 'max' => 100],
 *   'email' => 'email',
 *   'age'   => ['int', 'min' => 18, 'max' => 120],
 * ]
 */
function validateFields(array $body, array $rules): void {
    foreach ($rules as $field => $rule) {
        $val  = $body[$field] ?? null;
        $type = is_array($rule) ? ($rule[0] ?? 'string') : $rule;
        $opts = is_array($rule) ? $rule : [];

        $ok = match($type) {
            'string' => vString($val, $opts['min'] ?? 1,   $opts['max'] ?? 255) !== null,
            'email'  => vEmail($val)                                              !== null,
            'int'    => vInt($val,   $opts['min'] ?? 0,    $opts['max'] ?? PHP_INT_MAX) !== null,
            'float'  => vFloat($val, $opts['min'] ?? 0.0,  $opts['max'] ?? PHP_FLOAT_MAX) !== null,
            'slug'   => vSlug($val,  $opts['max'] ?? 100)  !== null,
            'enum'   => vEnum($val,  $opts['values'] ?? []) !== null,
            default  => true,
        };

        if (!$ok) badRequest("'$field' alanı geçersiz veya eksik.");
    }
}
