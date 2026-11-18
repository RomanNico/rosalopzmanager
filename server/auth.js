/**
 * ROSALOPZManager - Autenticación
 * - Contraseñas con scrypt (hash + sal aleatoria, incluido en Node, sin dependencias)
 * - Tokens de sesión firmados con HMAC-SHA256
 */
const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;
const PREFIX = 'scrypt$';

const scryptAsync = (password, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
});

/** Devuelve 'scrypt$<sal>$<hash>' */
const hashPassword = async (plain) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scryptAsync(String(plain), salt);
  return `${PREFIX}${salt}$${key.toString('hex')}`;
};

/** Contraseña temporal fácil de dictar, p. ej. "Bufalo-7KQ4XZ" (sin 0/O ni 1/I/L para no confundir) */
const generarTemporal = () => {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alfabeto[crypto.randomInt(alfabeto.length)];
  return `Bufalo-${s}`;
};

const isHashed = (stored) => typeof stored === 'string' && stored.startsWith(PREFIX);

/**
 * Verifica una contraseña.
 * Acepta también formatos antiguos (Base64 de la versión anterior, o texto plano puesto
 * a mano desde pgAdmin). En ese caso devuelve legacy: true para re-guardarla con hash.
 */
const verifyPassword = async (stored, plain) => {
  if (!stored || typeof plain !== 'string') return { ok: false };

  if (isHashed(stored)) {
    const [, salt, hashHex] = stored.split('$');
    if (!salt || !hashHex) return { ok: false };
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scryptAsync(plain, salt);
    return { ok: expected.length === actual.length && crypto.timingSafeEqual(expected, actual) };
  }

  const asBase64 = Buffer.from(plain, 'latin1').toString('base64');
  const ok = safeEqual(stored, asBase64) || safeEqual(stored, plain);
  return { ok, legacy: ok };
};

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/* ---------- Tokens ---------- */
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
let secret = (process.env.AUTH_SECRET || '').trim();
// El texto de .env.example es público (está en git): usarlo permitiría falsificar sesiones
const esInseguro = !secret || secret.length < 32 || /cambia_esto/i.test(secret);
if (esInseguro) {
  if (secret) console.warn('⚠️  AUTH_SECRET en .env es el texto de ejemplo o es muy corto (mínimo 32 caracteres): se ignora.');
  else console.warn('⚠️  AUTH_SECRET no está en .env.');
  console.warn('   Se usará una clave aleatoria temporal: las sesiones se cerrarán cada vez que reinicies el servidor.');
  console.warn('   Para generar una: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  secret = crypto.randomBytes(32).toString('hex');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

const createToken = (userId) => {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }));
  return `${payload}.${sign(payload)}`;
};

/** Devuelve el id del usuario o null si el token es inválido/expiró */
const readToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return Number.isInteger(data.uid) ? data.uid : null;
  } catch {
    return null;
  }
};

/* ---------- Límite de intentos de login ---------- */
const MAX_INTENTOS = 8;
const BLOQUEO_MS = 10 * 60 * 1000;
const intentos = new Map(); // email -> { count, until }

const loginBloqueado = (email) => {
  const r = intentos.get(email);
  if (!r) return 0;
  if (r.until && r.until > Date.now()) return Math.ceil((r.until - Date.now()) / 60000);
  if (r.until && r.until <= Date.now()) intentos.delete(email);
  return 0;
};
const registrarFallo = (email) => {
  const r = intentos.get(email) || { count: 0, until: 0 };
  r.count += 1;
  if (r.count >= MAX_INTENTOS) { r.until = Date.now() + BLOQUEO_MS; r.count = 0; }
  intentos.set(email, r);
};
const limpiarFallos = (email) => intentos.delete(email);

module.exports = {
  hashPassword, verifyPassword, isHashed, generarTemporal,
  createToken, readToken,
  loginBloqueado, registrarFallo, limpiarFallos,
};
