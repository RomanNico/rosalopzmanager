/**
 * ROSALOPZManager - Database Module
 * Simulated database using localStorage
 * Fábrica de Calzado Bufalo R.P.
 */

const DB = (() => {
  const PREFIX = 'rosalopz_';
  const USE_API = (typeof window !== 'undefined' && window.USE_API === true);
  const API = (typeof window !== 'undefined' && window.API) ? window.API : null;

  /* ---- Helpers ---- */
  const get = (table) => JSON.parse(localStorage.getItem(PREFIX + table) || '[]');
  const set = (table, data) => localStorage.setItem(PREFIX + table, JSON.stringify(data));
  const nextId = (table) => {
    const items = get(table);
    return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  };
  const now = () => typeof TimeHelper !== 'undefined' ? TimeHelper.getBogotaNow() : new Date().toISOString();
  const today = () => typeof TimeHelper !== 'undefined' ? TimeHelper.getBogotaToday() : new Date().toISOString().split('T')[0];


  // ISO Week and Year helper
  const getWeekAndYear = (dateStr) => {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const week = 1 + Math.ceil((firstThursday - target) / 604800000);
    return { week, year: d.getFullYear() };
  };

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

  /* ---- Init / Seed ---- */
  const syncAction = (method, table, id, data) => {
    let url = 'http://localhost:3000/api/' + table;
    if (id) url += '/' + id;
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    }).catch(e => console.error('Sync Error:', e));
  };

  const init = async () => {
    
    try {
      const res = await fetch('http://localhost:3000/api/sync');
      const data = await res.json();
      if (data && data.usuarios) {
        // Normalize types from PostgreSQL (all numeric fields may come as strings)
        const parseNum = (v) => v !== null && v !== undefined && v !== '' ? parseFloat(v) : 0;
        const parseId = (v) => v !== null && v !== undefined ? parseInt(v) : null;

        const normalizedUsuarios = data.usuarios.map(u => ({
          ...u, 
          id: parseId(u.id),
          rol: (u.rol || '').toLowerCase()
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
          stock_minimo: parseInt(i.stock_minimo) || 10,
        }));
        const normalizedTareas = data.tareas.map(t => ({
          ...t, id: parseId(t.id),
          usuario_id: parseId(t.usuario_id),
          asignado_por: parseId(t.asignado_por),
          catalogo_id: parseId(t.catalogo_id),
          talla: t.talla ? parseInt(t.talla) : null,
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

        set('usuarios', normalizedUsuarios);
        set('catalogo', normalizedCatalogo);
        set('inventario', normalizedInventario);
        set('tareas', normalizedTareas);
        set('nominas', normalizedNominas);
        set('notificaciones', normalizedNotificaciones);
        localStorage.setItem(PREFIX + 'initialized', '1');
        console.log('%c✅ Datos sincronizados desde PostgreSQL', 'color: #06d6a0; font-weight: bold');
        return;
      }
    } catch (e) {
      console.warn('Backend no disponible, usando localStorage', e);
    }

    if (localStorage.getItem(PREFIX + 'initialized')) {
      migrate();
      return;
    }

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
    migrate();
    console.log('%c✅ ROSALOPZManager DB inicializada y migrada', 'color: #06d6a0; font-weight: bold');
  };

  /* ---- Sync to remote API ---- */
  const syncToServer = async () => {
    if (!(typeof window !== 'undefined' && window.USE_API === true)) return { ok: false, message: 'API disabled' };
    if (typeof window === 'undefined' || !window.API) return { ok: false, message: 'API client missing' };
    try {
      // Usuarios
      const usuarios = get('usuarios');
      for (const u of usuarios) {
        try {
          await window.API.createUsuario({ nombre: u.nombre, email: u.email, password: u.password, rol: u.rol, cargo: u.cargo, telefono: u.telefono, direccion: u.direccion });
        } catch (e) { /* ignore */ }
      }
      // Inventario
      const inventario = get('inventario');
      for (const it of inventario) {
        try {
          await window.API.createInventario({ referencia: it.referencia || '', nombre: it.nombre || '', talla: it.talla || '', color: it.color || '', existencia: it.existencia || it.cantidad || 0, img: it.foto || it.img || '' });
        } catch (e) { }
      }
      // Nóminas
      const nominas = get('nominas');
      for (const n of nominas) {
        try {
          await window.API.createNomina({ empleado_id: n.usuario_id || n.empleado_id, empleado_nombre: n.empleado_nombre || '', monto: n.salario || n.monto || 0, fecha: n.fecha, medio_pago: n.medio_pago || null, comprobante: n.comprobante || null });
        } catch (e) { }
      }
      // Trigger server-side migration for roles as well
      try { await window.API.migrateJefeToAdmin(); } catch (e) { }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* ==============================
     USUARIOS CRUD
  ============================== */
  const Usuarios = {
    getAll: () => get('usuarios'),
    getById: (id) => get('usuarios').find(u => u.id === id) || null,
    getByEmail: (email) => get('usuarios').find(u => u.email === email.toLowerCase()) || null,
    getEmpleados: () => get('usuarios').filter(u => u.rol === 'empleado'),
    getEmpleadosPorCargo: (cargo) => get('usuarios').filter(u => u.rol === 'empleado' && u.cargo === cargo),

    create: (data) => {
      const usuarios = get('usuarios');
      const normalizedEmail = (data.email || '').replace(/\uFEFF/g, '').trim().toLowerCase();
      if (usuarios.find(u => u.email === normalizedEmail)) {
        return { error: 'El correo ya está registrado' };
      }
      const user = {
        id: nextId('usuarios'),
        nombre: data.nombre.trim(),
        email: normalizedEmail,
        password: btoa(data.password),
        rol: data.rol ? data.rol.toLowerCase() : 'empleado',
        cargo: data.cargo || (data.rol === 'empleado' ? 'Cortador' : (data.rol === 'jefe' ? 'Dirección' : 'Administración')),
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        creado_en: now(),
      };
      usuarios.push(user);
      syncAction('POST', 'usuarios', null, user);
      set('usuarios', usuarios);
      return { ok: true, user };
    },

    update: (id, data) => {
      const usuarios = get('usuarios');
      const idx = usuarios.findIndex(u => u.id === id);
      if (idx === -1) return { error: 'Usuario no encontrado' };
      usuarios[idx] = { ...usuarios[idx], ...data, id };
      syncAction('PUT', 'usuarios', id, data);
      set('usuarios', usuarios);
      return { ok: true, user: usuarios[idx] };
    },

    delete: (id) => {
      const usuarios = get('usuarios').filter(u => u.id !== id);
      syncAction('DELETE', 'usuarios', id);
      set('usuarios', usuarios);
      return { ok: true };
    },

    login: (email, password) => {
      const allUsers = get('usuarios');
      const cleanEmail = (email || '').replace(/\uFEFF/g, '').trim().toLowerCase();
      const user = allUsers.find(u => u.email && u.email === cleanEmail);
      if (!user) return { error: 'Correo no registrado' };
      if (user.password !== btoa(password)) return { error: 'Contraseña incorrecta' };
      const { password: _, ...safeUser } = user;
      // Ensure rol is lowercase
      safeUser.rol = (safeUser.rol || '').toLowerCase();
      return { ok: true, user: safeUser };
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
      syncAction('POST', 'catalogo', null, producto);
      set('catalogo', catalogo);
      return { ok: true, producto };
    },
    update: (id, data) => {
      const catalogo = get('catalogo');
      const idx = catalogo.findIndex(c => c.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };

      const tallas = Array.isArray(data.tallas) ? data.tallas.map(Number) : catalogo[idx].tallas;
      const colores = Array.isArray(data.colores) ? data.colores.map(c => c.trim()) : catalogo[idx].colores;

      catalogo[idx] = { 
        ...catalogo[idx], 
        ...data, 
        tallas,
        colores,
        id 
      };
      set('catalogo', catalogo);
      return { ok: true, producto: catalogo[idx] };
    },
    delete: (id) => {
      set('catalogo', get('catalogo').filter(c => c.id !== id));
      return { ok: true };
    }
  };

  /* ==============================
     NÓMINAS CRUD
  ============================== */
  const Nominas = {
    getAll: () => {
      const nominas = get('nominas');
      const usuarios = get('usuarios');
      return nominas.map(n => {
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
          usuario: usuarios.find(u => u.id === (parseInt(n.usuario_id) || n.usuario_id)) || null,
        };
      });
    },


    getByUsuario: (usuario_id) => {
      const uid = parseInt(usuario_id);
      const nominas = get('nominas').filter(n => parseInt(n.usuario_id) === uid);
      return nominas.map(n => {
        const salario = parseFloat(n.salario) || 0;
        const deducciones = parseFloat(n.deducciones) || 0;
        const bonificaciones = parseFloat(n.bonificaciones) || 0;
        return { ...n, salario, deducciones, bonificaciones, neto: salario - deducciones + bonificaciones };
      });
    },

    create: (data) => {
      const nominas = get('nominas');
      const dateVal = data.fecha || today();
      const wy = getWeekAndYear(dateVal);
      const nomina = {
        id: nextId('nominas'),
        usuario_id: parseInt(data.usuario_id),
        salario: parseFloat(data.salario),
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
      return { ok: true, nomina: { ...nomina, neto: nomina.salario - nomina.deducciones + nomina.bonificaciones } };
    },

    update: (id, data) => {
      const nominas = get('nominas');
      const idx = nominas.findIndex(n => n.id === id);
      if (idx === -1) return { error: 'Nómina no encontrada' };
      
      let extra = {};
      if (data.fecha) {
        const wy = getWeekAndYear(data.fecha);
        extra = { semana: wy.week, año: wy.year };
      }
      // Preserve comprobante if not provided during update
      const comprobante = data.comprobante !== undefined ? data.comprobante : nominas[idx].comprobante;
      const medio = data.medio_pago !== undefined ? data.medio_pago : nominas[idx].medio_pago || '';

      nominas[idx] = { ...nominas[idx], ...data, ...extra, comprobante, medio_pago: medio, id };
      set('nominas', nominas);
      return { ok: true };
    },

    delete: (id) => {
      set('nominas', get('nominas').filter(n => n.id !== id));
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
  const Inventario = {
    getAll: () => get('inventario'),
    getById: (id) => get('inventario').find(p => p.id === id) || null,
    getLowStock: () => get('inventario').filter(p => p.cantidad <= p.stock_minimo),

    create: (data) => {
      const inventario = get('inventario');
      const producto = {
        id: nextId('inventario'),
        nombre: data.nombre.trim(),
        cantidad: parseInt(data.cantidad) || 0,
        unidad: data.unidad || 'unidades',
        proveedor: data.proveedor || '',
        precio_unitario: parseFloat(data.precio_unitario) || 0,
        stock_minimo: parseInt(data.stock_minimo) || 10,
        categoria: data.categoria || 'General',
        fecha_actualizacion: today(),
      };
      inventario.push(producto);
      set('inventario', inventario);
      return { ok: true, producto };
    },

    update: (id, data) => {
      const inventario = get('inventario');
      const idx = inventario.findIndex(p => p.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };
      inventario[idx] = { ...inventario[idx], ...data, id, fecha_actualizacion: today() };
      set('inventario', inventario);
      return { ok: true, producto: inventario[idx] };
    },

    ajustarStock: (id, cantidad, tipo) => {
      const inventario = get('inventario');
      const idx = inventario.findIndex(p => p.id === id);
      if (idx === -1) return { error: 'Producto no encontrado' };
      const delta = tipo === 'entrada' ? parseInt(cantidad) : -parseInt(cantidad);
      inventario[idx].cantidad = Math.max(0, inventario[idx].cantidad + delta);
      inventario[idx].fecha_actualizacion = today();
      set('inventario', inventario);
      return { ok: true, producto: inventario[idx] };
    },

    delete: (id) => {
      set('inventario', get('inventario').filter(p => p.id !== id));
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
  const Tareas = {
    getAll: () => {
      const tareas = get('tareas');
      const usuarios = get('usuarios');
      const catalogo = get('catalogo');
      return tareas.map(t => ({
        ...t,
        empleado: usuarios.find(u => u.id === t.usuario_id) || null,
        asignador: usuarios.find(u => u.id === t.asignado_por) || null,
        producto: catalogo.find(c => c.id === t.catalogo_id) || null,
      }));
    },

    getByUsuario: (usuario_id) => {
      const tareas = get('tareas').filter(t => t.usuario_id === usuario_id);
      const usuarios = get('usuarios');
      const catalogo = get('catalogo');
      return tareas.map(t => ({
        ...t,
        asignador: usuarios.find(u => u.id === t.asignado_por) || null,
        producto: catalogo.find(c => c.id === t.catalogo_id) || null,
      }));
    },

    create: (data) => {
      const tareas = get('tareas');
      const dateVal = today();
      const tarea = {
        id: nextId('tareas'),
        descripcion: data.descripcion.trim(),
        usuario_id: parseInt(data.usuario_id) || null,
        asignado_por: parseInt(data.asignado_por),
        estado: data.estado || 'pendiente',
        prioridad: data.prioridad || 'media',
        categoria: 'Producción',
        fecha_vencimiento: data.fecha_vencimiento,
        fecha_creacion: dateVal,

        // Shoe characteristics
        catalogo_id: parseInt(data.catalogo_id),
        talla: parseInt(data.talla),
        color: data.color || 'Negro',
        cantidad_pares: parseInt(data.cantidad_pares) || 1,

        // Flow pipeline
        etapa_actual: 'corte', // corte -> guarnecido -> soladura -> emplantillado -> listo
        historial_etapas: [
          {
            etapa: 'corte',
            usuario_id: parseInt(data.usuario_id),
            fecha_inicio: now(),
            fecha_fin: null
          }
        ]
      };
      tareas.push(tarea);
      set('tareas', tareas);
      return { ok: true, tarea };
    },

    update: (id, data) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };
      tareas[idx] = { ...tareas[idx], ...data, id };
      set('tareas', tareas);
      return { ok: true };
    },

    cambiarEstado: (id, nuevoEstado) => {
      return Tareas.update(id, { estado: nuevoEstado });
    },

    finalizarEtapaEmpleado: (id) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };

      const t = tareas[idx];
      t.estado = 'completada';

      // Mark current stage end date in history
      const currentHistIdx = t.historial_etapas.findIndex(h => h.etapa === t.etapa_actual && !h.fecha_fin);
      if (currentHistIdx !== -1) {
        t.historial_etapas[currentHistIdx].fecha_fin = now();
      }

      tareas[idx] = t;
      set('tareas', tareas);
      return { ok: true, tarea: t };
    },

    avanzarEtapa: (id, proximoUsuarioId) => {
      const tareas = get('tareas');
      const idx = tareas.findIndex(t => t.id === id);
      if (idx === -1) return { error: 'Tarea no encontrada' };

      const t = tareas[idx];
      const etapas = ['corte', 'guarnecido', 'soladura', 'emplantillado', 'listo'];
      const currentIdx = etapas.indexOf(t.etapa_actual);

      if (currentIdx === -1 || t.etapa_actual === 'listo') {
        return { error: 'La tarea ya se encuentra en su etapa final o la etapa es inválida' };
      }

      // Close current stage in history if it wasn't closed
      const currentHistIdx = t.historial_etapas.findIndex(h => h.etapa === t.etapa_actual && !h.fecha_fin);
      if (currentHistIdx !== -1) {
        t.historial_etapas[currentHistIdx].fecha_fin = now();
      }

      const nextStage = etapas[currentIdx + 1];
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
      return { ok: true, tarea: t };
    },

    delete: (id) => {
      set('tareas', get('tareas').filter(t => t.id !== id));
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
        vencidas: tareas.filter(t => t.estado !== 'completada' && t.fecha_vencimiento < today()).length,
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
        id: notifs.length > 0 ? Math.max(...notifs.map(n => n.id)) + 1 : 1,
        para_usuario_id: data.para_usuario_id,
        tipo: data.tipo || 'info', // 'tarea_asignada', 'tarea_completada', 'asignar_siguiente', 'info'
        titulo: data.titulo || '',
        mensaje: data.mensaje || '',
        tarea_id: data.tarea_id || null,
        leida: false,
        fecha: now(),
      };
      notifs.push(notif);
      set('notificaciones', notifs);
      return { ok: true, notif };
    },

    markRead: (id) => {
      const notifs = get('notificaciones');
      const idx = notifs.findIndex(n => n.id === id);
      if (idx !== -1) notifs[idx].leida = true;
      set('notificaciones', notifs);
      return { ok: true };
    },

    markAllRead: (usuario_id) => {
      const notifs = get('notificaciones').map(n =>
        n.para_usuario_id === usuario_id ? { ...n, leida: true } : n
      );
      set('notificaciones', notifs);
      return { ok: true };
    },

    delete: (id) => {
      set('notificaciones', get('notificaciones').filter(n => n.id !== id));
      return { ok: true };
    },

    deleteAll: (usuario_id) => {
      set('notificaciones', get('notificaciones').filter(n => n.para_usuario_id !== usuario_id));
      return { ok: true };
    },
  };

  /* ==============================
     REPORTES CRUD
  ============================== */
  const Reportes = {
    getAll: () => {
      const reportes = get('reportes');
      const usuarios = get('usuarios');
      return reportes.map(r => ({
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
      return { ok: true, reporte };
    },

    delete: (id) => {
      set('reportes', get('reportes').filter(r => r.id !== id));
      return { ok: true };
    },
  };

  /* ==============================
     SESSION
  ============================== */
  const Session = {
    get: () => JSON.parse(sessionStorage.getItem('rosalopz_session') || 'null'),
    set: (user) => sessionStorage.setItem('rosalopz_session', JSON.stringify(user)),
    clear: () => sessionStorage.removeItem('rosalopz_session'),
    isLoggedIn: () => !!Session.get(),
  };

  return { init, Usuarios, Catalogo, Nominas, Inventario, Tareas, Reportes, Notificaciones, Session };
})();
