require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool, types } = require('pg');
const path = require('path');

// Fix numeric returning as strings
types.setTypeParser(1700, function(val) {
  return parseFloat(val);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '')));

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true'
});

// Initialize Database Tables
const initDB = async () => {
  try {
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
    `);
    console.log("✅ Tablas inicializadas.");
  } catch (error) {
    console.error("❌ Error al inicializar las tablas:", error.message);
  }
};

const PORT = process.env.PORT || 3000;

// Start server and initialize DB
(async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
})();
