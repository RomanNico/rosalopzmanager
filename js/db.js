/**
 * ROSALOPZManager - Database Module
 * Caché en localStorage sincronizada con PostgreSQL a través de server.js (/api)
 * Fábrica de Calzado Bufalo R.P.
 */

const DB = (() => {
  const PREFIX = 'rosalopz_';

  /* ---- Helpers ---- */
  const get = (table) => JSON.parse(localStorage.getItem(PREFIX + table) || '[]');
  const set = (table, data) => localStorage.setItem(PREFIX + table, JSON.stringify(data));
  const nextId = (table) => {
    const items = get(table);
    return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  };
  // TimeHelper viene de utils.js (se carga antes que este archivo)
  const now = () => TimeHelper.getBogotaNow();
  const today = () => TimeHelper.getBogotaToday();


  // Semana ISO 8601 y su año (el mismo cálculo que usan los filtros y reportes)
  const getWeekAndYear = (dateStr) => TimeHelper.getIsoWeek(dateStr);

  /* ---- Migrations for Schema Updates ---- */
  const migrate = () => {
    // 0. Ensure notificaciones table exists
    if (!localStorage.getItem(PREFIX + 'notificaciones')) {
      set('notificaciones', []);
    }
    // Convert any legacy 'jefe' roles to 'administrador' and normalize all roles to lowercase
    const existingUsers = get('usuarios');
    let converted = false;
    existingUsers.forEach(u => {
      if (u.rol === 'jefe') {
        u.rol = 'administrador';
        converted = true;
      }
      // Normalize all roles to lowercase
      if (u.rol && u.rol !== u.rol.toLowerCase()) {
        u.rol = u.rol.toLowerCase();
        converted = true;
      }
    });
    if (converted) set('usuarios', existingUsers);

    // 1. Ensure catalogo table exists
    if (!localStorage.getItem(PREFIX + 'catalogo')) {
      const defaultCatalogo = [
        {
          id: 1,
          referencia: 'REF-305',
          nombre: 'Bota Industrial Búfalo',
          tallas: [38, 39, 40, 41, 42],
          colores: ['Negro', 'Marrón'],
          suela: 'Goma Antideslizante',
          material: 'Cuero Crupón',
          precio: 185000,
          descripcion: 'Bota de seguridad con puntera de acero, ideal para trabajos pesados.',
          foto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
          creado_en: now()
        },
        {
          id: 2,
          referencia: 'REF-210',
          nombre: 'Tenis Urbano Casual',
          tallas: [35, 36, 37, 38, 39, 40],
          colores: ['Blanco', 'Azul', 'Rojo'],
          suela: 'Poliuretano (PU)',
          material: 'Lona reforzada y gamuza',
          precio: 120000,
          descripcion: 'Calzado ligero para uso diario, súper cómodo.',
          foto: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80',
          creado_en: now()
        }
      ];
      set('catalogo', defaultCatalogo);
    }

    // 2. Ensure users have cargo field and Pedro Gómez exists
    const users = get('usuarios');
    let usersUpdated = false;

    if (!users.find(u => u.email === 'pedro@bufalo.com')) {
      users.push({
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 6,
        nombre: 'Pedro Gómez',
        email: 'pedro@bufalo.com',
        password: btoa('emp123'),
        rol: 'empleado',
        cargo: 'Emplantillador',
        telefono: '3128889900',
        direccion: 'Bogotá DC',
        creado_en: now()
      });
      usersUpdated = true;
    }

    users.forEach(u => {
      if (!u.cargo) {
        usersUpdated = true;
        if (u.rol === 'administrador') u.cargo = 'Administración';
        else if (u.rol === 'jefe') u.cargo = 'Dirección';
        else {
          if (u.id === 3 || u.nombre.includes('Carlos')) u.cargo = 'Cortador';
          else if (u.id === 4 || u.nombre.includes('María')) u.cargo = 'Guarnecedor';
          else if (u.id === 5 || u.nombre.includes('Juan')) u.cargo = 'Solador';
          else u.cargo = 'Ayudante';
        }
      }
    });

    if (usersUpdated) {
      set('usuarios', users);
    }

    // 3. Ensure tasks have shoe details and stage histories
    const tasks = get('tareas');
    let tasksUpdated = false;
    tasks.forEach(t => {
      if (t.catalogo_id === undefined) {
        tasksUpdated = true;
        t.catalogo_id = 1;
        t.talla = 39;
        t.color = 'Negro';
        t.cantidad_pares = 12;
        t.etapa_actual = t.estado === 'completada' ? 'listo' : 'corte';
        t.historial_etapas = [
          {
            etapa: 'corte',
            usuario_id: t.usuario_id || 3,
            fecha_inicio: (t.fecha_creacion || today()) + 'T08:00:00.000Z',
            fecha_fin: t.estado === 'completada' ? (t.fecha_vencimiento || today()) + 'T17:00:00.000Z' : null
          }
        ];
      }
    });
    if (tasksUpdated) {
      set('tareas', tasks);
    }

    // 4. Ensure payrolls have week and year
    const nominas = get('nominas');
    let nominasUpdated = false;
    nominas.forEach(n => {
      if (n.semana === undefined) {
        nominasUpdated = true;
        const wy = getWeekAndYear(n.fecha || today());
        n.semana = wy.week;
        n.año = wy.year;
      }
    });
    if (nominasUpdated) {
      set('nominas', nominas);
    }
  };

  /* ---- Sincronización con PostgreSQL (server.js) ---- */
  // Si la página la sirve server.js se usa el mismo origen; si se abre como archivo, localhost:3000
  const API_BASE = (typeof location !== 'undefined' && location.protocol.startsWith('http'))
    ? location.origin + '/api'
    : 'http://localhost:3000/api';
  const TOKEN_KEY = 'rosalopz_token';
  let apiOnline = false;
  let syncQueue = Promise.resolve();

  const getToken = () => sessionStorage.getItem(TOKEN_KEY);
  const authHeaders = () => {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  };
  // app.js escucha estos eventos para cerrar sesión o mostrar el error
  const emit = (name, detail) => {
    if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  // Petición que espera la respuesta (login, cambio de contraseña, sync)
  const api = async (method, path, body) => {
    const res = await fetch(API_BASE + path, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (res.status === 401 && getToken()) emit('rosalopz:sesion-expirada');
    return { ok: res.ok, status: res.status, data: data || {} };
  };

  // Escrituras en segundo plano, encadenadas para que lleguen en orden (crear antes de editar, etc.)
  const syncAction = (method, table, id, data) => {
    if (!apiOnline || !getToken()) return;
    let url = `${API_BASE}/${table}`;
    if (id) url += '/' + id;
    syncQueue = syncQueue
      .then(() => fetch(url, { method, headers: authHeaders(), body: data ? JSON.stringify(data) : undefined }))
      .then(async (res) => {
        if (res.ok) return;
        if (res.status === 401) return emit('rosalopz:sesion-expirada');
        let msg = `Error ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch (e) { /* ignorar */ }
        console.error(`Sync ${method} ${table}/${id || ''} falló:`, msg);
        emit('rosalopz:error-sync', msg);
      })
      .catch(e => {
        console.error('Sync Error:', e);
        emit('rosalopz:error-sync', 'No se pudo guardar en el servidor. Revisa que esté encendido.');
      });
  };
  // Guarda el registro completo (crear o actualizar con el id del frontend)
  const syncSave = (table, record) => record && syncAction('PUT', table, record.id, record);
  // Crea sin id: el servidor lo asigna (se usa en notificaciones, que crean usuarios distintos)
  const syncCreate = (table, record) => {
    const { id, ...rest } = record;
    syncAction('POST', table, null, rest);
  };
  const syncDelete = (table, id) => syncAction('DELETE', table, id);

  const checkServer = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  // Descarga los datos del usuario que inició sesión
  const syncFromServer = async () => {
    try {
      const r = await api('GET', '/sync');
      if (!r.ok || !Array.isArray(r.data.usuarios)) return false;
      loadFromServer(r.data);
      return true;
    } catch (e) {
      return false;
    }
  };

  /* ---- Init / Seed ---- */
  const init = async () => {
    apiOnline = await checkServer();

    if (apiOnline) {
      // Con servidor: los datos se descargan después del login (o ahora, si ya hay sesión)
      if (getToken() && !(await syncFromServer())) Session.clear();
      return;
    }

    console.warn('%c⚠️ Servidor no disponible: modo sin conexión (los datos quedan solo en este navegador)', 'color: #f8a80c');
    if (!localStorage.getItem(PREFIX + 'initialized')) seedLocal();
    migrate();
  };

  // Al cerrar sesión con servidor, no dejar datos de la empresa guardados en el navegador
  const logout = () => {
    Session.clear();
    if (apiOnline) {
      LOCAL_TABLES.forEach(t => localStorage.removeItem(PREFIX + t));
      localStorage.removeItem(PREFIX + 'initialized');
    }
  };

  const LOCAL_TABLES = ['usuarios', 'catalogo', 'inventario', 'tareas', 'nominas', 'notificaciones', 'reportes'];

  // Antes de la versión con PostgreSQL todo vivía solo en el navegador. La primera vez que
  // la base reemplaza esos datos, se guarda una copia en 'rosalopz_backup_local' por si acaso.
  const backupLocalOnce = () => {
    if (localStorage.getItem(PREFIX + 'backup_local') || !localStorage.getItem(PREFIX + 'initialized')) return;
    const backup = { fecha: now() };
    LOCAL_TABLES.forEach(t => { backup[t] = get(t); });
    localStorage.setItem(PREFIX + 'backup_local', JSON.stringify(backup));
    console.log('%c💾 Copia de los datos locales guardada en localStorage["rosalopz_backup_local"]', 'color: #f8a80c');
  };

  const loadFromServer = (data) => {
        backupLocalOnce();
        // Normalize types from PostgreSQL (all numeric fields may come as strings)
        const parseNum = (v) => v !== null && v !== undefined && v !== '' ? parseFloat(v) : 0;
        const parseId = (v) => v !== null && v !== undefined ? parseInt(v) : null;

        const normalizedUsuarios = data.usuarios.map(u => ({
          ...u, 
          id: parseId(u.id),
          // 'jefe' es un rol antiguo: equivale a administrador
          rol: (u.rol || '').toLowerCase() === 'jefe' ? 'administrador' : (u.rol || '').toLowerCase(),
          debe_cambiar_password: u.debe_cambiar_password === true,
        }));
        const normalizedCatalogo = data.catalogo.map(c => ({
          ...c, id: parseId(c.id),
          precio: parseNum(c.precio),
          tallas: Array.isArray(c.tallas) ? c.tallas.map(Number) : [],
          colores: Array.isArray(c.colores) ? c.colores : [],
        }));
        const normalizedInventario = data.inventario.map(i => ({
          ...i, id: parseId(i.id),
          cantidad: parseInt(i.cantidad) || 0,
          precio_unitario: parseNum(i.precio_unitario),
          stock_minimo: Number.isNaN(parseInt(i.stock_minimo)) ? 10 : parseInt(i.stock_minimo),
        }));
        const normalizedTareas = data.tareas.map(t => ({
          ...t, id: parseId(t.id),
          usuario_id: parseId(t.usuario_id),
          asignado_por: parseId(t.asignado_por),
          catalogo_id: parseId(t.catalogo_id),
          talla: t.talla ? parseInt(t.talla) : null,
          cantidad_pares: parseInt(t.cantidad_pares) || 0,
          tallas_lote: Array.isArray(t.tallas_lote) ? t.tallas_lote.map(Number) : [],
          historial_etapas: Array.isArray(t.historial_etapas) ? t.historial_etapas.map(h => ({
            ...h, usuario_id: parseId(h.usuario_id)
          })) : [],
        }));
        const normalizedNominas = data.nominas.map(n => ({
          ...n, id: parseId(n.id),
          usuario_id: parseId(n.usuario_id),
          salario: parseNum(n.salario),
          deducciones: parseNum(n.deducciones),
          bonificaciones: parseNum(n.bonificaciones),
          semana: parseInt(n.semana) || 0,
          ano: parseInt(n.ano) || parseInt(n.año) || new Date().getFullYear(),
          año: parseInt(n.ano) || parseInt(n.año) || new Date().getFullYear(),
        }));
        const normalizedNotificaciones = data.notificaciones.map(n => ({
          ...n, id: parseId(n.id),
          para_usuario_id: parseId(n.para_usuario_id),
          tarea_id: parseId(n.tarea_id),
          leida: n.leida === true || n.leida === 't' || n.leida === 'true',
        }));

        const normalizedReportes = (data.reportes || []).map(r => ({
          ...r, id: parseId(r.id),
          generado_por: parseId(r.generado_por),
          contenido: r.contenido || {},
        }));

        set('usuarios', normalizedUsuarios);
        set('catalogo', normalizedCatalogo);
        set('inventario', normalizedInventario);
        set('tareas', normalizedTareas);
        set('nominas', normalizedNominas);
        set('notificaciones', normalizedNotificaciones);
        set('reportes', normalizedReportes);
        localStorage.setItem(PREFIX + 'initialized', '1');
        console.log('%c✅ Datos sincronizados desde PostgreSQL', 'color: #06d6a0; font-weight: bold');
  };

  const seedLocal = () => {
    // Seed users
    const users = [
      { id: 1, nombre: 'Admin Sistema', email: 'admin@bufalo.com', password: btoa('admin123'), rol: 'administrador', cargo: 'Administración', telefono: '3001234567', direccion: 'Bogotá DC', creado_en: now() },
       { id: 2, nombre: 'Rigoberto Palacios', email: 'jefe@bufalo.com', password: btoa('jefe123'), rol: 'administrador', cargo: 'Dirección', telefono: '3109876543', direccion: 'Bogotá DC', creado_en: now() },
      { id: 3, nombre: 'Carlos Rodríguez', email: 'carlos@bufalo.com', password: btoa('emp123'), rol: 'empleado', cargo: 'Cortador', telefono: '3201112233', direccion: 'Bogotá DC', creado_en: now() },
      { id: 4, nombre: 'María López', email: 'maria@bufalo.com', password: btoa('emp123'), rol: 'empleado', cargo: 'Guarnecedor', telefono: '3154445566', direccion: 'Bogotá DC', creado_en: now() },
      { id: 5, nombre: 'Juan García', email: 'juan@bufalo.com', password: btoa('emp123'), rol: 'empleado', cargo: 'Solador', telefono: '3007778899', direccion: 'Bogotá DC', creado_en: now() },
      { id: 6, nombre: 'Pedro Gómez', email: 'pedro@bufalo.com', password: btoa('emp123'), rol: 'empleado', cargo: 'Emplantillador', telefono: '3128889900', direccion: 'Bogotá DC', creado_en: now() },
    ];
    set('usuarios', users);

    // Seed catalogo
    const catalogo = [
      {
        id: 1,
        referencia: 'REF-305',
        nombre: 'Bota Industrial Búfalo',
        tallas: [38, 39, 40, 41, 42, 43, 44],
        colores: ['Negro', 'Marrón'],
        suela: 'Goma Antideslizante',
        material: 'Cuero Crupón',
        precio: 185000,
        descripcion: 'Bota de seguridad con puntera de acero, ideal para trabajos pesados.',
        foto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
        creado_en: now()
      },
      {
        id: 2,
        referencia: 'REF-210',
        nombre: 'Tenis Urbano Casual',
        tallas: [35, 36, 37, 38, 39, 40, 41],
        colores: ['Blanco', 'Azul', 'Rojo'],
        suela: 'Poliuretano (PU)',
        material: 'Lona reforzada y gamuza',
        precio: 120000,
        descripcion: 'Calzado ligero para uso diario, súper cómodo.',
        foto: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80',
        creado_en: now()
      }
    ];
    set('catalogo', catalogo);

    // Seed nóminas
    const nominas = [
      { id: 1, usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 100000, fecha: '2025-05-31', semana: 22, año: 2025, estado: 'pagada' },
      { id: 2, usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 50000, fecha: '2025-05-31', semana: 22, año: 2025, estado: 'pagada' },
      { id: 3, usuario_id: 5, salario: 1423500, deducciones: 114900, bonificaciones: 0, fecha: '2025-05-31', semana: 22, año: 2025, estado: 'pagada' },
      { id: 4, usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 100000, fecha: '2025-04-30', semana: 18, año: 2025, estado: 'pagada' },
      { id: 5, usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 50000, fecha: '2025-04-30', semana: 18, año: 2025, estado: 'pagada' },
      { id: 6, usuario_id: 3, salario: 1423500, deducciones: 114900, bonificaciones: 120000, fecha: today(), semana: getWeekAndYear(today()).week, año: getWeekAndYear(today()).year, estado: 'pendiente' },
      { id: 7, usuario_id: 4, salario: 1423500, deducciones: 114900, bonificaciones: 60000, fecha: today(), semana: getWeekAndYear(today()).week, año: getWeekAndYear(today()).year, estado: 'pendiente' },
      { id: 8, usuario_id: 5, salario: 1423500, deducciones: 114900, bonificaciones: 20000, fecha: today(), semana: getWeekAndYear(today()).week, año: getWeekAndYear(today()).year, estado: 'pendiente' },
    ];
    set('nominas', nominas);

    // Seed inventario
    const inventario = [
      { id: 1, nombre: 'Cuero bovino natural', cantidad: 45, unidad: 'metros', proveedor: 'Curtidos Bogotá S.A.', precio_unitario: 28000, stock_minimo: 20, fecha_actualizacion: today(), categoria: 'Materia Prima' },
      { id: 2, nombre: 'Suela de caucho negra', cantidad: 120, unidad: 'pares', proveedor: 'Sintéticos del Valle', precio_unitario: 8500, stock_minimo: 50, fecha_actualizacion: today(), categoria: 'Componentes' },
      { id: 3, nombre: 'Hilo encerado 18/3', cantidad: 8, unidad: 'conos', proveedor: 'Hilos y Punto', precio_unitario: 12000, stock_minimo: 15, fecha_actualizacion: today(), categoria: 'Insumos' },
      { id: 4, nombre: 'Pegante industrial', cantidad: 22, unidad: 'litros', proveedor: 'Químicos Andinos', precio_unitario: 35000, stock_minimo: 10, fecha_actualizacion: today(), categoria: 'Insumos' },
      { id: 5, nombre: 'Plantilla anatómica', cantidad: 200, unidad: 'pares', proveedor: 'Confortex Ltda.', precio_unitario: 5200, stock_minimo: 80, fecha_actualizacion: today(), categoria: 'Componentes' },
      { id: 6, nombre: 'Hebillas metálicas doradas', cantidad: 350, unidad: 'unidades', proveedor: 'Metales & Accesorios', precio_unitario: 1800, stock_minimo: 100, fecha_actualizacion: today(), categoria: 'Accesorios' },
      { id: 7, nombre: 'Cuero sintético café', cantidad: 12, unidad: 'metros', proveedor: 'Curtidos Bogotá S.A.', precio_unitario: 18000, stock_minimo: 20, fecha_actualizacion: today(), categoria: 'Materia Prima' },
      { id: 8, nombre: 'Caja de empaque calzado', cantidad: 180, unidad: 'unidades', proveedor: 'Empaques Rápidos', precio_unitario: 2500, stock_minimo: 60, fecha_actualizacion: today(), categoria: 'Empaque' },
    ];
    set('inventario', inventario);

    // Seed tareas
    const tareas = [
      { 
        id: 1, 
        descripcion: 'Cortar plantillas para referencia 305', 
        usuario_id: 3, 
        asignado_por: 2, 
        estado: 'completada', 
        prioridad: 'alta', 
        fecha_vencimiento: '2025-05-28', 
        fecha_creacion: '2025-05-25', 
        categoria: 'Producción',
        catalogo_id: 1,
        talla: 39,
        color: 'Negro',
        cantidad_pares: 12,
        etapa_actual: 'listo',
        historial_etapas: [
          { etapa: 'corte', usuario_id: 3, fecha_inicio: '2025-05-25T08:00:00.000Z', fecha_fin: '2025-05-28T17:00:00.000Z' }
        ]
      },
      { 
        id: 2, 
        descripcion: 'Ensamblar lote de zapatos referencia 210', 
        usuario_id: 4, 
        asignado_por: 2, 
        estado: 'en_progreso', 
        prioridad: 'alta', 
        fecha_vencimiento: today(), 
        fecha_creacion: '2025-05-26', 
        categoria: 'Producción',
        catalogo_id: 2,
        talla: 38,
        color: 'Rojo',
        cantidad_pares: 24,
        etapa_actual: 'guarnecido',
        historial_etapas: [
          { etapa: 'corte', usuario_id: 3, fecha_inicio: '2025-05-26T08:00:00.000Z', fecha_fin: '2025-05-27T12:00:00.000Z' },
          { etapa: 'guarnecido', usuario_id: 4, fecha_inicio: '2025-05-27T13:00:00.000Z', fecha_fin: null }
        ]
      },
      { 
        id: 3, 
        descripcion: 'Control de calidad lote 45 pares', 
        usuario_id: 5, 
        asignado_por: 2, 
        estado: 'pendiente', 
        prioridad: 'media', 
        fecha_vencimiento: '2025-06-10', 
        fecha_creacion: today(), 
        categoria: 'Calidad',
        catalogo_id: 1,
        talla: 40,
        color: 'Negro',
        cantidad_pares: 45,
        etapa_actual: 'soladura',
        historial_etapas: [
          { etapa: 'corte', usuario_id: 3, fecha_inicio: today() + 'T08:00:00.000Z', fecha_fin: today() + 'T11:00:00.000Z' },
          { etapa: 'guarnecido', usuario_id: 4, fecha_inicio: today() + 'T11:00:00.000Z', fecha_fin: today() + 'T14:00:00.000Z' },
          { etapa: 'soladura', usuario_id: 5, fecha_inicio: today() + 'T14:00:00.000Z', fecha_fin: null }
        ]
      },
      { 
        id: 4, 
        descripcion: 'Inventario semanal de materiales', 
        usuario_id: 3, 
        asignado_por: 2, 
        estado: 'pendiente', 
        prioridad: 'media', 
        fecha_vencimiento: '2025-06-08', 
        fecha_creacion: today(), 
        categoria: 'Inventario',
        catalogo_id: 1,
        talla: 39,
        color: 'Marrón',
        cantidad_pares: 10,
        etapa_actual: 'corte',
        historial_etapas: [
          { etapa: 'corte', usuario_id: 3, fecha_inicio: today() + 'T08:00:00.000Z', fecha_fin: null }
        ]
      },
    ];
    set('tareas', tareas);

    // Seed reportes
    set('reportes', []);

    // Seed notificaciones (empty)
    set('notificaciones', []);

    localStorage.setItem(PREFIX + 'initialized', '1');
    console.log('%c✅ ROSALOPZManager DB local inicializada', 'color: #06d6a0; font-weight: bold');
  };

  /* ==============================
     USUARIOS CRUD
  ============================== */
  const cleanEmail = (email) => (email || '').replace(/﻿/g, '').trim().toLowerCase();

  const Usuarios = {
    getAll: () => get('usuarios'),
    getById: (id) => get('usuarios').find(u => u.id === id) || null,
    getByEmail: (email) => get('usuarios').find(u => u.email === cleanEmail(email)) || null,
    getEmpleados: () => get('usuarios').filter(u => u.rol === 'empleado'),
    getEmpleadosPorCargo: (cargo) => get('usuarios').filter(u => u.rol === 'empleado' && u.cargo === cargo),

    create: (data) => {
      const usuarios = get('usuarios');
      const normalizedEmail = cleanEmail(data.email);
      if (usuarios.find(u => u.email === normalizedEmail)) {
        return { error: 'El correo ya está registrado' };
      }
      const user = {
        id: nextId('usuarios'),
        nombre: data.nombre.trim(),
        email: normalizedEmail,
        rol: data.rol ? data.rol.toLowerCase() : 'empleado',
        cargo: data.cargo || (data.rol === 'empleado' ? 'Cortador' : 'Administración'),
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        creado_en: now(),
        // La contraseña inicial la puso el admin: el usuario deberá cambiarla al entrar
        debe_cambiar_password: true,
      };
      // Con servidor la contraseña viaja una sola vez y allá se guarda con hash;
      // en el navegador NO se guarda. Sin servidor (modo local) se guarda como antes.
      if (!apiOnline) user.password = btoa(data.password);
      usuarios.push(user);
      set('usuarios', usuarios);
      syncSave('usuarios', { ...user, password: data.password });
      return { ok: true, user };
    },

    update: (id, data) => {
      const usuarios = get('usuarios');
      const idx = usuarios.findIndex(u => u.id === id);
      if (idx === -1) return { error: 'Usuario no encontrado' };
      const changes = { ...data };
      delete changes.password; // la contraseña se cambia solo con changePassword()
      if (changes.email !== undefined) {
        changes.email = cleanEmail(changes.email);
        if (usuarios.some(u => u.email === changes.email && u.id !== id)) {
          return { error: 'El correo ya está registrado por otro usuario' };
        }
      }
      if (changes.nombre !== undefined) changes.nombre = changes.nombre.trim();
      if (changes.rol !== undefined) changes.rol = changes.rol.toLowerCase();
      usuarios[idx] = { ...usuarios[idx], ...changes, id };
      set('usuarios', usuarios);
      syncSave('usuarios', usuarios[idx]);
      return { ok: true, user: usuarios[idx] };
    },

    delete: (id) => {
      set('usuarios', get('usuarios').filter(u => u.id !== id));
      // Igual que en el servidor: soltar referencias del usuario eliminado
      set('notificaciones', get('notificaciones').filter(n => n.para_usuario_id !== id));
      syncDelete('usuarios', id);
      return { ok: true };
    },

    /**
     * Login. Con servidor la contraseña se verifica en server.js (hash scrypt) y se recibe un token.
     * Sin servidor (modo local) se compara con los datos del navegador.
     */
    login: async (email, password) => {
      if (apiOnline) {
        let r;
        try {
          r = await api('POST', '/login', { email: cleanEmail(email), password });
        } catch (e) {
          return { error: 'No se pudo conectar con el servidor' };
        }
        if (!r.ok) return { error: r.data.error || 'No se pudo iniciar sesión' };
        sessionStorage.setItem(TOKEN_KEY, r.data.token);
        if (!(await syncFromServer())) {
          Session.clear();
          return { error: 'No se pudieron cargar los datos del servidor' };
        }
        return { ok: true, user: r.data.user };
      }

      const user = get('usuarios').find(u => u.email && u.email === cleanEmail(email));
      if (user && !user.password) {
        return { error: 'El servidor no está disponible. Enciéndelo con "npm start" para iniciar sesión.' };
      }
      let encoded = null;
      try { encoded = btoa(password); } catch (e) { /* caracteres no válidos */ }
      if (!user || user.password !== encoded) return { error: 'Correo o contraseña incorrectos' };
      const { password: _, ...safeUser } = user;
      safeUser.rol = (safeUser.rol || '').toLowerCase();
      return { ok: true, user: safeUser };
    },

    /**
     * Cambia la contraseña. Si se pasa `actual` se verifica (cambio propio);
     * sin `actual` es un restablecimiento hecho por un administrador.
     */
    changePassword: async (id, nueva, actual) => {
      if (!nueva || nueva.length < 6) return { error: 'La nueva contraseña debe tener al menos 6 caracteres' };
      const propio = actual !== undefined;
      if (apiOnline) {
        try {
          const r = await api('POST', `/usuarios/${id}/password`, { actual, nueva });
          if (!r.ok) return { error: r.data.error || 'No se pudo cambiar la contraseña' };
        } catch (e) {
          return { error: 'No se pudo conectar con el servidor' };
        }
      }
      const usuarios = get('usuarios');
      const u = usuarios.find(x => x.id === id);
      if (!apiOnline) {
        if (!u) return { error: 'Usuario no encontrado' };
        if (propio && u.password !== btoa(actual)) return { error: 'Contraseña actual incorrecta' };
        if (propio && actual === nueva) return { error: 'La nueva contraseña debe ser diferente a la actual' };
        u.password = btoa(nueva);
      }
      // Igual que el servidor: si la pone un admin, el usuario deberá cambiarla al entrar
      if (u) {
        u.debe_cambiar_password = !propio;
        set('usuarios', usuarios);
      }
      return { ok: true };
    },

    /**
     * Restablecer (admin): genera una contraseña temporal y la devuelve UNA sola vez.
     * El usuario deberá cambiarla la próxima vez que entre.
     */
    resetPassword: async (id) => {
      let temporal;
      if (apiOnline) {
        try {
          const r = await api('POST', `/usuarios/${id}/reset-password`);
          if (!r.ok) return { error: r.data.error || 'No se pudo restablecer la contraseña' };
          temporal = r.data.temporal;
        } catch (e) {
          return { error: 'No se pudo conectar con el servidor' };
        }
      } else {
        const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        const rnd = crypto.getRandomValues(new Uint32Array(6));
        temporal = 'Bufalo-' + Array.from(rnd, n => alfabeto[n % alfabeto.length]).join('');
      }
      const usuarios = get('usuarios');
      const u = usuarios.find(x => x.id === id);
      if (u) {
        if (!apiOnline) u.password = btoa(temporal);
        u.debe_cambiar_password = true;
        set('usuarios', usuarios);
      }
      return { ok: true, temporal };
    },
  };

  /* ==============================
     CATÁLOGO CRUD
  ============================== */
  const Catalogo = {
    getAll: () => get('catalogo'),
    getById: (id) => get('catalogo').find(c => c.id === id) || null,
    create: (data) => {
      const catalogo = get('catalogo');
      const producto = {
        id: nextId('catalogo'),
        referencia: data.referencia.trim(),
        nombre: data.nombre.trim(),
        tallas: Array.isArray(data.tallas) ? data.tallas.map(Number) : [],
        colores: Array.isArray(data.colores) ? data.colores.map(c => c.trim()) : [],
        suela: data.suela ? data.suela.trim() : '',
        material: data.material ? data.material.trim() : '',
        precio: parseFloat(data.precio) || 0,
        descripcion: data.descripcion ? data.descripcion.trim() : '',
        foto: data.foto || '',
        creado_en: now(),
      };
      catalogo.push(producto);
      set('catalogo', catalogo);
      syncSave('catalogo', producto);
      return { ok: true, producto };
    },
    update: (id, data) => {
      const catalogo = get('catalogo');
      const idx = catalogo.findIndex(c => c.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };

      const prev = catalogo[idx];
      catalogo[idx] = {
        ...prev,
        ...data,
        referencia: data.referencia !== undefined ? data.referencia.trim() : prev.referencia,
        nombre: data.nombre !== undefined ? data.nombre.trim() : prev.nombre,
        precio: data.precio !== undefined ? (parseFloat(data.precio) || 0) : prev.precio,
        tallas: Array.isArray(data.tallas) ? data.tallas.map(Number) : prev.tallas,
        colores: Array.isArray(data.colores) ? data.colores.map(c => c.trim()) : prev.colores,
        id
      };
      set('catalogo', catalogo);
      syncSave('catalogo', catalogo[idx]);
      return { ok: true, producto: catalogo[idx] };
    },
    delete: (id) => {
      set('catalogo', get('catalogo').filter(c => c.id !== id));
      syncDelete('catalogo', id);
      return { ok: true };
    }
  };

  /* ==============================
     NÓMINAS CRUD
  ============================== */
  const withNeto = (n) => {
    const salario = parseFloat(n.salario) || 0;
    const deducciones = parseFloat(n.deducciones) || 0;
    const bonificaciones = parseFloat(n.bonificaciones) || 0;
    return {
      ...n,
      salario,
      deducciones,
      bonificaciones,
      neto: salario - deducciones + bonificaciones,
      semana: parseInt(n.semana) || 0,
      año: parseInt(n.año) || parseInt(n.ano) || new Date().getFullYear(),
    };
  };

  // Lo que se guarda (sin campos calculados)
  const nominaRecord = (n) => {
    const { neto, usuario, ...rec } = n;
    rec.ano = rec.año;
    return rec;
  };

  const Nominas = {
    getAll: () => {
      const usuarios = get('usuarios');
      return get('nominas').map(n => ({
        ...withNeto(n),
        usuario: usuarios.find(u => u.id === (parseInt(n.usuario_id) || n.usuario_id)) || null,
      }));
    },

    getByUsuario: (usuario_id) => {
      const uid = parseInt(usuario_id);
      return get('nominas').filter(n => parseInt(n.usuario_id) === uid).map(withNeto);
    },

    create: (data) => {
      const nominas = get('nominas');
      const dateVal = data.fecha || today();
      const wy = getWeekAndYear(dateVal);
      const nomina = {
        id: nextId('nominas'),
        usuario_id: parseInt(data.usuario_id),
        salario: parseFloat(data.salario) || 0,
        deducciones: parseFloat(data.deducciones) || 0,
        bonificaciones: parseFloat(data.bonificaciones) || 0,
        fecha: dateVal,
        semana: parseInt(data.semana) || wy.week,
        año: parseInt(data.año) || wy.year,
        estado: data.estado || 'pendiente',
        medio_pago: data.medio_pago || '',
        comprobante: data.comprobante || '',
      };
      nominas.push(nomina);
      set('nominas', nominas);
      syncSave('nominas', nominaRecord(nomina));
      return { ok: true, nomina: withNeto(nomina) };
    },

    update: (id, data) => {
      const nominas = get('nominas');
      const idx = nominas.findIndex(n => n.id === id);
      if (idx === -1) return { error: 'Nómina no encontrada' };

      const prev = nominas[idx];
      const changes = { ...data };
      if (changes.fecha) {
        const wy = getWeekAndYear(changes.fecha);
        changes.semana = wy.week;
        changes.año = wy.year;
      }
      if (changes.usuario_id !== undefined) changes.usuario_id = parseInt(changes.usuario_id);
      ['salario', 'deducciones', 'bonificaciones'].forEach(k => {
        if (changes[k] !== undefined) changes[k] = parseFloat(changes[k]) || 0;
      });

      nominas[idx] = {
        ...prev,
        ...changes,
        comprobante: changes.comprobante !== undefined ? changes.comprobante : prev.comprobante,
        medio_pago: changes.medio_pago !== undefined ? changes.medio_pago : (prev.medio_pago || ''),
        id
      };
      set('nominas', nominas);
      syncSave('nominas', nominaRecord(nominas[idx]));
      return { ok: true };
    },

    delete: (id) => {
      set('nominas', get('nominas').filter(n => n.id !== id));
      syncDelete('nominas', id);
      return { ok: true };
    },

    getTotales: () => {
      const nominas = Nominas.getAll();
      return {
        totalSalarios: nominas.reduce((s, n) => s + n.salario, 0),
        totalDeducciones: nominas.reduce((s, n) => s + n.deducciones, 0),
        totalBonos: nominas.reduce((s, n) => s + n.bonificaciones, 0),
        totalNeto: nominas.reduce((s, n) => s + n.neto, 0),
        pendientes: nominas.filter(n => n.estado === 'pendiente').length,
      };
    },
  };

  /* ==============================
     INVENTARIO CRUD
  ============================== */
  const toInt = (v, def = 0) => Number.isNaN(parseInt(v)) ? def : parseInt(v);

  const Inventario = {
    getAll: () => get('inventario'),
    getById: (id) => get('inventario').find(p => p.id === id) || null,
    getLowStock: () => get('inventario').filter(p => p.cantidad <= p.stock_minimo),

    create: (data) => {
      const inventario = get('inventario');
      const producto = {
        id: nextId('inventario'),
        nombre: data.nombre.trim(),
        cantidad: toInt(data.cantidad, 0),
        unidad: data.unidad || 'unidades',
        proveedor: data.proveedor || '',
        precio_unitario: parseFloat(data.precio_unitario) || 0,
        stock_minimo: toInt(data.stock_minimo, 10),
        categoria: data.categoria || 'General',
        fecha_actualizacion: today(),
      };
      inventario.push(producto);
      set('inventario', inventario);
      syncSave('inventario', producto);
      return { ok: true, producto };
    },

    update: (id, data) => {
      const inventario = get('inventario');
      const idx = inventario.findIndex(p => p.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };
      const prev = inventario[idx];
      inventario[idx] = {
        ...prev,
        ...data,
        nombre: data.nombre !== undefined ? data.nombre.trim() : prev.nombre,
        cantidad: data.cantidad !== undefined ? toInt(data.cantidad, 0) : prev.cantidad,
        precio_unitario: data.precio_unitario !== undefined ? (parseFloat(data.precio_unitario) || 0) : prev.precio_unitario,
        stock_minimo: data.stock_minimo !== undefined ? toInt(data.stock_minimo, 10) : prev.stock_minimo,
        id,
        fecha_actualizacion: today(),
      };
      set('inventario', inventario);
      syncSave('inventario', inventario[idx]);
      return { ok: true, producto: inventario[idx] };
    },

    ajustarStock: (id, cantidad, tipo) => {
      const inventario = get('inventario');
      const idx = inventario.findIndex(p => p.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };
      const qty = toInt(cantidad, 0);
      const actual = toInt(inventario[idx].cantidad, 0);
      if (tipo !== 'entrada' && qty > actual) {
        return { error: `No hay suficiente stock (disponible: ${actual} ${inventario[idx].unidad})` };
      }
      inventario[idx].cantidad = tipo === 'entrada' ? actual + qty : actual - qty;
      inventario[idx].fecha_actualizacion = today();
      set('inventario', inventario);
      syncSave('inventario', inventario[idx]);
      return { ok: true, producto: inventario[idx] };
    },

    delete: (id) => {
      set('inventario', get('inventario').filter(p => p.id !== id));
      syncDelete('inventario', id);
      return { ok: true };
    },

    getStats: () => {
      const inv = get('inventario');
      return {
        totalProductos: inv.length,
        stockBajo: inv.filter(p => p.cantidad <= p.stock_minimo).length,
        valorTotal: inv.reduce((s, p) => s + p.cantidad * p.precio_unitario, 0),
        categorias: [...new Set(inv.map(p => p.categoria))].length,
      };
    },
  };

  /* ==============================
     TAREAS CRUD (con Pipeline de Calzado)
  ============================== */
  const ETAPAS = ['corte', 'guarnecido', 'soladura', 'emplantillado', 'listo'];

  const Tareas = {
    ETAPAS,

    getAll: () => {
      const tareas = get('tareas');
      const usuarios = get('usuarios');
      const catalogo = get('catalogo');
      return tareas.map(t => ({
        ...t,
        historial_etapas: Array.isArray(t.historial_etapas) ? t.historial_etapas : [],
        empleado: usuarios.find(u => u.id === t.usuario_id) || null,
        asignador: usuarios.find(u => u.id === t.asignado_por) || null,
        producto: catalogo.find(c => c.id === t.catalogo_id) || null,
      }));
    },

    getByUsuario: (usuario_id) => Tareas.getAll().filter(t => t.usuario_id === usuario_id),

    create: (data) => {
      const tareas = get('tareas');
      const usuarioId = parseInt(data.usuario_id) || null;
      const tallasLote = Array.isArray(data.tallas_lote) ? data.tallas_lote.map(Number) : [];
      const tarea = {
        id: nextId('tareas'),
        descripcion: data.descripcion.trim(),
        usuario_id: usuarioId,
        asignado_por: parseInt(data.asignado_por) || null,
        estado: data.estado || 'pendiente',
        prioridad: data.prioridad || 'media',
        categoria: 'Producción',
        fecha_vencimiento: data.fecha_vencimiento,
        fecha_creacion: today(),

        // Shoe characteristics
        catalogo_id: parseInt(data.catalogo_id),
        talla: parseInt(data.talla) || tallasLote[0] || null,
        tallas_lote: tallasLote,
        color: data.color || 'Negro',
        cantidad_pares: parseInt(data.cantidad_pares) || 1,

        // Flow pipeline: corte -> guarnecido -> soladura -> emplantillado -> listo
        etapa_actual: 'corte',
        historial_etapas: [
          { etapa: 'corte', usuario_id: usuarioId, fecha_inicio: now(), fecha_fin: null }
        ]
      };
      tareas.push(tarea);
      set('tareas', tareas);
      syncSave('tareas', tarea);
      return { ok: true, tarea };
    },

    update: (id, data) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };
      tareas[idx] = { ...tareas[idx], ...data, id };
      set('tareas', tareas);
      syncSave('tareas', tareas[idx]);
      return { ok: true };
    },

    cambiarEstado: (id, nuevoEstado) => Tareas.update(id, { estado: nuevoEstado }),

    finalizarEtapaEmpleado: (id) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };

      const t = tareas[idx];
      t.historial_etapas = Array.isArray(t.historial_etapas) ? t.historial_etapas : [];
      t.estado = 'completada';

      const currentHistIdx = t.historial_etapas.findIndex(h => h.etapa === t.etapa_actual && !h.fecha_fin);
      if (currentHistIdx !== -1) {
        t.historial_etapas[currentHistIdx].fecha_fin = now();
      }

      tareas[idx] = t;
      set('tareas', tareas);
      syncSave('tareas', t);
      return { ok: true, tarea: t };
    },

    avanzarEtapa: (id, proximoUsuarioId) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };

      const t = tareas[idx];
      t.historial_etapas = Array.isArray(t.historial_etapas) ? t.historial_etapas : [];
      const currentIdx = ETAPAS.indexOf(t.etapa_actual);

      if (currentIdx === -1 || t.etapa_actual === 'listo') {
        return { error: 'La tarea ya se encuentra en su etapa final o la etapa es inválida' };
      }

      const nextStage = ETAPAS[currentIdx + 1];
      if (nextStage !== 'listo' && !parseInt(proximoUsuarioId)) {
        return { error: 'Debes seleccionar al operario responsable para la siguiente etapa' };
      }

      const currentHistIdx = t.historial_etapas.findIndex(h => h.etapa === t.etapa_actual && !h.fecha_fin);
      if (currentHistIdx !== -1) {
        t.historial_etapas[currentHistIdx].fecha_fin = now();
      }

      t.etapa_actual = nextStage;

      if (nextStage === 'listo') {
        t.usuario_id = null;
        t.estado = 'completada';
      } else {
        t.usuario_id = parseInt(proximoUsuarioId);
        t.estado = 'pendiente';
        t.historial_etapas.push({
          etapa: nextStage,
          usuario_id: parseInt(proximoUsuarioId),
          fecha_inicio: now(),
          fecha_fin: null
        });
      }

      tareas[idx] = t;
      set('tareas', tareas);
      syncSave('tareas', t);
      return { ok: true, tarea: t };
    },

    delete: (id) => {
      set('tareas', get('tareas').filter(t => t.id !== id));
      syncDelete('tareas', id);
      return { ok: true };
    },

    getStats: (usuario_id = null) => {
      let tareas = get('tareas');
      if (usuario_id) {
        tareas = tareas.filter(t => t.usuario_id === usuario_id || (t.historial_etapas && t.historial_etapas.some(h => h.usuario_id === usuario_id)));
      }
      return {
        total: tareas.length,
        pendientes: tareas.filter(t => t.estado === 'pendiente').length,
        en_progreso: tareas.filter(t => t.estado === 'en_progreso').length,
        completadas: tareas.filter(t => t.estado === 'completada').length,
        vencidas: tareas.filter(t => t.estado !== 'completada' && t.fecha_vencimiento && t.fecha_vencimiento < today()).length,
      };
    },
  };

  /* ==============================
     NOTIFICACIONES CRUD
  ============================== */
  const Notificaciones = {
    getAll: () => get('notificaciones'),

    getByUsuario: (usuario_id) => get('notificaciones')
      .filter(n => n.para_usuario_id === usuario_id)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),

    getUnreadCount: (usuario_id) => get('notificaciones')
      .filter(n => n.para_usuario_id === usuario_id && !n.leida).length,

    create: (data) => {
      const notifs = get('notificaciones');
      const notif = {
        id: nextId('notificaciones'),
        para_usuario_id: data.para_usuario_id,
        tipo: data.tipo || 'info', // 'tarea_asignada', 'tarea_completada', 'info'
        titulo: data.titulo || '',
        mensaje: data.mensaje || '',
        tarea_id: data.tarea_id || null,
        leida: false,
        fecha: now(),
      };
      notifs.push(notif);
      set('notificaciones', notifs);
      syncCreate('notificaciones', notif);
      return { ok: true, notif };
    },

    markRead: (id) => {
      const notifs = get('notificaciones');
      const idx = notifs.findIndex(n => n.id === id);
      if (idx !== -1 && !notifs[idx].leida) {
        notifs[idx].leida = true;
        set('notificaciones', notifs);
        syncSave('notificaciones', notifs[idx]);
      }
      return { ok: true };
    },

    markAllRead: (usuario_id) => {
      const notifs = get('notificaciones');
      notifs.forEach(n => {
        if (n.para_usuario_id === usuario_id && !n.leida) {
          n.leida = true;
          syncSave('notificaciones', n);
        }
      });
      set('notificaciones', notifs);
      return { ok: true };
    },

    delete: (id) => {
      set('notificaciones', get('notificaciones').filter(n => n.id !== id));
      syncDelete('notificaciones', id);
      return { ok: true };
    },

    deleteAll: (usuario_id) => {
      const notifs = get('notificaciones');
      notifs.filter(n => n.para_usuario_id === usuario_id).forEach(n => syncDelete('notificaciones', n.id));
      set('notificaciones', notifs.filter(n => n.para_usuario_id !== usuario_id));
      return { ok: true };
    },
  };

  /* ==============================
     REPORTES CRUD
  ============================== */
  const Reportes = {
    getAll: () => {
      const usuarios = get('usuarios');
      return get('reportes').map(r => ({
        ...r,
        generador: usuarios.find(u => u.id === r.generado_por) || null,
      }));
    },

    create: (tipo, contenido, generado_por) => {
      const reportes = get('reportes');
      const reporte = {
        id: nextId('reportes'),
        tipo,
        contenido,
        generado_por,
        fecha_generacion: now(),
      };
      reportes.push(reporte);
      set('reportes', reportes);
      syncSave('reportes', reporte);
      return { ok: true, reporte };
    },

    delete: (id) => {
      set('reportes', get('reportes').filter(r => r.id !== id));
      syncDelete('reportes', id);
      return { ok: true };
    },
  };

  /* ==============================
     SESSION
  ============================== */
  const Session = {
    get: () => JSON.parse(sessionStorage.getItem('rosalopz_session') || 'null'),
    set: (user) => sessionStorage.setItem('rosalopz_session', JSON.stringify(user)),
    clear: () => {
      sessionStorage.removeItem('rosalopz_session');
      sessionStorage.removeItem(TOKEN_KEY);
    },
    // Con servidor, la sesión solo vale si también hay token
    isLoggedIn: () => !!Session.get() && (!apiOnline || !!getToken()),
  };

  return { init, logout, isOnline: () => apiOnline, Usuarios, Catalogo, Nominas, Inventario, Tareas, Reportes, Notificaciones, Session };
})();
