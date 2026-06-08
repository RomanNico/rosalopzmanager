require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true'
});

const getBogotaNow = () => {
  const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const d = {}; parts.forEach(p => d[p.type] = p.value);
  return `${d.year}-${d.month}-${d.day}T${d.hour}:${d.minute}:${d.second}.000Z`;
};

const now = getBogotaNow();
const today = now.split('T')[0];

const getWeekAndYear = (dateStr) => {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  const week = 1 + Math.ceil((firstThursday - target) / 604800000);
  return { week, year: d.getFullYear() };
};

const users = [
  { nombre: 'Admin Sistema', email: 'admin@bufalo.com', password: Buffer.from('admin123').toString('base64'), rol: 'administrador', cargo: 'Administración', telefono: '3001234567', direccion: 'Bogotá DC' },
  { nombre: 'Rigoberto Palacios', email: 'jefe@bufalo.com', password: Buffer.from('jefe123').toString('base64'), rol: 'administrador', cargo: 'Dirección', telefono: '3109876543', direccion: 'Bogotá DC' },
  { nombre: 'Carlos Rodríguez', email: 'carlos@bufalo.com', password: Buffer.from('emp123').toString('base64'), rol: 'empleado', cargo: 'Cortador', telefono: '3201112233', direccion: 'Bogotá DC' },
  { nombre: 'María López', email: 'maria@bufalo.com', password: Buffer.from('emp123').toString('base64'), rol: 'empleado', cargo: 'Guarnecedor', telefono: '3154445566', direccion: 'Bogotá DC' },
  { nombre: 'Juan García', email: 'juan@bufalo.com', password: Buffer.from('emp123').toString('base64'), rol: 'empleado', cargo: 'Solador', telefono: '3007778899', direccion: 'Bogotá DC' },
  { nombre: 'Pedro Gómez', email: 'pedro@bufalo.com', password: Buffer.from('emp123').toString('base64'), rol: 'empleado', cargo: 'Emplantillador', telefono: '3128889900', direccion: 'Bogotá DC' }
];

const catalogo = [
  {
    referencia: 'REF-305',
    nombre: 'Bota Industrial Búfalo',
    tallas: [38, 39, 40, 41, 42, 43, 44],
    colores: ['Negro', 'Marrón'],
    suela: 'Goma Antideslizante',
    material: 'Cuero Crupón',
    precio: 185000,
    descripcion: 'Bota de seguridad con puntera de acero, ideal para trabajos pesados.',
    foto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'
  },
  {
    referencia: 'REF-210',
    nombre: 'Tenis Urbano Casual',
    tallas: [35, 36, 37, 38, 39, 40, 41],
    colores: ['Blanco', 'Azul', 'Rojo'],
    suela: 'Poliuretano (PU)',
    material: 'Lona reforzada y gamuza',
    precio: 120000,
    descripcion: 'Calzado ligero para uso diario, súper cómodo.',
    foto: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80'
  }
];

const nominas = [
  { usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 100000, fecha: '2025-05-31', semana: 22, ano: 2025, estado: 'pagada' },
  { usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 50000, fecha: '2025-05-31', semana: 22, ano: 2025, estado: 'pagada' },
  { usuario_id: 5, salario: 1423500, deducciones: 114900, bonificaciones: 0, fecha: '2025-05-31', semana: 22, ano: 2025, estado: 'pagada' },
  { usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 100000, fecha: '2025-04-30', semana: 18, ano: 2025, estado: 'pagada' },
  { usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 50000, fecha: '2025-04-30', semana: 18, ano: 2025, estado: 'pagada' },
  { usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 120000, fecha: today, semana: getWeekAndYear(today).week, ano: getWeekAndYear(today).year, estado: 'pendiente' },
  { usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 60000, fecha: today, semana: getWeekAndYear(today).week, ano: getWeekAndYear(today).year, estado: 'pendiente' },
  { usuario_id: 5, salario: 1423500, deducciones: 114900, bonificaciones: 20000, fecha: today, semana: getWeekAndYear(today).week, ano: getWeekAndYear(today).year, estado: 'pendiente' },
];

const inventario = [
  { nombre: 'Cuero bovino natural', cantidad: 45, unidad: 'metros', proveedor: 'Curtidos Bogotá S.A.', precio_unitario: 28000, stock_minimo: 20, fecha_actualizacion: today, categoria: 'Materia Prima' },
  { nombre: 'Suela de caucho negra', cantidad: 120, unidad: 'pares', proveedor: 'Sintéticos del Valle', precio_unitario: 8500, stock_minimo: 50, fecha_actualizacion: today, categoria: 'Componentes' },
  { nombre: 'Hilo encerado 18/3', cantidad: 8, unidad: 'conos', proveedor: 'Hilos y Punto', precio_unitario: 12000, stock_minimo: 15, fecha_actualizacion: today, categoria: 'Insumos' },
  { nombre: 'Pegante industrial', cantidad: 22, unidad: 'litros', proveedor: 'Químicos Andinos', precio_unitario: 35000, stock_minimo: 10, fecha_actualizacion: today, categoria: 'Insumos' },
  { nombre: 'Plantilla anatómica', cantidad: 200, unidad: 'pares', proveedor: 'Confortex Ltda.', precio_unitario: 5200, stock_minimo: 80, fecha_actualizacion: today, categoria: 'Componentes' },
  { nombre: 'Hebillas metálicas doradas', cantidad: 350, unidad: 'unidades', proveedor: 'Metales & Accesorios', precio_unitario: 1800, stock_minimo: 100, fecha_actualizacion: today, categoria: 'Accesorios' },
  { nombre: 'Cuero sintético café', cantidad: 12, unidad: 'metros', proveedor: 'Curtidos Bogotá S.A.', precio_unitario: 18000, stock_minimo: 20, fecha_actualizacion: today, categoria: 'Materia Prima' },
  { nombre: 'Caja de empaque calzado', cantidad: 180, unidad: 'unidades', proveedor: 'Empaques Rápidos', precio_unitario: 2500, stock_minimo: 60, fecha_actualizacion: today, categoria: 'Empaque' },
];

const tareas = [
  { descripcion: 'Cortar plantillas para referencia 305', usuario_id: 3, asignado_por: 2, estado: 'completada', prioridad: 'alta', fecha_vencimiento: '2025-05-28', fecha_creacion: '2025-05-25', categoria: 'Producción', catalogo_id: 1, talla: 39, color: 'Negro', cantidad_pares: 12, etapa_actual: 'listo', historial_etapas: JSON.stringify([{ etapa: 'corte', usuario_id: 3, fecha_inicio: '2025-05-25T08:00:00.000Z', fecha_fin: '2025-05-28T17:00:00.000Z' }]) },
  { descripcion: 'Ensamblar lote de zapatos referencia 210', usuario_id: 4, asignado_por: 2, estado: 'en_progreso', prioridad: 'alta', fecha_vencimiento: today, fecha_creacion: '2025-05-26', categoria: 'Producción', catalogo_id: 2, talla: 38, color: 'Rojo', cantidad_pares: 24, etapa_actual: 'guarnecido', historial_etapas: JSON.stringify([{ etapa: 'corte', usuario_id: 3, fecha_inicio: '2025-05-26T08:00:00.000Z', fecha_fin: '2025-05-27T12:00:00.000Z' }, { etapa: 'guarnecido', usuario_id: 4, fecha_inicio: '2025-05-27T13:00:00.000Z', fecha_fin: null }]) },
  { descripcion: 'Control de calidad lote 45 pares', usuario_id: 5, asignado_por: 2, estado: 'pendiente', prioridad: 'media', fecha_vencimiento: '2025-06-10', fecha_creacion: today, categoria: 'Calidad', catalogo_id: 1, talla: 40, color: 'Negro', cantidad_pares: 45, etapa_actual: 'soladura', historial_etapas: JSON.stringify([{ etapa: 'corte', usuario_id: 3, fecha_inicio: today + 'T08:00:00.000Z', fecha_fin: today + 'T11:00:00.000Z' }, { etapa: 'guarnecido', usuario_id: 4, fecha_inicio: today + 'T11:00:00.000Z', fecha_fin: today + 'T14:00:00.000Z' }, { etapa: 'soladura', usuario_id: 5, fecha_inicio: today + 'T14:00:00.000Z', fecha_fin: null }]) },
];

async function seed() {
  console.log('Seeding data to PostgreSQL...');
  try {
    await pool.query(`DROP TABLE IF EXISTS notificaciones, nominas, tareas, inventario, catalogo, usuarios CASCADE;`);
    
    await pool.query(`
      CREATE TABLE usuarios (
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

      CREATE TABLE catalogo (
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

      CREATE TABLE inventario (
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

      CREATE TABLE tareas (
        id SERIAL PRIMARY KEY,
        descripcion TEXT,
        usuario_id INTEGER REFERENCES usuarios(id),
        asignado_por INTEGER REFERENCES usuarios(id),
        estado TEXT DEFAULT 'pendiente',
        prioridad TEXT DEFAULT 'media',
        fecha_vencimiento DATE,
        fecha_creacion DATE DEFAULT CURRENT_DATE,
        categoria TEXT,
        catalogo_id INTEGER REFERENCES catalogo(id),
        talla INTEGER,
        color TEXT,
        cantidad_pares INTEGER,
        etapa_actual TEXT DEFAULT 'corte',
        historial_etapas JSONB DEFAULT '[]'::jsonb
      );

      CREATE TABLE nominas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
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

      CREATE TABLE notificaciones (
        id SERIAL PRIMARY KEY,
        para_usuario_id INTEGER REFERENCES usuarios(id),
        tipo TEXT,
        titulo TEXT,
        mensaje TEXT,
        tarea_id INTEGER,
        leida BOOLEAN DEFAULT false,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    for (const user of users) {
      await pool.query('INSERT INTO usuarios (nombre, email, password, rol, cargo, telefono, direccion) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.nombre, user.email, user.password, user.rol, user.cargo, user.telefono, user.direccion]);
    }
    
    for (const cat of catalogo) {
      await pool.query('INSERT INTO catalogo (referencia, nombre, tallas, colores, suela, material, precio, descripcion, foto) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [cat.referencia, cat.nombre, JSON.stringify(cat.tallas), JSON.stringify(cat.colores), cat.suela, cat.material, cat.precio, cat.descripcion, cat.foto]);
    }

    for (const nom of nominas) {
      await pool.query('INSERT INTO nominas (usuario_id, salario, deducciones, bonificaciones, fecha, semana, ano, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [nom.usuario_id, nom.salario, nom.deducciones, nom.bonificaciones, nom.fecha, nom.semana, nom.ano, nom.estado]);
    }

    for (const inv of inventario) {
      await pool.query('INSERT INTO inventario (nombre, cantidad, unidad, proveedor, precio_unitario, stock_minimo, categoria, fecha_actualizacion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [inv.nombre, inv.cantidad, inv.unidad, inv.proveedor, inv.precio_unitario, inv.stock_minimo, inv.categoria, inv.fecha_actualizacion]);
    }

    for (const t of tareas) {
      await pool.query('INSERT INTO tareas (descripcion, usuario_id, asignado_por, estado, prioridad, fecha_vencimiento, fecha_creacion, categoria, catalogo_id, talla, color, cantidad_pares, etapa_actual, historial_etapas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)', [t.descripcion, t.usuario_id, t.asignado_por, t.estado, t.prioridad, t.fecha_vencimiento, t.fecha_creacion, t.categoria, t.catalogo_id, t.talla, t.color, t.cantidad_pares, t.etapa_actual, t.historial_etapas]);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    pool.end();
  }
}

seed();
