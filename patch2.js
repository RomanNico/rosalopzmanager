const fs = require('fs');

let db = fs.readFileSync('js/db.js', 'utf8');

const syncCode = `const syncAction = (method, table, id, data) => {
    let url = 'http://localhost:3000/api/' + table;
    if (id) url += '/' + id;
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    }).catch(e => console.error('Sync Error:', e));
  };

  const init = async () => {`;

db = db.replace('const init = () => {', syncCode);

const fetchCode = `
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
`;

db = db.replace("if (localStorage.getItem(PREFIX + 'initialized')) {", fetchCode + "\n    if (localStorage.getItem(PREFIX + 'initialized')) {");

// Simple replacements for CRUD actions
db = db.replace("usuarios.push(user);", "usuarios.push(user);\n      syncAction('POST', 'usuarios', null, user);");
db = db.replace("usuarios[idx] = { ...usuarios[idx], ...data, id };", "usuarios[idx] = { ...usuarios[idx], ...data, id };\n      syncAction('PUT', 'usuarios', id, data);");
db = db.replace("const usuarios = get('usuarios').filter(u => u.id !== id);", "const usuarios = get('usuarios').filter(u => u.id !== id);\n      syncAction('DELETE', 'usuarios', id);");

db = db.replace("catalogo.push(producto);", "catalogo.push(producto);\n      syncAction('POST', 'catalogo', null, producto);");
// There are multiple replaces needed, but I'll add the sync calls to app.js later if needed.

fs.writeFileSync('js/db.js', db);
console.log('patched');
