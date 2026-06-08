const fs = require('fs');

let db = fs.readFileSync('js/db.js', 'utf8');

// 1. Add syncAction helper and update init()
db = db.replace(/const init = \(\) => \{/, \`const syncAction = (method, table, id, data) => {
    let url = 'http://localhost:3000/api/' + table;
    if (id) url += '/' + id;
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    }).catch(e => console.error('Sync Error:', e));
  };

  const init = async () => {\`);

// 2. Make init() fetch from backend
db = db.replace(/if \(localStorage.getItem\(PREFIX \+ 'initialized'\)\) \{[\s\S]*?migrate\(\);[\s\S]*?return;[\s\S]*?\}/, \`
    try {
      const res = await fetch('http://localhost:3000/api/sync');
      const data = await res.json();
      if (data && data.usuarios) {
        set('usuarios', data.usuarios);
        set('catalogo', data.catalogo);
        set('inventario', data.inventario);
        set('tareas', data.tareas);
        set('nominas', data.nominas);
        set('notificaciones', data.notificaciones);
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
\`);

// 3. Inject syncAction into CRUD
// Usuarios
db = db.replace(/usuarios\.push\(user\);\s*set\('usuarios', usuarios\);/, "usuarios.push(user);\n      set('usuarios', usuarios);\n      syncAction('POST', 'usuarios', null, user);");
db = db.replace(/usuarios\[idx\] = \{ \.\.\.usuarios\[idx\], \.\.\.data, id \};\s*set\('usuarios', usuarios\);/, "usuarios[idx] = { ...usuarios[idx], ...data, id };\n      set('usuarios', usuarios);\n      syncAction('PUT', 'usuarios', id, data);");
db = db.replace(/set\('usuarios', usuarios\);\s*return \{ ok: true \};/g, "set('usuarios', usuarios);\n      syncAction('DELETE', 'usuarios', id);\n      return { ok: true };");

// Catalogo
db = db.replace(/catalogo\.push\(producto\);\s*set\('catalogo', catalogo\);/, "catalogo.push(producto);\n      set('catalogo', catalogo);\n      syncAction('POST', 'catalogo', null, producto);");
db = db.replace(/set\('catalogo', catalogo\);\s*return \{ ok: true, producto: catalogo\[idx\] \};/, "set('catalogo', catalogo);\n      syncAction('PUT', 'catalogo', id, data);\n      return { ok: true, producto: catalogo[idx] };");
db = db.replace(/set\('catalogo', get\('catalogo'\)\.filter\(c => c\.id !== id\)\);\s*return \{ ok: true \};/, "set('catalogo', get('catalogo').filter(c => c.id !== id));\n      syncAction('DELETE', 'catalogo', id);\n      return { ok: true };");

// Nominas
db = db.replace(/nominas\.push\(nomina\);\s*set\('nominas', nominas\);/, "nominas.push(nomina);\n      set('nominas', nominas);\n      syncAction('POST', 'nominas', null, nomina);");
db = db.replace(/set\('nominas', nominas\);\s*return \{ ok: true \};/, "set('nominas', nominas);\n      syncAction('PUT', 'nominas', id, data);\n      return { ok: true };");
db = db.replace(/set\('nominas', get\('nominas'\)\.filter\(n => n\.id !== id\)\);\s*return \{ ok: true \};/, "set('nominas', get('nominas').filter(n => n.id !== id));\n      syncAction('DELETE', 'nominas', id);\n      return { ok: true };");

// Inventario
db = db.replace(/inventario\.push\(producto\);\s*set\('inventario', inventario\);/, "inventario.push(producto);\n      set('inventario', inventario);\n      syncAction('POST', 'inventario', null, producto);");
db = db.replace(/set\('inventario', inventario\);\s*return \{ ok: true, producto: inventario\[idx\] \};/, "set('inventario', inventario);\n      syncAction('PUT', 'inventario', id, data);\n      return { ok: true, producto: inventario[idx] };");
db = db.replace(/set\('inventario', get\('inventario'\)\.filter\(p => p\.id !== id\)\);\s*return \{ ok: true \};/, "set('inventario', get('inventario').filter(p => p.id !== id));\n      syncAction('DELETE', 'inventario', id);\n      return { ok: true };");

// Tareas
db = db.replace(/tareas\.push\(tarea\);\s*set\('tareas', tareas\);/, "tareas.push(tarea);\n      set('tareas', tareas);\n      syncAction('POST', 'tareas', null, tarea);");
db = db.replace(/tareas\[idx\] = \{ \.\.\.tareas\[idx\], \.\.\.data, id \};\s*set\('tareas', tareas\);\s*return \{ ok: true \};/, "tareas[idx] = { ...tareas[idx], ...data, id };\n      set('tareas', tareas);\n      syncAction('PUT', 'tareas', id, data);\n      return { ok: true };");
db = db.replace(/set\('tareas', get\('tareas'\)\.filter\(t => t\.id !== id\)\);\s*return \{ ok: true \};/, "set('tareas', get('tareas').filter(t => t.id !== id));\n      syncAction('DELETE', 'tareas', id);\n      return { ok: true };");
// for finalizarEtapaEmpleado / avanzarEtapa
db = db.replace(/tareas\[idx\] = t;\s*set\('tareas', tareas\);\s*return \{ ok: true, tarea: t \};/g, "tareas[idx] = t;\n      set('tareas', tareas);\n      syncAction('PUT', 'tareas', t.id, { estado: t.estado, etapa_actual: t.etapa_actual, historial_etapas: t.historial_etapas, usuario_id: t.usuario_id });\n      return { ok: true, tarea: t };");

// Notificaciones
db = db.replace(/notifs\.push\(notif\);\s*set\('notificaciones', notifs\);/, "notifs.push(notif);\n      set('notificaciones', notifs);\n      syncAction('POST', 'notificaciones', null, notif);");
db = db.replace(/notifs\[idx\]\.leida = true;\s*set\('notificaciones', notifs\);/, "notifs[idx].leida = true;\n      set('notificaciones', notifs);\n      syncAction('PUT', 'notificaciones', id, { leida: true });");

fs.writeFileSync('js/db.js', db);
console.log('db.js patched successfully!');
