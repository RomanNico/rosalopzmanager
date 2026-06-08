-- Seed script generated from js/db.js
-- Creates compatible tables (if missing) and inserts initial data

-- Users: insert into existing `usuarios` table if not present
INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (1, 'Admin Sistema', 'admin@bufalo.com', 'YWRtaW4xMjM=', 'administrador', 'Administración', '3001234567', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (2, 'Rigoberto Palacios', 'jefe@bufalo.com', 'amVmZTEyMw==', 'administrador', 'Dirección', '3109876543', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (3, 'Carlos Rodríguez', 'carlos@bufalo.com', 'ZW1wMTIz', 'empleado', 'Cortador', '3201112233', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (4, 'María López', 'maria@bufalo.com', 'ZW1wMTIz', 'empleado', 'Guarnecedor', '3154445566', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (5, 'Juan García', 'juan@bufalo.com', 'ZW1wMTIz', 'empleado', 'Solador', '3007778899', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, cargo, telefono, direccion, creado_en)
VALUES
  (6, 'Pedro Gómez', 'pedro@bufalo.com', 'ZW1wMTIz', 'empleado', 'Emplantillador', '3128889900', 'Bogotá DC', now())
ON CONFLICT (id) DO NOTHING;

-- Catalogo table (product catalog)
CREATE TABLE IF NOT EXISTS catalogo (
  id INTEGER PRIMARY KEY,
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

INSERT INTO catalogo (id, referencia, nombre, tallas, colores, suela, material, precio, descripcion, foto, creado_en)
VALUES
  (1, 'REF-305', 'Bota Industrial Búfalo', '[38,39,40,41,42,43,44]'::jsonb, '["Negro","Marrón"]'::jsonb, 'Goma Antideslizante', 'Cuero Crupón', 185000, 'Bota de seguridad con puntera de acero, ideal para trabajos pesados.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalogo (id, referencia, nombre, tallas, colores, suela, material, precio, descripcion, foto, creado_en)
VALUES
  (2, 'REF-210', 'Tenis Urbano Casual', '[35,36,37,38,39,40,41]'::jsonb, '["Blanco","Azul","Rojo"]'::jsonb, 'Poliuretano (PU)', 'Lona reforzada y gamuza', 120000, 'Calzado ligero para uso diario, súper cómodo.', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80', now())
ON CONFLICT (id) DO NOTHING;

-- Nominas (extended)
CREATE TABLE IF NOT EXISTS nominas_ext (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER,
  salario NUMERIC(12,2),
  deducciones NUMERIC(12,2),
  bonificaciones NUMERIC(12,2),
  fecha DATE,
  semana INTEGER,
  año INTEGER,
  estado TEXT
);

INSERT INTO nominas_ext (id, usuario_id, salario, deducciones, bonificaciones, fecha, semana, año, estado)
VALUES
  (1, 3, 1423500, 114900, 100000, '2025-05-31', 22, 2025, 'pagada'),
  (2, 4, 1423500, 114900, 50000, '2025-05-31', 22, 2025, 'pagada'),
  (3, 5, 1423500, 114900, 0, '2025-05-31', 22, 2025, 'pagada'),
  (4, 3, 1423500, 114900, 100000, '2025-04-30', 18, 2025, 'pagada'),
  (5, 4, 1423500, 114900, 50000, '2025-04-30', 18, 2025, 'pagada')
ON CONFLICT (id) DO NOTHING;

-- Inventario (extended)
CREATE TABLE IF NOT EXISTS inventario_ext (
  id INTEGER PRIMARY KEY,
  nombre TEXT,
  cantidad INTEGER,
  unidad TEXT,
  proveedor TEXT,
  precio_unitario NUMERIC(12,2),
  stock_minimo INTEGER,
  fecha_actualizacion DATE,
  categoria TEXT
);

INSERT INTO inventario_ext (id, nombre, cantidad, unidad, proveedor, precio_unitario, stock_minimo, fecha_actualizacion, categoria)
VALUES
  (1, 'Cuero bovino natural', 45, 'metros', 'Curtidos Bogotá S.A.', 28000, 20, now()::date, 'Materia Prima'),
  (2, 'Suela de caucho negra', 120, 'pares', 'Sintéticos del Valle', 8500, 50, now()::date, 'Componentes'),
  (3, 'Hilo encerado 18/3', 8, 'conos', 'Hilos y Punto', 12000, 15, now()::date, 'Insumos'),
  (4, 'Pegante industrial', 22, 'litros', 'Químicos Andinos', 35000, 10, now()::date, 'Insumos'),
  (5, 'Plantilla anatómica', 200, 'pares', 'Confortex Ltda.', 5200, 80, now()::date, 'Componentes'),
  (6, 'Hebillas metálicas doradas', 350, 'unidades', 'Metales & Accesorios', 1800, 100, now()::date, 'Accesorios'),
  (7, 'Cuero sintético café', 12, 'metros', 'Curtidos Bogotá S.A.', 18000, 20, now()::date, 'Materia Prima'),
  (8, 'Caja de empaque calzado', 180, 'unidades', 'Empaques Rápidos', 2500, 60, now()::date, 'Empaque')
ON CONFLICT (id) DO NOTHING;

-- Tareas table
CREATE TABLE IF NOT EXISTS tareas (
  id INTEGER PRIMARY KEY,
  descripcion TEXT,
  usuario_id INTEGER,
  asignado_por INTEGER,
  estado TEXT,
  prioridad TEXT,
  fecha_vencimiento DATE,
  fecha_creacion DATE,
  categoria TEXT,
  catalogo_id INTEGER,
  talla INTEGER,
  color TEXT,
  cantidad_pares INTEGER,
  etapa_actual TEXT,
  historial_etapas JSONB
);

INSERT INTO tareas (id, descripcion, usuario_id, asignado_por, estado, prioridad, fecha_vencimiento, fecha_creacion, categoria, catalogo_id, talla, color, cantidad_pares, etapa_actual, historial_etapas)
VALUES
  (1, 'Cortar plantillas para referencia 305', 3, 2, 'completada', 'alta', '2025-05-28', '2025-05-25', 'Producción', 1, 39, 'Negro', 12, 'listo', '[{"etapa":"corte","usuario_id":3,"fecha_inicio":"2025-05-25T08:00:00.000Z","fecha_fin":"2025-05-28T17:00:00.000Z"}]'::jsonb),
  (2, 'Ensamblar lote de zapatos referencia 210', 4, 2, 'en_progreso', 'alta', now()::date, '2025-05-26', 'Producción', 2, 38, 'Rojo', 24, 'guarnecido', '[{"etapa":"corte","usuario_id":3,"fecha_inicio":"2025-05-26T08:00:00.000Z","fecha_fin":"2025-05-27T12:00:00.000Z"},{"etapa":"guarnecido","usuario_id":4,"fecha_inicio":"2025-05-27T13:00:00.000Z","fecha_fin":null}]'::jsonb),
  (3, 'Control de calidad lote 45 pares', 5, 2, 'pendiente', 'media', '2025-06-10', now()::date, 'Calidad', 1, 40, 'Negro', 45, 'soladura', '[{"etapa":"corte","usuario_id":3,"fecha_inicio":' || quote_literal(now()::date || 'T08:00:00.000Z') || ',"fecha_fin":' || quote_literal(now()::date || 'T11:00:00.000Z') || '},{"etapa":"guarnecido","usuario_id":4,"fecha_inicio":' || quote_literal(now()::date || 'T11:00:00.000Z') || ',"fecha_fin":' || quote_literal(now()::date || 'T14:00:00.000Z') || '},{"etapa":"soladura","usuario_id":5,"fecha_inicio":' || quote_literal(now()::date || 'T14:00:00.000Z') || ',"fecha_fin":null}]'::jsonb),
  (4, 'Inventario semanal de materiales', 3, 2, 'pendiente', 'media', '2025-06-08', now()::date, 'Inventario', 1, 39, 'Marrón', 10, 'corte', '[{"etapa":"corte","usuario_id":3,"fecha_inicio":' || quote_literal(now()::date || 'T08:00:00.000Z') || ',"fecha_fin":null}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Reportes y notificaciones (tables created empty)
CREATE TABLE IF NOT EXISTS reportes (
  id SERIAL PRIMARY KEY,
  contenido JSONB,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER,
  mensaje TEXT,
  leida BOOLEAN DEFAULT false,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adjust sequences (set to max id)
SELECT pg_catalog.setval(pg_get_serial_sequence('usuarios','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM usuarios), 1));
SELECT pg_catalog.setval(pg_get_serial_sequence('reportes','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM reportes), 1));

-- Done
-- Run this file with psql using your credentials.
