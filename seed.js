/**
 * ROSALOPZManager - Datos de demostración
 * Fábrica de Calzado Búfalo R.P. (Bogotá)
 *
 * Carga un escenario realista y coherente para ver la app "en uso" y para el plan de pruebas:
 * usuarios por cargo, catálogo, inventario con alertas, 6 meses de nóminas, órdenes de
 * producción en todas las etapas (incluidas vencidas y pendientes de asignar) y notificaciones.
 *
 * Todos los nombres de personas y empresas son FICTICIOS (uso académico).
 * Las fechas se calculan a partir de HOY, así que los datos siempre se ven actuales.
 *
 *   npm run seed -- --force      (BORRA los datos actuales; antes guarda un respaldo en /backups)
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Auth = require('./server/auth');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true'
});

/* ==============================
   UTILIDADES
============================== */
// Pseudoaleatorio con semilla: siempre genera los mismos datos
let semilla = 20261118;
const rnd = () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
const entre = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

// Fechas en hora de Bogotá (UTC-5, sin horario de verano)
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()); // YYYY-MM-DD
const sumarDias = (fecha, dias) => {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const hace = (dias) => sumarDias(hoy, -dias);
const marca = (fecha, hora = '08:00') => `${fecha}T${hora}:00.000-05:00`;
const finDeMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10); // mes 1-12
const semanaISO = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { semana: Math.ceil(((t - inicio) / 86400000 + 1) / 7), ano: t.getUTCFullYear() };
};
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

// Imagen del producto como SVG (no depende de internet)
const foto = (emoji, c1, c2, ref) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
  `<rect width="400" height="300" fill="url(#g)"/>` +
  `<circle cx="200" cy="150" r="96" fill="#ffffff" fill-opacity="0.12"/>` +
  // La referencia no va dentro de la imagen: la tarjeta la muestra y aquí quedaba recortada
  `<text x="200" y="190" font-size="116" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif"><title>${ref}</title>${emoji}</text>` +
  `</svg>`
);

/* ==============================
   USUARIOS
   Se conservan las cuentas originales con sus contraseñas.
============================== */
const BARRIOS = ['Restrepo', 'Kennedy Central', 'Bosa La Libertad', 'Tunjuelito', 'Santa Lucía', 'Olaya Herrera',
  'Quiroga', 'Carvajal', 'Patio Bonito', 'Fontibón Centro', 'Suba Rincón', 'Engativá Pueblo', 'San Cristóbal Sur', 'Policarpa'];
const direccion = () => `${elegir(['Cra.', 'Calle', 'Diagonal', 'Transversal'])} ${entre(1, 98)}${elegir(['', ' A', ' B', ' Bis'])} # ${entre(1, 80)}-${entre(10, 95)}${elegir([' Sur', '', ' Sur'])}, ${elegir(BARRIOS)}`;
const celular = () => `3${elegir(['00', '01', '04', '10', '12', '14', '15', '16', '20', '21', '23', '50'])}${String(entre(1000000, 9999999))}`;

const USUARIOS = [
  // Administradores
  { nombre: 'Admin Sistema', email: 'admin@bufalo.com', clave: 'admin123', rol: 'administrador', cargo: 'Administración', desde: 520 },
  { nombre: 'Rigoberto Palacios', email: 'jefe@bufalo.com', clave: 'jefe123', rol: 'administrador', cargo: 'Dirección', desde: 520 },
  { nombre: 'Luz Marina Rosales', email: 'luz.rosales@bufalo.com', clave: 'admin123', rol: 'administrador', cargo: 'Contabilidad y Nómina', desde: 410 },
  // Cortadores
  { nombre: 'Carlos Rodríguez', email: 'carlos@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Cortador', desde: 500 },
  { nombre: 'Andrés Felipe Muñoz', email: 'andres.munoz@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Cortador', desde: 330 },
  { nombre: 'Wilson Arévalo', email: 'wilson.arevalo@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Cortador', desde: 240 },
  // Guarnecedores
  { nombre: 'María López', email: 'maria@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Guarnecedor', desde: 500 },
  { nombre: 'Diana Carolina Pérez', email: 'diana.perez@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Guarnecedor', desde: 380 },
  { nombre: 'Yolanda Castañeda', email: 'yolanda.castaneda@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Guarnecedor', desde: 260 },
  // Soladores
  { nombre: 'Juan García', email: 'juan@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Solador', desde: 500 },
  { nombre: 'Jhon Fredy Ramírez', email: 'jhon.ramirez@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Solador', desde: 300 },
  { nombre: 'Édgar Mauricio Torres', email: 'edgar.torres@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Solador', desde: 220 },
  // Emplantilladores
  { nombre: 'Pedro Gómez', email: 'pedro@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Emplantillador', desde: 500 },
  { nombre: 'Leidy Johana Vargas', email: 'leidy.vargas@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Emplantillador', desde: 350 },
  { nombre: 'Óscar Iván Beltrán', email: 'oscar.beltran@bufalo.com', clave: 'emp123', rol: 'empleado', cargo: 'Emplantillador', desde: 230 },
];

/* ==============================
   CATÁLOGO
============================== */
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const CATALOGO = [
  { referencia: 'REF-305', nombre: 'Bota Industrial Búfalo', tallas: rango(37, 45), colores: ['Negro', 'Café'], suela: 'Caucho nitrilo antideslizante', material: 'Cuero graso', precio: 189900,
    descripcion: 'Bota de seguridad con puntera de acero y suela resistente a hidrocarburos. Ideal para construcción e industria.', foto: foto('🥾', '#3b2a1e', '#8a5a33', 'REF-305') },
  { referencia: 'REF-210', nombre: 'Tenis Urbano Casual', tallas: rango(35, 42), colores: ['Blanco', 'Azul', 'Rojo'], suela: 'EVA', material: 'Lona reforzada y gamuza', precio: 119900,
    descripcion: 'Tenis livianos para uso diario, con plantilla acolchada y costuras reforzadas.', foto: foto('👟', '#1d3a8a', '#4cc9f0', 'REF-210') },
  { referencia: 'REF-118', nombre: 'Mocasín Clásico Caballero', tallas: rango(38, 44), colores: ['Café', 'Miel', 'Negro'], suela: 'Suela de cuero cosida', material: 'Cuero napa', precio: 159900,
    descripcion: 'Mocasín de horma cómoda con antifaz cosido a mano. Elegante para oficina.', foto: foto('👞', '#4a2c17', '#b8763e', 'REF-118') },
  { referencia: 'REF-422', nombre: 'Botín Chelsea Dama', tallas: rango(34, 40), colores: ['Negro', 'Vino tinto', 'Taupe'], suela: 'TR flexible', material: 'Gamuza', precio: 169900,
    descripcion: 'Botín con elásticos laterales y tacón bajo de 4 cm. Tendencia de temporada.', foto: foto('👢', '#3a0c2b', '#9b2d5f', 'REF-422') },
  { referencia: 'REF-507', nombre: 'Sandalia Plataforma', tallas: rango(34, 39), colores: ['Dorado', 'Negro', 'Nude'], suela: 'Poliuretano (PU)', material: 'Cuero sintético', precio: 99900,
    descripcion: 'Sandalia con plataforma de 5 cm y correa ajustable con hebilla.', foto: foto('👡', '#7a4e12', '#f8a80c', 'REF-507') },
  { referencia: 'REF-150', nombre: 'Zapato Escolar Colegial', tallas: rango(27, 40), colores: ['Negro'], suela: 'Caucho cosido', material: 'Cuero crupón', precio: 109900,
    descripcion: 'Zapato escolar de alta resistencia con suela cosida. Referencia de mayor rotación en temporada escolar.', foto: foto('👞', '#111827', '#4b5563', 'REF-150') },
  { referencia: 'REF-333', nombre: 'Bota Vaquera Texana', tallas: rango(38, 44), colores: ['Café', 'Miel'], suela: 'Cuero con tacón cubano', material: 'Cuero repujado', precio: 259900,
    descripcion: 'Bota texana con caña de 30 cm y repujado artesanal.', foto: foto('🤠', '#5c3317', '#d2914b', 'REF-333') },
  { referencia: 'REF-640', nombre: 'Tenis Deportivo Running', tallas: rango(36, 43), colores: ['Negro', 'Gris', 'Verde neón'], suela: 'EVA inyectada', material: 'Malla transpirable', precio: 139900,
    descripcion: 'Tenis para correr con amortiguación en talón y malla transpirable.', foto: foto('👟', '#064e3b', '#06d6a0', 'REF-640') },
  { referencia: 'REF-215', nombre: 'Baleta Dama Confort', tallas: rango(34, 39), colores: ['Negro', 'Beige', 'Rosa palo'], suela: 'TR flexible', material: 'Cuero napa', precio: 89900,
    descripcion: 'Baleta plegable con plantilla memory foam. Comodidad para todo el día.', foto: foto('🥿', '#6b2141', '#f4a3b8', 'REF-215') },
];

/* ==============================
   INVENTARIO  (los marcados ⚠ quedan con stock bajo o agotado a propósito)
============================== */
const P = {
  curt: 'Curtiembres San Benito S.A.S.', suelas: 'Suelas y Componentes Andinos', quim: 'Químicos Industriales de Bogotá',
  hilos: 'Hilos y Avíos La 13', emp: 'Empaques Kennedy Ltda.', text: 'Textiles del Tunjuelo', herr: 'Herrajes y Accesorios del Restrepo',
};
const INVENTARIO = [
  // Materia prima
  { nombre: 'Cuero graso café', cantidad: 120, unidad: 'metros', proveedor: P.curt, precio: 46000, minimo: 40, categoria: 'Materia Prima' },
  { nombre: 'Cuero napa negro', cantidad: 85, unidad: 'metros', proveedor: P.curt, precio: 52000, minimo: 40, categoria: 'Materia Prima' },
  { nombre: 'Cuero crupón negro', cantidad: 18, unidad: 'metros', proveedor: P.curt, precio: 48000, minimo: 30, categoria: 'Materia Prima' }, // ⚠
  { nombre: 'Gamuza negra', cantidad: 34, unidad: 'metros', proveedor: P.curt, precio: 39000, minimo: 20, categoria: 'Materia Prima' },
  { nombre: 'Lona reforzada blanca', cantidad: 60, unidad: 'metros', proveedor: P.text, precio: 14500, minimo: 25, categoria: 'Materia Prima' },
  { nombre: 'Malla transpirable gris', cantidad: 9, unidad: 'metros', proveedor: P.text, precio: 18000, minimo: 15, categoria: 'Materia Prima' }, // ⚠
  // Componentes
  { nombre: 'Suela caucho nitrilo', cantidad: 240, unidad: 'pares', proveedor: P.suelas, precio: 9800, minimo: 100, categoria: 'Componentes' },
  { nombre: 'Suela EVA inyectada', cantidad: 75, unidad: 'pares', proveedor: P.suelas, precio: 7600, minimo: 80, categoria: 'Componentes' }, // ⚠
  { nombre: 'Suela TR dama', cantidad: 160, unidad: 'pares', proveedor: P.suelas, precio: 6900, minimo: 60, categoria: 'Componentes' },
  { nombre: 'Plantilla memory foam', cantidad: 300, unidad: 'pares', proveedor: P.suelas, precio: 4800, minimo: 120, categoria: 'Componentes' },
  { nombre: 'Puntera de acero', cantidad: 42, unidad: 'pares', proveedor: P.herr, precio: 11500, minimo: 50, categoria: 'Componentes' }, // ⚠
  { nombre: 'Contrafuerte termoadherible', cantidad: 410, unidad: 'pares', proveedor: P.suelas, precio: 1900, minimo: 150, categoria: 'Componentes' },
  // Insumos
  { nombre: 'Pegante de contacto PU', cantidad: 26, unidad: 'litros', proveedor: P.quim, precio: 38000, minimo: 15, categoria: 'Insumos' },
  { nombre: 'Hilo nylon calibre 40', cantidad: 7, unidad: 'conos', proveedor: P.hilos, precio: 13500, minimo: 12, categoria: 'Insumos' }, // ⚠
  { nombre: 'Solvente limpiador', cantidad: 18, unidad: 'litros', proveedor: P.quim, precio: 22000, minimo: 10, categoria: 'Insumos' },
  // Accesorios
  { nombre: 'Cordones encerados 120 cm', cantidad: 520, unidad: 'pares', proveedor: P.hilos, precio: 1200, minimo: 200, categoria: 'Accesorios' },
  { nombre: 'Ojaletes metálicos', cantidad: 4800, unidad: 'unidades', proveedor: P.herr, precio: 45, minimo: 1500, categoria: 'Accesorios' },
  { nombre: 'Hebillas doradas', cantidad: 180, unidad: 'unidades', proveedor: P.herr, precio: 1600, minimo: 100, categoria: 'Accesorios' },
  { nombre: 'Cremallera metálica 15 cm', cantidad: 0, unidad: 'unidades', proveedor: P.herr, precio: 2300, minimo: 60, categoria: 'Accesorios' }, // ⚠ agotado
  // Empaque
  { nombre: 'Caja de cartón para calzado', cantidad: 640, unidad: 'unidades', proveedor: P.emp, precio: 2100, minimo: 300, categoria: 'Empaque' },
  { nombre: 'Papel seda', cantidad: 12, unidad: 'kilos', proveedor: P.emp, precio: 16000, minimo: 5, categoria: 'Empaque' },
  { nombre: 'Bolsa ecológica de tela', cantidad: 95, unidad: 'unidades', proveedor: P.emp, precio: 3200, minimo: 120, categoria: 'Empaque' }, // ⚠
];

/* ==============================
   ÓRDENES DE PRODUCCIÓN (TAREAS)
   etapa: dónde va el lote · espera: la etapa ya se terminó y falta que el admin asigne la siguiente
============================== */
const ETAPAS = ['corte', 'guarnecido', 'soladura', 'emplantillado', 'listo'];
const CARGO_ETAPA = { corte: 'Cortador', guarnecido: 'Guarnecedor', soladura: 'Solador', emplantillado: 'Emplantillador' };
const ORDENES = [
  // Terminadas
  { ref: 'REF-150', color: 'Negro', tallas: [32, 33, 34, 35, 36], pares: 120, prioridad: 'alta', creada: 46, plazo: 12, etapa: 'listo' },
  { ref: 'REF-305', color: 'Negro', tallas: [39, 40, 41, 42], pares: 48, prioridad: 'alta', creada: 38, plazo: 10, etapa: 'listo' },
  { ref: 'REF-210', color: 'Blanco', tallas: [36, 37, 38], pares: 36, prioridad: 'media', creada: 33, plazo: 12, etapa: 'listo' },
  { ref: 'REF-118', color: 'Café', tallas: [40, 41, 42], pares: 24, prioridad: 'media', creada: 27, plazo: 10, etapa: 'listo' },
  { ref: 'REF-215', color: 'Negro', tallas: [35, 36, 37], pares: 30, prioridad: 'baja', creada: 22, plazo: 14, etapa: 'listo' },
  // En emplantillado
  { ref: 'REF-422', color: 'Negro', tallas: [36, 37, 38], pares: 30, prioridad: 'alta', creada: 12, plazo: 15, etapa: 'emplantillado' },
  { ref: 'REF-640', color: 'Gris', tallas: [38, 39, 40, 41], pares: 40, prioridad: 'media', creada: 11, plazo: 16, etapa: 'emplantillado', estado: 'en_progreso' },
  { ref: 'REF-305', color: 'Café', tallas: [40, 41, 42, 43], pares: 36, prioridad: 'alta', creada: 10, plazo: 12, etapa: 'emplantillado', espera: true }, // falta "marcar listo"
  // En soladura
  { ref: 'REF-333', color: 'Miel', tallas: [40, 41, 42], pares: 18, prioridad: 'media', creada: 9, plazo: 14, etapa: 'soladura' },
  { ref: 'REF-507', color: 'Dorado', tallas: [35, 36, 37], pares: 36, prioridad: 'baja', creada: 8, plazo: 15, etapa: 'soladura', espera: true }, // falta asignar emplantillador
  // En guarnecido
  { ref: 'REF-210', color: 'Azul', tallas: [37, 38, 39, 40], pares: 48, prioridad: 'alta', creada: 9, plazo: 7, etapa: 'guarnecido', estado: 'en_progreso' }, // VENCIDA
  { ref: 'REF-118', color: 'Negro', tallas: [39, 40, 41, 42], pares: 24, prioridad: 'media', creada: 6, plazo: 12, etapa: 'guarnecido' },
  // En corte
  { ref: 'REF-150', color: 'Negro', tallas: [28, 29, 30, 31], pares: 96, prioridad: 'alta', creada: 2, plazo: 10, etapa: 'corte' },
  { ref: 'REF-215', color: 'Rosa palo', tallas: [35, 36, 37, 38], pares: 30, prioridad: 'media', creada: 1, plazo: 14, etapa: 'corte' },
  { ref: 'REF-640', color: 'Verde neón', tallas: [39, 40, 41], pares: 24, prioridad: 'baja', creada: 7, plazo: 5, etapa: 'corte', estado: 'en_progreso' }, // VENCIDA
  { ref: 'REF-422', color: 'Vino tinto', tallas: [36, 37, 38], pares: 24, prioridad: 'media', creada: 4, plazo: 14, etapa: 'corte', espera: true }, // falta asignar guarnecedor
];

/* ==============================
   ESQUEMA (igual al de server.js)
============================== */
const ESQUEMA = `
  CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'empleado',
    cargo TEXT,
    telefono TEXT,
    direccion TEXT,
    debe_cambiar_password BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  CREATE TABLE catalogo (
    id SERIAL PRIMARY KEY,
    referencia TEXT, nombre TEXT, tallas JSONB, colores JSONB, suela TEXT, material TEXT,
    precio NUMERIC, descripcion TEXT, foto TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    nombre TEXT, cantidad INTEGER DEFAULT 0, unidad TEXT, proveedor TEXT, precio_unitario NUMERIC,
    stock_minimo INTEGER DEFAULT 10, categoria TEXT, fecha_actualizacion DATE DEFAULT CURRENT_DATE
  );
  CREATE TABLE tareas (
    id SERIAL PRIMARY KEY,
    descripcion TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    asignado_por INTEGER REFERENCES usuarios(id),
    estado TEXT DEFAULT 'pendiente', prioridad TEXT DEFAULT 'media',
    fecha_vencimiento DATE, fecha_creacion DATE DEFAULT CURRENT_DATE, categoria TEXT,
    catalogo_id INTEGER REFERENCES catalogo(id),
    talla INTEGER, color TEXT, cantidad_pares INTEGER,
    etapa_actual TEXT DEFAULT 'corte',
    historial_etapas JSONB DEFAULT '[]'::jsonb,
    tallas_lote JSONB DEFAULT '[]'::jsonb
  );
  CREATE TABLE nominas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    salario NUMERIC, deducciones NUMERIC DEFAULT 0, bonificaciones NUMERIC DEFAULT 0,
    fecha DATE, semana INTEGER, ano INTEGER, estado TEXT DEFAULT 'pendiente',
    medio_pago TEXT, comprobante TEXT
  );
  CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    para_usuario_id INTEGER REFERENCES usuarios(id),
    tipo TEXT, titulo TEXT, mensaje TEXT, tarea_id INTEGER,
    leida BOOLEAN DEFAULT false,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    tipo TEXT, contenido JSONB,
    generado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
`;

const TABLAS = ['usuarios', 'catalogo', 'inventario', 'tareas', 'nominas', 'notificaciones', 'reportes'];

// Guarda una copia JSON de lo que hay antes de borrar
async function respaldar() {
  const copia = { fecha: new Date().toISOString() };
  for (const t of TABLAS) {
    try { copia[t] = (await pool.query(`SELECT * FROM ${t} ORDER BY id`)).rows; } catch (e) { copia[t] = []; }
  }
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `respaldo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(archivo, JSON.stringify(copia, null, 2));
  return archivo;
}

/* ==============================
   CARGA
============================== */
async function seed() {
  if (!process.argv.includes('--force')) {
    console.log('⚠️  seed.js BORRA TODOS LOS DATOS de la base y carga los datos de demostración.');
    console.log('   (Antes guarda un respaldo en la carpeta /backups.)');
    console.log('   Si estás segura/o, ejecuta:  npm run seed -- --force   (o  node seed.js --force)');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    const respaldo = await respaldar();
    console.log(`💾 Respaldo de los datos anteriores: ${path.relative(__dirname, respaldo)}`);

    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS reportes, notificaciones, nominas, tareas, inventario, catalogo, usuarios CASCADE;`);
    await client.query(ESQUEMA);

    // --- Usuarios
    for (const u of USUARIOS) {
      const { rows } = await client.query(
        `INSERT INTO usuarios (nombre, email, password, rol, cargo, telefono, direccion, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [u.nombre, u.email, await Auth.hashPassword(u.clave), u.rol, u.cargo, celular(), direccion(), marca(hace(u.desde), '09:00')]
      );
      u.id = rows[0].id;
    }
    const porEmail = (email) => USUARIOS.find(u => u.email === email);
    const porCargo = (cargo) => USUARIOS.filter(u => u.cargo === cargo);
    const ADMIN = porEmail('admin@bufalo.com').id, JEFE = porEmail('jefe@bufalo.com').id;
    const empleados = USUARIOS.filter(u => u.rol === 'empleado');

    // --- Catálogo
    const catalogoPorRef = {};
    for (const c of CATALOGO) {
      const { rows } = await client.query(
        `INSERT INTO catalogo (referencia, nombre, tallas, colores, suela, material, precio, descripcion, foto, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [c.referencia, c.nombre, JSON.stringify(c.tallas), JSON.stringify(c.colores), c.suela, c.material, c.precio, c.descripcion, c.foto, marca(hace(entre(200, 480)))]
      );
      catalogoPorRef[c.referencia] = { ...c, id: rows[0].id };
    }

    // --- Inventario
    for (const i of INVENTARIO) {
      await client.query(
        `INSERT INTO inventario (nombre, cantidad, unidad, proveedor, precio_unitario, stock_minimo, categoria, fecha_actualizacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [i.nombre, i.cantidad, i.unidad, i.proveedor, i.precio, i.minimo, i.categoria, hace(entre(0, 12))]
      );
    }
    const bajos = INVENTARIO.filter(i => i.cantidad <= i.minimo).map(i => i.nombre);

    // --- Nóminas: últimos 6 meses (el mes actual queda pendiente)
    const SALARIO = { Cortador: 1950000, Guarnecedor: 1880000, Solador: 1920000, Emplantillador: 1820000 };
    const MEDIOS = ['transferencia', 'transferencia', 'nequi', 'daviplata', 'efectivo'];
    const [anioHoy, mesHoy] = hoy.split('-').map(Number);
    const medioDe = Object.fromEntries(empleados.map(e => [e.id, elegir(MEDIOS)])); // cada quien cobra siempre igual
    let nNominas = 0;
    for (let k = 5; k >= 0; k--) {
      const d = new Date(Date.UTC(anioHoy, mesHoy - 1 - k, 1));
      const fecha = finDeMes(d.getUTCFullYear(), d.getUTCMonth() + 1);
      const { semana, ano } = semanaISO(fecha);
      for (const e of empleados) {
        if (hace(e.desde) > fecha) continue; // aún no trabajaba
        const salario = SALARIO[e.cargo] + (e.desde > 400 ? 120000 : e.desde > 300 ? 60000 : 0); // antigüedad
        const deducciones = Math.round(salario * 0.08); // salud 4% + pensión 4%
        const bonificaciones = elegir([0, 0, 50000, 80000, 120000, 150000, 200000]);
        // Mes actual: pendiente. Mes anterior: dos personas aún sin pago.
        const pendiente = k === 0 || (k === 1 && ['yolanda.castaneda@bufalo.com', 'oscar.beltran@bufalo.com'].includes(e.email));
        await client.query(
          `INSERT INTO nominas (usuario_id, salario, deducciones, bonificaciones, fecha, semana, ano, estado, medio_pago, comprobante)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'')`,
          [e.id, salario, deducciones, bonificaciones, fecha, semana, ano, pendiente ? 'pendiente' : 'pagada', pendiente ? '' : medioDe[e.id]]
        );
        nNominas++;
      }
    }

    // --- Órdenes de producción + notificaciones coherentes
    const notifs = [];
    const turno = {}; // reparte el trabajo entre los operarios de cada cargo
    const operario = (etapa) => {
      const lista = porCargo(CARGO_ETAPA[etapa]);
      turno[etapa] = ((turno[etapa] ?? entre(0, lista.length - 1)) + 1) % lista.length;
      return lista[turno[etapa]];
    };

    for (const o of ORDENES) {
      const prod = catalogoPorRef[o.ref];
      const creada = hace(o.creada);
      const vence = sumarDias(creada, o.plazo);
      const asignador = elegir([JEFE, JEFE, ADMIN]);
      const tope = o.etapa === 'listo' ? 3 : ETAPAS.indexOf(o.etapa); // última etapa con historial
      // Cada etapa empieza en la mañana y termina en la tarde; la siguiente arranca al otro día.
      // Los días disponibles (hasta AYER, para no terminar nada "en el futuro") se reparten entre etapas.
      const terminadas = tope + (o.etapa === 'listo' || o.espera ? 1 : 0);
      const disponibles = Math.max(0, diasEntre(creada, hoy) - 1 - tope); // -tope: un día de traslado entre etapas
      const duracion = terminadas ? Math.floor(disponibles / terminadas) : 0;
      const historial = [];
      let dia = creada;
      let ultimo = null;

      for (let i = 0; i <= tope; i++) {
        const etapa = ETAPAS[i];
        const op = operario(etapa);
        const inicio = marca(dia, `0${entre(7, 9)}:${elegir(['00', '15', '30', '45'])}`);
        const terminada = i < tope || o.etapa === 'listo' || o.espera;
        let fin = null;
        if (terminada) {
          dia = sumarDias(dia, Math.min(duracion, entre(1, 3)));
          fin = marca(dia, `${entre(13, 17)}:${elegir(['00', '20', '40'])}`);
          dia = sumarDias(dia, 1); // la siguiente etapa empieza al día siguiente
        }
        historial.push({ etapa, usuario_id: op.id, fecha_inicio: inicio, fecha_fin: fin });
        ultimo = op;
      }

      let estado, usuarioId;
      if (o.etapa === 'listo') { estado = 'completada'; usuarioId = null; }
      else if (o.espera) { estado = 'completada'; usuarioId = ultimo.id; }
      else { estado = o.estado || 'pendiente'; usuarioId = ultimo.id; }

      const descripcion = `${prod.nombre.toUpperCase()} ${o.color.toUpperCase()} ${prod.referencia} - ${o.pares} PARES`;
      const { rows } = await client.query(
        `INSERT INTO tareas (descripcion, usuario_id, asignado_por, estado, prioridad, fecha_vencimiento, fecha_creacion,
           categoria, catalogo_id, talla, color, cantidad_pares, etapa_actual, historial_etapas, tallas_lote)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Producción',$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [descripcion, usuarioId, asignador, estado, o.prioridad, vence, creada, prod.id, o.tallas[0], o.color, o.pares,
          o.etapa, JSON.stringify(historial), JSON.stringify(o.tallas)]
      );
      const tareaId = rows[0].id;
      const actual = historial[historial.length - 1];

      if (o.etapa !== 'listo' && !o.espera) { // aviso al operario que tiene el lote
        const esNueva = actual.etapa === 'corte';
        notifs.push({
          para: actual.usuario_id, tipo: 'tarea_asignada', tarea: tareaId, fecha: actual.fecha_inicio,
          leida: o.creada > 3 || estado === 'en_progreso',
          titulo: esNueva ? '✅ Nueva Tarea Asignada' : `✅ Nueva Etapa Asignada: ${CARGO_ETAPA[actual.etapa]}`,
          mensaje: esNueva
            ? `Se te asignó la tarea: ${descripcion}. Producto: ${prod.nombre}. Tallas: ${o.tallas.join(', ')}.`
            : `El supervisor te asignó la siguiente etapa de: "${descripcion}". Por favor revisa tus tareas.`,
        });
      }
      if (o.espera) { // aviso a los administradores: falta asignar la siguiente etapa
        const sig = ETAPAS[ETAPAS.indexOf(o.etapa) + 1];
        for (const adm of [ADMIN, JEFE]) {
          notifs.push({
            para: adm, tipo: 'tarea_completada', tarea: tareaId, fecha: actual.fecha_fin, leida: false,
            titulo: `🏁 Etapa Completada: ${CARGO_ETAPA[o.etapa]}`,
            mensaje: `${ultimo.nombre} completó su etapa en: "${descripcion}". Debes asignar al siguiente: ${sig === 'listo' ? 'Entrega Final' : CARGO_ETAPA[sig]}.`,
          });
        }
      }
      if (o.etapa === 'listo') { // historial ya leído de lotes terminados
        notifs.push({
          para: JEFE, tipo: 'tarea_completada', tarea: tareaId, fecha: actual.fecha_fin, leida: true,
          titulo: '🏁 Etapa Completada: Emplantillador',
          mensaje: `${ultimo.nombre} completó su etapa en: "${descripcion}". Debes asignar al siguiente: Entrega Final.`,
        });
      }
    }

    notifs.push({
      para: ADMIN, tipo: 'info', tarea: null, fecha: marca(hoy, '07:00'), leida: false,
      titulo: '⚠️ Materiales con stock bajo',
      mensaje: `Hay ${bajos.length} materiales por debajo del mínimo: ${bajos.slice(0, 3).join(', ')} y otros.`,
    });

    notifs.sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const n of notifs) {
      await client.query(
        `INSERT INTO notificaciones (para_usuario_id, tipo, titulo, mensaje, tarea_id, leida, fecha) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [n.para, n.tipo, n.titulo, n.mensaje, n.tarea, n.leida, n.fecha]
      );
    }

    await client.query('COMMIT');

    console.log('✅ Datos de demostración cargados:');
    console.log(`   👥 ${USUARIOS.length} usuarios (${USUARIOS.length - empleados.length} administradores, ${empleados.length} operarios)`);
    console.log(`   👟 ${CATALOGO.length} diseños · 📦 ${INVENTARIO.length} materiales (${bajos.length} con stock bajo)`);
    console.log(`   💰 ${nNominas} nóminas · ✅ ${ORDENES.length} órdenes de producción · 🔔 ${notifs.length} notificaciones`);
    console.log('   Contraseñas: administradores admin123 (jefe@bufalo.com: jefe123) · operarios emp123');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error cargando los datos (no se cambió nada en la base):', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
