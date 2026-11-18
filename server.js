require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool, types } = require('pg');
const path = require('path');
const Auth = require('./server/auth');

// NUMERIC -> number (por defecto pg lo devuelve como string)
types.setTypeParser(1700, (val) => parseFloat(val));
// DATE -> 'YYYY-MM-DD' tal cual (por defecto pg lo convierte a Date en UTC y corre el día)
types.setTypeParser(1082, (val) => val);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir SOLO los archivos del frontend (no exponer server.js, seed.js, docs, etc.)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true'
});

/* ==============================
   ESQUEMA
============================== */
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'empleado',
      cargo TEXT,
      telefono TEXT,
      direccion TEXT,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS catalogo (
      id SERIAL PRIMARY KEY,
      referencia TEXT,
      nombre TEXT,
      tallas JSONB,
      colores JSONB,
      suela TEXT,
      material TEXT,
      precio NUMERIC,
      descripcion TEXT,
      foto TEXT,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS inventario (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      cantidad INTEGER DEFAULT 0,
      unidad TEXT,
      proveedor TEXT,
      precio_unitario NUMERIC,
      stock_minimo INTEGER DEFAULT 10,
      categoria TEXT,
      fecha_actualizacion DATE DEFAULT CURRENT_DATE
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id SERIAL PRIMARY KEY,
      descripcion TEXT,
      usuario_id INTEGER,
      asignado_por INTEGER,
      estado TEXT DEFAULT 'pendiente',
      prioridad TEXT DEFAULT 'media',
      fecha_vencimiento DATE,
      fecha_creacion DATE DEFAULT CURRENT_DATE,
      categoria TEXT,
      catalogo_id INTEGER,
      talla INTEGER,
      color TEXT,
      cantidad_pares INTEGER,
      etapa_actual TEXT DEFAULT 'corte',
      historial_etapas JSONB DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS nominas (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER,
      salario NUMERIC,
      deducciones NUMERIC DEFAULT 0,
      bonificaciones NUMERIC DEFAULT 0,
      fecha DATE,
      semana INTEGER,
      ano INTEGER,
      estado TEXT DEFAULT 'pendiente',
      medio_pago TEXT,
      comprobante TEXT
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id SERIAL PRIMARY KEY,
      para_usuario_id INTEGER,
      tipo TEXT,
      titulo TEXT,
      mensaje TEXT,
      tarea_id INTEGER,
      leida BOOLEAN DEFAULT false,
      fecha TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS reportes (
      id SERIAL PRIMARY KEY,
      tipo TEXT,
      contenido JSONB,
      generado_por INTEGER,
      fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- Columnas agregadas después de la versión inicial
    ALTER TABLE tareas ADD COLUMN IF NOT EXISTS tallas_lote JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('✅ Tablas inicializadas.');
};

/* ==============================
   DEFINICIÓN DE TABLAS (lista blanca)
   Solo estas tablas/columnas se pueden escribir desde la API.
============================== */
const TABLES = {
  usuarios: {
    columns: ['nombre', 'email', 'password', 'rol', 'cargo', 'telefono', 'direccion', 'creado_en'],
    json: [],
  },
  catalogo: {
    columns: ['referencia', 'nombre', 'tallas', 'colores', 'suela', 'material', 'precio', 'descripcion', 'foto', 'creado_en'],
    json: ['tallas', 'colores'],
  },
  inventario: {
    columns: ['nombre', 'cantidad', 'unidad', 'proveedor', 'precio_unitario', 'stock_minimo', 'categoria', 'fecha_actualizacion'],
    json: [],
  },
  tareas: {
    columns: ['descripcion', 'usuario_id', 'asignado_por', 'estado', 'prioridad', 'fecha_vencimiento', 'fecha_creacion',
      'categoria', 'catalogo_id', 'talla', 'color', 'cantidad_pares', 'etapa_actual', 'historial_etapas', 'tallas_lote'],
    json: ['historial_etapas', 'tallas_lote'],
  },
  nominas: {
    columns: ['usuario_id', 'salario', 'deducciones', 'bonificaciones', 'fecha', 'semana', 'ano', 'estado', 'medio_pago', 'comprobante'],
    json: [],
  },
  notificaciones: {
    columns: ['para_usuario_id', 'tipo', 'titulo', 'mensaje', 'tarea_id', 'leida', 'fecha'],
    json: [],
  },
  reportes: {
    columns: ['tipo', 'contenido', 'generado_por', 'fecha_generacion'],
    json: ['contenido'],
  },
};

const NULLABLE_NUMERIC = /(_id|^asignado_por$|^talla$|^cantidad|^precio|^salario|^deducciones|^bonificaciones|^semana$|^ano$|^stock_minimo$|^fecha)/;

// Convierte el objeto que manda el frontend en { columna: valor } válidos
const pickColumns = (table, body) => {
  const def = TABLES[table];
  const data = { ...body };
  if (table === 'nominas' && data['año'] !== undefined && data.ano === undefined) data.ano = data['año'];

  const row = {};
  for (const col of def.columns) {
    if (data[col] === undefined) continue;
    let v = data[col];
    if (def.json.includes(col)) v = v === null ? null : JSON.stringify(v);
    else if (v === '' && NULLABLE_NUMERIC.test(col)) v = null;
    row[col] = v;
  }
  return row;
};

const parseId = (raw) => {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeEmail = (email) => String(email || '').replace(/﻿/g, '').trim().toLowerCase();
const normalizeRol = (rol) => {
  const r = String(rol || '').toLowerCase();
  return r === 'jefe' ? 'administrador' : r;
};

// Nunca devolver la contraseña (ni su hash) al navegador
const stripPassword = (row) => {
  if (!row) return row;
  const { password, ...rest } = row;
  return rest;
};

// Mantiene la secuencia SERIAL por encima del id más alto (el frontend asigna los ids)
const syncSequence = (client, table) =>
  client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);

const validTable = (req, res, next) => {
  if (!TABLES[req.params.table]) return res.status(404).json({ error: 'Tabla no válida' });
  next();
};

const esAdmin = (req) => req.user && req.user.rol === 'administrador';
const soloAdmin = (req, res, next) => (esAdmin(req) ? next() : res.status(403).json({ error: 'Solo administradores' }));

/* ==============================
   RUTAS PÚBLICAS
============================== */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'conectada' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Ingresa tu correo y contraseña' });

  const minutos = Auth.loginBloqueado(email);
  if (minutos) return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.` });

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE lower(email) = $1', [email]);
    const user = rows[0];
    const check = user ? await Auth.verifyPassword(user.password, password) : { ok: false };

    if (!check.ok) {
      Auth.registrarFallo(email);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    Auth.limpiarFallos(email);

    // Contraseña en formato antiguo (Base64 / texto plano): se guarda con hash
    if (check.legacy) {
      await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [await Auth.hashPassword(password), user.id]);
    }

    res.json({
      token: Auth.createToken(user.id),
      user: { ...stripPassword(user), rol: normalizeRol(user.rol) },
    });
  } catch (e) {
    console.error('❌ /api/login:', e.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/* ==============================
   A PARTIR DE AQUÍ TODO REQUIERE SESIÓN
============================== */
app.use('/api', async (req, res, next) => {
  const header = req.headers.authorization || '';
  const uid = Auth.readToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!uid) return res.status(401).json({ error: 'Sesión no válida o expirada' });
  try {
    // Se consulta el rol actual: si el admin lo cambia o borra al usuario, aplica de inmediato
    const { rows } = await pool.query('SELECT id, rol, debe_cambiar_password FROM usuarios WHERE id = $1', [uid]);
    if (!rows[0]) return res.status(401).json({ error: 'El usuario ya no existe' });
    req.user = { id: rows[0].id, rol: normalizeRol(rows[0].rol) };

    // Con contraseña temporal solo puede cargar sus datos y cambiarla; todo lo demás se bloquea
    if (rows[0].debe_cambiar_password) {
      const permitido = (req.method === 'GET' && req.path === '/sync')
        || (req.method === 'POST' && req.path === `/usuarios/${uid}/password`);
      if (!permitido) return res.status(403).json({ error: 'Debes cambiar tu contraseña temporal antes de continuar' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Descarga la información que le corresponde al usuario
app.get('/api/sync', async (req, res) => {
  try {
    const admin = esAdmin(req);
    const q = (sql, params) => pool.query(sql, params).then(r => r.rows);
    res.json({
      usuarios: (await q('SELECT * FROM usuarios ORDER BY id')).map(stripPassword),
      catalogo: await q('SELECT * FROM catalogo ORDER BY id'),
      inventario: await q('SELECT * FROM inventario ORDER BY id'),
      tareas: await q('SELECT * FROM tareas ORDER BY id'),
      // Un empleado solo recibe SUS nóminas
      nominas: admin
        ? await q('SELECT * FROM nominas ORDER BY id')
        : await q('SELECT * FROM nominas WHERE usuario_id = $1 ORDER BY id', [req.user.id]),
      notificaciones: await q('SELECT * FROM notificaciones WHERE para_usuario_id = $1 ORDER BY id', [req.user.id]),
      reportes: admin ? await q('SELECT * FROM reportes ORDER BY id') : [],
    });
  } catch (e) {
    console.error('❌ /api/sync:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Restablecer: el admin genera una contraseña temporal para otro usuario.
// Se devuelve UNA sola vez (en la base queda solo el hash) y el usuario debe cambiarla al entrar.
app.post('/api/usuarios/:id/reset-password', soloAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  if (id === req.user.id) return res.status(400).json({ error: 'Para tu propia contraseña usa "Mi Perfil"' });
  try {
    const temporal = Auth.generarTemporal();
    const { rowCount } = await pool.query(
      'UPDATE usuarios SET password = $1, debe_cambiar_password = true WHERE id = $2',
      [await Auth.hashPassword(temporal), id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, temporal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cambiar contraseña: el propio usuario (con la actual) o un admin (a cualquiera)
app.post('/api/usuarios/:id/password', async (req, res) => {
  const id = parseId(req.params.id);
  const { actual, nueva } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const propio = id === req.user.id;
  if (!propio && !esAdmin(req)) return res.status(403).json({ error: 'No autorizado' });
  if (typeof nueva !== 'string' || nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const { rows } = await pool.query('SELECT password FROM usuarios WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (propio) {
      const check = await Auth.verifyPassword(rows[0].password, String(actual || ''));
      if (!check.ok) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      if (actual === nueva) return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
    }
    // Si la cambia el propio usuario queda libre; si la pone un admin, deberá cambiarla al entrar
    await pool.query(
      'UPDATE usuarios SET password = $1, debe_cambiar_password = $2 WHERE id = $3',
      [await Auth.hashPassword(nueva), !propio, id]
    );
    res.json({ ok: true, debe_cambiar_password: !propio });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/:table', validTable, soloAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} ORDER BY id`);
    res.json(rows.map(stripPassword));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ==============================
   PERMISOS DE ESCRITURA PARA EMPLEADOS
   (el administrador puede todo)
============================== */
const permisoEmpleado = async (req, table, id, row) => {
  const uid = req.user.id;
  const keep = (cols) => Object.fromEntries(Object.entries(row).filter(([c]) => cols.includes(c)));
  const actual = id
    ? (await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0]
    : null;

  switch (table) {
    case 'usuarios': // solo su propio perfil
      if (id !== uid) return { error: 'Solo puedes editar tu propio perfil' };
      return { row: keep(['nombre', 'telefono', 'direccion']) };

    case 'tareas': // completar su etapa en una tarea que tiene asignada
      if (!actual || actual.usuario_id !== uid) return { error: 'Esta tarea no está asignada a ti' };
      return { row: keep(['estado', 'historial_etapas']) };

    case 'inventario': { // solo registrar salidas de stock
      if (!actual) return { error: 'Producto no encontrado' };
      const r = keep(['cantidad', 'fecha_actualizacion']);
      if (r.cantidad !== undefined && (parseInt(r.cantidad) > actual.cantidad || parseInt(r.cantidad) < 0)) {
        return { error: 'Los empleados solo pueden registrar salidas de stock' };
      }
      return { row: r };
    }

    case 'notificaciones':
      if (!id) { // crear (p. ej. avisar al supervisor)
        return { row: { ...keep(['para_usuario_id', 'tipo', 'titulo', 'mensaje', 'tarea_id', 'fecha']), leida: false } };
      }
      if (!actual || actual.para_usuario_id !== uid) return { error: 'No autorizado' };
      return { row: keep(['leida']) };

    default:
      return { error: 'No autorizado' };
  }
};

/* ==============================
   GUARDAR (crear o actualizar)
============================== */
const save = async (req, res) => {
  const { table } = req.params;
  const rawId = req.params.id ?? req.body.id;
  const id = parseId(rawId);
  if (rawId !== undefined && rawId !== null && !id) return res.status(400).json({ error: 'id inválido' });
  if (!id && req.method !== 'POST') return res.status(400).json({ error: 'id inválido' });

  let row = pickColumns(table, req.body);

  try {
    if (!esAdmin(req)) {
      const p = await permisoEmpleado(req, table, id, row);
      if (p.error) return res.status(403).json({ error: p.error });
      row = p.row;
    }

    if (table === 'usuarios') {
      if (row.email !== undefined) row.email = normalizeEmail(row.email);
      if (row.rol !== undefined) row.rol = normalizeRol(row.rol);
      // La contraseña solo se guarda con hash; vacía = no cambiarla
      if (row.password) {
        row.password = await Auth.hashPassword(row.password);
        // Contraseña puesta por un admin a otra persona (p. ej. al crear el usuario): deberá cambiarla al entrar
        if (id !== req.user.id) row.debe_cambiar_password = true;
      } else {
        delete row.password;
      }
    }

    const cols = Object.keys(row);
    const vals = Object.values(row);
    if (cols.length === 0) return res.status(400).json({ error: 'Sin datos para guardar' });

    const client = await pool.connect();
    try {
      let result;
      if (id) {
        // UPDATE primero; si no existe, INSERT con el id del frontend
        const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
        result = await client.query(`UPDATE ${table} SET ${sets} WHERE id = $1 RETURNING *`, [id, ...vals]);
        if (result.rowCount === 0) {
          if (!esAdmin(req)) return res.status(404).json({ error: 'No encontrado' });
          const allCols = ['id', ...cols];
          result = await client.query(
            `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${allCols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
            [id, ...vals]
          );
          await syncSequence(client, table);
        }
      } else {
        // Sin id: la base de datos lo asigna (SERIAL)
        result = await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
          vals
        );
      }
      res.json(stripPassword(result.rows[0]));
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(`❌ Guardar ${table}#${id || 'nuevo'}:`, e.message);
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos (p. ej. correo repetido)' });
    if (e.code === '23502') return res.status(400).json({ error: 'Faltan datos obligatorios' });
    res.status(500).json({ error: e.message });
  }
};

app.post('/api/:table', validTable, save);
app.put('/api/:table/:id', validTable, save);

/* ==============================
   ELIMINAR
============================== */
app.delete('/api/:table/:id', validTable, async (req, res) => {
  const { table } = req.params;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });

  if (!esAdmin(req)) {
    // Un empleado solo puede borrar sus propias notificaciones
    if (table !== 'notificaciones') return res.status(403).json({ error: 'No autorizado' });
    const { rows } = await pool.query('SELECT para_usuario_id FROM notificaciones WHERE id = $1', [id]);
    if (rows[0] && rows[0].para_usuario_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
  }
  if (table === 'usuarios' && id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Soltar referencias para no romper llaves foráneas (seed.js las crea)
    if (table === 'usuarios') {
      await client.query('UPDATE tareas SET usuario_id = NULL WHERE usuario_id = $1', [id]);
      await client.query('UPDATE tareas SET asignado_por = NULL WHERE asignado_por = $1', [id]);
      await client.query('UPDATE nominas SET usuario_id = NULL WHERE usuario_id = $1', [id]);
      await client.query('DELETE FROM notificaciones WHERE para_usuario_id = $1', [id]);
      await client.query('UPDATE reportes SET generado_por = NULL WHERE generado_por = $1', [id]);
    } else if (table === 'catalogo') {
      await client.query('UPDATE tareas SET catalogo_id = NULL WHERE catalogo_id = $1', [id]);
    }
    await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`❌ Eliminar ${table}#${id}:`, e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ==============================
   ARRANQUE
============================== */
const PORT = process.env.PORT || 3000;

// Si no hay ningún usuario, crea el administrador por defecto (para poder entrar la primera vez)
const ensureAdmin = async () => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) return;
  await pool.query(
    `INSERT INTO usuarios (nombre, email, password, rol, cargo) VALUES ($1, $2, $3, 'administrador', 'Administración')`,
    ['Admin Sistema', 'admin@bufalo.com', await Auth.hashPassword('admin123')]
  );
  console.log('👑 Base de datos sin usuarios: se creó admin@bufalo.com / admin123 (cámbiala al entrar).');
};

(async () => {
  try {
    await initDB();
    for (const table of Object.keys(TABLES)) await syncSequence(pool, table);
    await ensureAdmin();
  } catch (error) {
    console.error('❌ No se pudo conectar/inicializar PostgreSQL:', error.message);
    console.error('   Revisa los datos del archivo .env y que PostgreSQL esté encendido.');
  }
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  });
})();
