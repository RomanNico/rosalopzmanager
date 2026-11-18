/**
 * ROSALOPZManager - Ejecución automatizada de casos de prueba (E2E) con Playwright + Microsoft Edge
 * Registra resultado obtenido, estado y evidencias (capturas) de cada caso.
 *   npm run test:e2e                (todos los casos)
 *   npm run test:e2e -- CP04 CP05   (solo algunos casos)
 * Requisitos: servidor de pruebas en el puerto 3999 (PORT=3999 node server.js) y
 * base de datos reiniciada con: npm run seed -- --force
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PROYECTO = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'resultados');
const SOLO = process.argv.slice(2);
const BASE = 'http://localhost:3999';
// Navegador: Microsoft Edge (o el indicado en la variable NAVEGADOR, p. ej. la ruta de Chrome)
const EDGE = process.env.NAVEGADOR || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(path.join(OUT, 'evidencias'), { recursive: true });

require(path.join(PROYECTO, 'node_modules/dotenv')).config({ path: path.join(PROYECTO, '.env'), quiet: true });
const { Pool } = require(path.join(PROYECTO, 'node_modules/pg'));
const db = new Pool({ host: process.env.PG_HOST, port: process.env.PG_PORT, user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DATABASE, ssl: process.env.PG_SSL === 'true' });
const q = (sql, p) => db.query(sql, p).then(r => r.rows);

const resultados = [];
const capturasSistema = [];
let browser;

/* ---------- utilidades ---------- */
const nuevaPagina = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport, locale: 'es-CO', timezoneId: 'America/Bogota', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss());
  return page;
};
const limpiarToasts = (page) => page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
const esperarToast = async (page, timeout = 6000) => {
  const t = page.locator('.toast .toast-msg').last();
  await t.waitFor({ state: 'visible', timeout });
  return (await t.textContent()).trim();
};
const captura = async (page, nombre, opts = {}) => {
  const file = path.join(OUT, 'evidencias', `${nombre}.png`);
  await page.waitForTimeout(350); // animaciones
  if (opts.locator) await opts.locator.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: !!opts.full });
  return `${nombre}.png`;
};
const login = async (page, email, clave) => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', clave);
  await limpiarToasts(page);
  await page.click('#login-form button[type="submit"]');
};
const entrar = async (page, email, clave) => {
  await login(page, email, clave);
  await page.locator('#app-screen').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);
  await limpiarToasts(page);
};
const ir = async (page, modulo) => {
  await page.click(`.nav-item[data-page="${modulo}"]`);
  await page.locator(`#page-${modulo}.active`).waitFor();
  await page.waitForTimeout(300);
};
const esperarSync = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(500));
const filaCon = (page, tbody, texto) => page.locator(`${tbody} tr`, { hasText: texto });

/* ---------- registro de casos ---------- */
const casos = [];
const caso = (id, fn) => casos.push({ id, fn });
async function ejecutar({ id, fn }) {
  if (SOLO.length && !SOLO.includes(id)) return;
  const r = { id, obtenido: '', estado: '', evidencias: [], detalle: [] };
  const t0 = Date.now();
  try {
    const out = await fn(r);
    r.estado = out.ok ? 'Aprobado' : 'Fallido';
    r.obtenido = out.obtenido;
  } catch (e) {
    r.estado = 'Fallido';
    r.obtenido = (r.obtenido ? r.obtenido + ' ' : '') + `Error durante la ejecución: ${e.message.split('\n')[0]}`;
  }
  r.duracion_s = +((Date.now() - t0) / 1000).toFixed(1);
  r.fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  resultados.push(r);
  console.log(`${r.estado === 'Aprobado' ? '✅' : '❌'} ${id} (${r.duracion_s}s): ${r.obtenido}`);
}

/* ---------- estado compartido entre casos ---------- */
let admin; // página del administrador
const S = {};

/* ==============================
   CASOS DE PRUEBA
============================== */
caso('CP01', async (r) => {
  admin = await nuevaPagina();
  await admin.goto(BASE + '/', { waitUntil: 'networkidle' });
  capturasSistema.push({ archivo: await captura(admin, 'sis-login'), titulo: 'Pantalla de inicio de sesión' });
  await login(admin, 'admin@bufalo.com', 'admin123');
  const toast = await esperarToast(admin);
  await admin.locator('#page-dashboard.active').waitFor({ timeout: 8000 });
  const nombre = (await admin.textContent('#header-user-name')).trim();
  await admin.waitForTimeout(800);
  r.evidencias.push(await captura(admin, 'CP01-dashboard'));
  return { ok: /Bienvenido/.test(toast) && nombre === 'Admin', obtenido: `Ingresó al sistema; se muestra el Dashboard y el mensaje "${toast}".` };
});

caso('CP02', async (r) => {
  const p = await nuevaPagina();
  await login(p, 'admin@bufalo.com', 'claveIncorrecta');
  const toast = await esperarToast(p);
  const enLogin = await p.locator('#auth-screen').isVisible();
  r.evidencias.push(await captura(p, 'CP02-clave-incorrecta'));
  await p.context().close();
  return { ok: toast === 'Correo o contraseña incorrectos' && enLogin, obtenido: `Acceso denegado. Mensaje: "${toast}". Permanece en la pantalla de login.` };
});

caso('CP03', async (r) => {
  const p = await nuevaPagina();
  await login(p, '', '');
  const toast = await esperarToast(p);
  r.evidencias.push(await captura(p, 'CP03-campos-vacios'));
  await p.context().close();
  return { ok: toast === 'Ingresa tu correo y contraseña', obtenido: `No se envía la solicitud. Mensaje: "${toast}".` };
});

const abrirNuevoUsuario = async () => {
  await ir(admin, 'usuarios');
  await admin.click('#page-usuarios button:has-text("Nuevo Usuario")');
  await admin.locator('#usuario-modal.active').waitFor();
};
const llenarUsuario = async (d) => {
  await admin.fill('#usuario-nombre', d.nombre);
  await admin.fill('#usuario-email', d.email);
  await admin.selectOption('#usuario-rol', 'empleado');
  await admin.selectOption('#usuario-cargo', d.cargo || 'Guarnecedor');
  await admin.fill('#usuario-telefono', d.telefono || '');
  await admin.fill('#usuario-direccion', d.direccion || '');
  await admin.fill('#usuario-password', d.clave);
};

caso('CP04', async (r) => {
  capturasSistema.push({ archivo: await captura(admin, 'sis-dashboard'), titulo: 'Dashboard del administrador' });
  await abrirNuevoUsuario();
  await llenarUsuario({ nombre: 'Laura Gómez', email: 'laura.gomez@bufalo.com', telefono: '3104567890', direccion: 'Calle 13 Sur # 24-18, Restrepo', clave: 'Laura2026' });
  r.evidencias.push(await captura(admin, 'CP04-formulario', { locator: admin.locator('#usuario-modal .modal') }));
  await limpiarToasts(admin);
  await admin.click('#usuario-form button[type="submit"]');
  const toast = await esperarToast(admin);
  await esperarSync(admin);
  const fila = filaCon(admin, '#usuarios-tbody', 'laura.gomez@bufalo.com');
  const visible = await fila.count() === 1;
  const badge = visible ? await fila.locator('text=Clave temporal').count() : 0;
  r.evidencias.push(await captura(admin, 'CP04-usuario-creado'));
  return { ok: /Usuario creado/.test(toast) && visible, obtenido: `Mensaje: "${toast}". Laura Gómez aparece en la lista${badge ? ' con la etiqueta "🔑 Clave temporal"' : ''}.` };
});

caso('CP05', async (r) => {
  await abrirNuevoUsuario();
  await llenarUsuario({ nombre: 'María López Duplicada', email: 'maria@bufalo.com', clave: 'Prueba2026' });
  await limpiarToasts(admin);
  await admin.click('#usuario-form button[type="submit"]');
  const toast = await esperarToast(admin);
  const n = (await q('SELECT count(*)::int n FROM usuarios WHERE email = $1', ['maria@bufalo.com']))[0].n;
  r.evidencias.push(await captura(admin, 'CP05-correo-duplicado'));
  await admin.evaluate(() => Modal.close('usuario-modal'));
  return { ok: toast === 'El correo ya está registrado' && n === 1, obtenido: `No se registra. Mensaje: "${toast}". En la base sigue existiendo un solo usuario con ese correo.` };
});

caso('CP06', async (r) => {
  await abrirNuevoUsuario();
  await llenarUsuario({ nombre: 'Correo Inválido', email: 'laura.gomez@', clave: 'Prueba2026' });
  await limpiarToasts(admin);
  await admin.click('#usuario-form button[type="submit"]');
  await admin.waitForTimeout(600);
  const valida = await admin.$eval('#usuario-email', el => ({ ok: el.validity.valid, msg: el.validationMessage }));
  const toasts = await admin.locator('.toast .toast-msg').allTextContents();
  const n = (await q("SELECT count(*)::int n FROM usuarios WHERE nombre = 'Correo Inválido'"))[0].n;
  r.evidencias.push(await captura(admin, 'CP06-correo-invalido', { locator: admin.locator('#usuario-modal .modal') }));
  await admin.evaluate(() => Modal.close('usuario-modal'));
  const mensaje = valida.msg || toasts.join(' ');
  return { ok: !valida.ok && n === 0, obtenido: `El formulario no se envía. El navegador marca el campo correo como inválido: "${mensaje}". No se creó ningún registro.` };
});

caso('CP07', async (r) => {
  await abrirNuevoUsuario();
  await llenarUsuario({ nombre: 'Clave Corta', email: 'clave.corta@bufalo.com', clave: '123' });
  await limpiarToasts(admin);
  await admin.click('#usuario-form button[type="submit"]');
  const toast = await esperarToast(admin);
  r.evidencias.push(await captura(admin, 'CP07-clave-corta'));
  await admin.evaluate(() => Modal.close('usuario-modal'));
  return { ok: /al menos 6 caracteres/.test(toast), obtenido: `No se registra. Mensaje: "${toast}".` };
});

caso('CP08', async (r) => {
  await ir(admin, 'usuarios');
  await admin.fill('#usuario-search', 'Castañeda');
  await admin.waitForTimeout(400);
  const filas = await admin.locator('#usuarios-tbody tr').allTextContents();
  r.evidencias.push(await captura(admin, 'CP08-busqueda'));
  await admin.fill('#usuario-search', '');
  await admin.waitForTimeout(300);
  return { ok: filas.length === 1 && /Yolanda Castañeda/.test(filas[0]), obtenido: `La búsqueda devolvió ${filas.length} resultado(s): ${filas.length ? 'Yolanda Castañeda (yolanda.castaneda@bufalo.com)' : 'ninguno'}.` };
});

caso('CP09', async (r) => {
  await ir(admin, 'usuarios');
  await filaCon(admin, '#usuarios-tbody', 'laura.gomez@bufalo.com').locator('button[title="Editar"]').click();
  await admin.locator('#usuario-modal.active').waitFor();
  await admin.fill('#usuario-telefono', '3209876543');
  await limpiarToasts(admin);
  await admin.click('#usuario-form button[type="submit"]');
  const toast = await esperarToast(admin);
  await esperarSync(admin);
  // Recargar la página: los datos vuelven a descargarse del servidor
  await admin.reload({ waitUntil: 'networkidle' });
  await admin.locator('#app-screen').waitFor({ state: 'visible' });
  await ir(admin, 'usuarios');
  const fila = await filaCon(admin, '#usuarios-tbody', 'laura.gomez@bufalo.com').textContent();
  const enBD = (await q('SELECT telefono FROM usuarios WHERE email = $1', ['laura.gomez@bufalo.com']))[0]?.telefono;
  r.evidencias.push(await captura(admin, 'CP09-actualizado'));
  return { ok: /actualizado/.test(toast) && fila.includes('3209876543') && enBD === '3209876543', obtenido: `Mensaje: "${toast}". Tras recargar la página el teléfono sigue en 3209876543 y en PostgreSQL quedó guardado ${enBD}.` };
});

caso('CP10', async (r) => {
  await ir(admin, 'usuarios');
  await filaCon(admin, '#usuarios-tbody', 'laura.gomez@bufalo.com').locator('button[title="Restablecer contraseña"]').click();
  await admin.click('#confirm-ok');
  await admin.locator('#password-temporal-overlay').waitFor();
  const temporal = await admin.inputValue('#pt-valor');
  r.evidencias.push(await captura(admin, 'CP10-clave-temporal', { locator: admin.locator('#password-temporal-overlay .modal') }));
  await admin.click('#pt-listo');
  // Laura entra con la clave temporal
  const p = await nuevaPagina();
  await login(p, 'laura.gomez@bufalo.com', temporal);
  await p.locator('#cambio-obligatorio-overlay').waitFor({ timeout: 8000 });
  r.evidencias.push(await captura(p, 'CP10-cambio-obligatorio'));
  // Mientras tenga clave temporal, el servidor bloquea otras acciones
  const bloqueo = await p.evaluate(async () => {
    const t = sessionStorage.getItem('rosalopz_token');
    const res = await fetch('/api/notificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ para_usuario_id: 1, titulo: 'x' }) });
    return res.status;
  });
  await p.fill('#co-nueva', 'LauraNueva2026');
  await p.fill('#co-confirmar', 'LauraNueva2026');
  await limpiarToasts(p);
  await p.click('#cambio-obligatorio-form button[type="submit"]');
  const toast = await esperarToast(p);
  await p.locator('#app-screen').waitFor({ state: 'visible' });
  r.evidencias.push(await captura(p, 'CP10-acceso-concedido'));
  await p.context().close();
  const flag = (await q('SELECT debe_cambiar_password FROM usuarios WHERE email = $1', ['laura.gomez@bufalo.com']))[0].debe_cambiar_password;
  return { ok: /^Bufalo-[A-Z2-9]{6}$/.test(temporal) && bloqueo === 403 && /Contraseña creada/.test(toast) && flag === false,
    obtenido: `Se generó la clave temporal ${temporal} (mostrada una sola vez). Al ingresar, el sistema exigió crear una nueva contraseña; mientras tanto la API respondió ${bloqueo} a otras acciones. Mensaje final: "${toast}".` };
});

caso('CP11', async (r) => {
  const p = await nuevaPagina();
  await entrar(p, 'maria@bufalo.com', 'emp123');
  const visibles = await p.$$eval('.nav-item[data-page]', els => els.filter(e => e.offsetParent !== null).map(e => e.dataset.page));
  r.evidencias.push(await captura(p, 'CP11-vista-empleado'));
  const api = await p.evaluate(async () => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('rosalopz_token') };
    const a = await fetch('/api/catalogo/1', { method: 'PUT', headers: h, body: JSON.stringify({ precio: 1 }) });
    const b = await fetch('/api/usuarios', { headers: h });
    const c = await fetch('/api/usuarios/1/reset-password', { method: 'POST', headers: h });
    return [a.status, b.status, c.status];
  });
  await limpiarToasts(p);
  await p.evaluate(() => Router.navigate('usuarios'));
  const toast = await esperarToast(p);
  const nominasPropias = await p.evaluate(() => DB.Nominas.getAll().every(n => n.usuario_id === currentUser.id));
  await p.context().close();
  const sinAdmin = !visibles.some(v => ['dashboard', 'usuarios', 'reportes'].includes(v));
  return { ok: sinAdmin && api.every(s => s === 403) && /Solo administradores/.test(toast) && nominasPropias,
    obtenido: `Menú visible para la empleada: ${visibles.join(', ')}. Al forzar el módulo Usuarios: "${toast}". La API rechazó editar catálogo, listar usuarios y restablecer claves (códigos ${api.join(', ')}). Solo recibe sus propias nóminas.` };
});

const ajustarStock = async (producto, tipo, cantidad) => {
  await ir(admin, 'inventario');
  await admin.fill('#inv-search', producto);
  await admin.waitForTimeout(300);
  await filaCon(admin, '#inv-tbody', producto).locator(`button[title="${tipo === 'salida' ? 'Salida de stock' : 'Entrada'}"]`).click();
  await admin.locator('#stock-adjust-modal.active').waitFor();
  await admin.fill('#stock-adjust-cantidad', String(cantidad));
  await limpiarToasts(admin);
  await admin.click('#stock-adjust-form button[type="submit"]');
  return esperarToast(admin);
};

caso('CP12', async (r) => {
  await ir(admin, 'inventario');
  capturasSistema.push({ archivo: await captura(admin, 'sis-inventario'), titulo: 'Módulo de inventario con alertas de stock' });
  const antes = (await q("SELECT cantidad FROM inventario WHERE nombre = 'Gamuza negra'"))[0].cantidad;
  const toast = await ajustarStock('Gamuza negra', 'salida', 5);
  await esperarSync(admin);
  const fila = await filaCon(admin, '#inv-tbody', 'Gamuza negra').textContent();
  const despues = (await q("SELECT cantidad FROM inventario WHERE nombre = 'Gamuza negra'"))[0].cantidad;
  r.evidencias.push(await captura(admin, 'CP12-salida-stock'));
  await admin.fill('#inv-search', '');
  return { ok: despues === antes - 5 && /reducido en 5/.test(toast) && fila.includes(String(despues)), obtenido: `Mensaje: "${toast}". Existencia: ${antes} → ${despues} metros (en pantalla y en PostgreSQL).` };
});

caso('CP13', async (r) => {
  const antes = (await q("SELECT cantidad FROM inventario WHERE nombre = 'Hilo nylon calibre 40'"))[0].cantidad;
  const toast = await ajustarStock('Hilo nylon calibre 40', 'salida', 100);
  r.evidencias.push(await captura(admin, 'CP13-stock-insuficiente'));
  await admin.evaluate(() => Modal.close('stock-adjust-modal'));
  await admin.waitForTimeout(500);
  const despues = (await q("SELECT cantidad FROM inventario WHERE nombre = 'Hilo nylon calibre 40'"))[0].cantidad;
  await admin.fill('#inv-search', '');
  return { ok: /No hay suficiente stock/.test(toast) && despues === antes, obtenido: `Operación rechazada. Mensaje: "${toast}". La existencia se mantiene en ${despues} conos.` };
});

caso('CP14', async (r) => {
  await ir(admin, 'tareas');
  capturasSistema.push({ archivo: await captura(admin, 'sis-tareas'), titulo: 'Tablero de órdenes de producción' });
  await admin.click('#btn-add-tarea');
  await admin.locator('#tarea-modal.active').waitFor();
  const opcion = await admin.$eval('#tarea-catalogo-select', s => [...s.options].find(o => o.textContent.includes('REF-333')).value);
  await admin.selectOption('#tarea-catalogo-select', opcion);
  await admin.waitForTimeout(200);
  const tallas = admin.locator('#tarea-tallas-container .talla-select-btn');
  for (const i of [1, 2, 3]) await tallas.nth(i).click();
  await admin.selectOption('#tarea-color', 'Café');
  await admin.fill('#tarea-pares', '18');
  await admin.dispatchEvent('#tarea-pares', 'input');
  await admin.selectOption('#tarea-prioridad', 'alta');
  const cortador = await admin.$eval('#tarea-empleado-select', s => s.options[s.selectedIndex].textContent.trim());
  await admin.evaluate(() => actualizarTituloTarea());
  const descripcion = await admin.inputValue('#tarea-descripcion');
  r.evidencias.push(await captura(admin, 'CP14-formulario', { locator: admin.locator('#tarea-modal .modal') }));
  await limpiarToasts(admin);
  await admin.click('#tarea-form button[type="submit"]');
  const toast = await esperarToast(admin);
  await esperarSync(admin);
  const t = (await q('SELECT t.id, t.etapa_actual, t.tallas_lote, u.nombre FROM tareas t JOIN usuarios u ON u.id = t.usuario_id WHERE t.descripcion = $1', [descripcion]))[0];
  const notif = t ? (await q("SELECT count(*)::int n FROM notificaciones WHERE tarea_id = $1 AND tipo = 'tarea_asignada'", [t.id]))[0].n : 0;
  r.evidencias.push(await captura(admin, 'CP14-orden-creada'));
  return { ok: /Corte/.test(toast) && t && t.etapa_actual === 'corte' && t.tallas_lote.length === 3 && notif === 1,
    obtenido: `Mensaje: "${toast}". La orden "${descripcion}" quedó en etapa Corte asignada a ${t?.nombre || cortador}, con ${t?.tallas_lote?.length} tallas (${t?.tallas_lote?.join(', ')}); se generó ${notif} notificación para el cortador.` };
});

caso('CP15', async (r) => {
  await ir(admin, 'tareas');
  await admin.fill('#tarea-search', 'VINO TINTO');
  await admin.waitForTimeout(300);
  await admin.locator('#tareas-container .tarea-card').first().click();
  await admin.locator('#tarea-detalle-modal.active').waitFor();
  const siguiente = await admin.$eval('#next-responsable-select', s => ({ id: +s.value, nombre: s.options[s.selectedIndex].textContent.trim() }));
  r.evidencias.push(await captura(admin, 'CP15-detalle-flujo', { locator: admin.locator('#tarea-detalle-modal .modal') }));
  capturasSistema.push({ archivo: 'CP15-detalle-flujo.png', titulo: 'Detalle de una orden: flujo por etapas y bitácora' });
  await limpiarToasts(admin);
  await admin.click('#tarea-detalle-body button:has-text("Enviar a Etapa")');
  const toast = await esperarToast(admin);
  await esperarSync(admin);
  const t = (await q("SELECT id, etapa_actual, estado, usuario_id FROM tareas WHERE descripcion LIKE '%VINO TINTO%'"))[0];
  S.tareaGuarnecido = t.id;
  S.guarnecedor = siguiente;
  r.evidencias.push(await captura(admin, 'CP15-etapa-asignada'));
  await admin.fill('#tarea-search', '');
  return { ok: t.etapa_actual === 'guarnecido' && t.estado === 'pendiente' && t.usuario_id === siguiente.id && /siguiente etapa/.test(toast),
    obtenido: `Mensaje: "${toast}". La orden pasó de Corte a Guarnecido y quedó asignada a ${siguiente.nombre}.` };
});

caso('CP16', async (r) => {
  if (!S.guarnecedor) throw new Error('Bloqueado: depende de CP15');
  const email = (await q('SELECT email FROM usuarios WHERE id = $1', [S.guarnecedor.id]))[0].email;
  const p = await nuevaPagina();
  await entrar(p, email, 'emp123');
  await ir(p, 'tareas');
  await p.locator('#tareas-container .tarea-card', { hasText: 'VINO TINTO' }).click();
  await p.locator('#tarea-detalle-modal.active').waitFor();
  r.evidencias.push(await captura(p, 'CP16-panel-operario', { locator: p.locator('#tarea-detalle-modal .modal') }));
  await limpiarToasts(p);
  await p.click('#tarea-detalle-body button:has-text("Completar Mi Etapa")');
  const toast = await esperarToast(p);
  await esperarSync(p);
  await p.context().close();
  const t = (await q('SELECT estado, etapa_actual FROM tareas WHERE id = $1', [S.tareaGuarnecido]))[0];
  const avisos = (await q("SELECT count(*)::int n FROM notificaciones n JOIN usuarios u ON u.id = n.para_usuario_id WHERE n.tarea_id = $1 AND n.tipo = 'tarea_completada' AND u.rol = 'administrador'", [S.tareaGuarnecido]))[0].n;
  // El administrador ve el aviso en su campana
  await admin.reload({ waitUntil: 'networkidle' });
  await admin.locator('#app-screen').waitFor({ state: 'visible' });
  await admin.click('#btn-notif');
  await admin.waitForTimeout(400);
  r.evidencias.push(await captura(admin, 'CP16-notificacion-admin'));
  await admin.click('#btn-notif');
  return { ok: /completado tu etapa/.test(toast) && t.estado === 'completada' && t.etapa_actual === 'guarnecido' && avisos >= 1,
    obtenido: `${S.guarnecedor.nombre} completó su etapa. Mensaje: "${toast}". La orden quedó "completada" en Guarnecido esperando al supervisor y se enviaron ${avisos} notificaciones a los administradores.` };
});

caso('CP17', async (r) => {
  await ir(admin, 'nominas');
  capturasSistema.push({ archivo: await captura(admin, 'sis-nominas'), titulo: 'Módulo de nóminas' });
  await admin.click('#btn-add-nomina');
  await admin.locator('#nomina-modal.active').waitFor();
  const opcion = await admin.$eval('#nomina-usuario-select', s => [...s.options].find(o => o.textContent.includes('Laura Gómez'))?.value);
  if (!opcion) throw new Error('Laura Gómez no aparece en la lista de empleados (depende de CP04)');
  await admin.selectOption('#nomina-usuario-select', opcion);
  await admin.fill('#nomina-salario', '1880000');
  await admin.fill('#nomina-deducciones', '150400');
  await admin.fill('#nomina-bonificaciones', '100000');
  await admin.selectOption('#nomina-estado', 'pendiente');
  r.evidencias.push(await captura(admin, 'CP17-formulario', { locator: admin.locator('#nomina-modal .modal') }));
  await limpiarToasts(admin);
  await admin.click('#nomina-form button[type="submit"]');
  let toast = '';
  try { toast = await esperarToast(admin, 3000); } catch (e) { /* sin mensaje */ }
  const invalido = await admin.$eval('#nomina-deducciones', el => el.validity.valid ? '' : el.validationMessage);
  await esperarSync(admin);
  const n = (await q("SELECT salario, deducciones, bonificaciones FROM nominas n JOIN usuarios u ON u.id = n.usuario_id WHERE u.email = 'laura.gomez@bufalo.com'"))[0];
  r.evidencias.push(await captura(admin, n ? 'CP17-nomina-creada' : 'CP17-bloqueado'));
  if (!n) {
    await admin.evaluate(() => Modal.close('nomina-modal'));
    return { ok: false, obtenido: `La nómina NO se guardó. ${invalido ? `El navegador bloqueó el formulario en "Deducciones": "${invalido}".` : 'No se mostró ningún mensaje.'} El campo solo acepta múltiplos de 1.000 (step="1000"), pero las deducciones de ley (8 % del salario) dan valores como 150.400.` };
  }
  const fila = await filaCon(admin, '#nomina-tbody', 'Laura Gómez').first().textContent();
  const neto = 1880000 - 150400 + 100000;
  const netoTxt = new Intl.NumberFormat('es-CO').format(neto);
  return { ok: /Nómina creada/.test(toast) && fila.includes(netoTxt), obtenido: `Mensaje: "${toast}". Neto a pagar calculado: $ ${netoTxt} (1.880.000 − 150.400 + 100.000).` };
});

caso('CP18', async (r) => {
  await ir(admin, 'reportes');
  await admin.click('#page-reportes [onclick="generarReporte(\'inventario\')"]');
  await admin.locator('#generar-reporte-periodo-modal.active').waitFor();
  await admin.selectOption('#gr-periodo-tipo', 'todo');
  await limpiarToasts(admin);
  await admin.click('#generar-reporte-periodo-form button[type="submit"]');
  const toast = await esperarToast(admin);
  await admin.locator('#reporte-preview-modal.active').waitFor();
  const filas = await admin.locator('#reporte-preview-content tbody tr').count();
  r.evidencias.push(await captura(admin, 'CP18-reporte', { locator: admin.locator('#reporte-preview-modal .modal') }));
  await admin.evaluate(() => Modal.close('reporte-preview-modal'));
  await esperarSync(admin);
  const enBD = (await q("SELECT count(*)::int n FROM reportes WHERE tipo = 'inventario'"))[0].n;
  const total = (await q('SELECT count(*)::int n FROM inventario'))[0].n;
  capturasSistema.push({ archivo: await captura(admin, 'sis-reportes'), titulo: 'Historial de reportes generados' });
  return { ok: /Reporte generado/.test(toast) && filas === total && enBD === 1, obtenido: `Mensaje: "${toast}". La vista previa muestra ${filas} de ${total} materiales y el reporte quedó guardado en la base (${enBD}).` };
});

caso('CP19', async (r) => {
  const u = (await q('SELECT password FROM usuarios WHERE email = $1', ['laura.gomez@bufalo.com']))[0];
  const todos = await q('SELECT email, password FROM usuarios');
  const conHash = todos.filter(x => x.password.startsWith('scrypt$')).length;
  const sync = await admin.evaluate(async () => {
    const res = await fetch('/api/sync', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('rosalopz_token') } });
    const d = await res.json();
    return d.usuarios.some(x => 'password' in x);
  });
  const sinSesion = await admin.evaluate(async () => (await fetch('/api/sync')).status);
  r.detalle.push(`Formato almacenado para laura.gomez@bufalo.com: ${u.password.slice(0, 7)}… (${u.password.length} caracteres)`);
  return { ok: u.password.startsWith('scrypt$') && !u.password.includes('LauraNueva2026') && conHash === todos.length && !sync && sinSesion === 401,
    obtenido: `Las ${todos.length} contraseñas están cifradas con scrypt (formato "scrypt$sal$hash", ${u.password.length} caracteres); ninguna en texto plano. La API no envía contraseñas al navegador y sin sesión responde ${sinSesion}.` };
});

caso('CP20', async (r) => {
  const p = await nuevaPagina({ width: 390, height: 844 });
  await entrar(p, 'luz.rosales@bufalo.com', 'admin123');
  // En celular el menú se abre con el botón ☰
  await p.click('#header-hamburger');
  await p.locator('#sidebar.mobile-open').waitFor();
  r.evidencias.push(await captura(p, 'CP20-menu-movil'));
  await p.click('.nav-item[data-page="nominas"]');
  await p.locator('#page-nominas.active').waitFor();
  await p.waitForTimeout(600);
  const tarjetas = await p.locator('#nominas-table-cards .card-item').count();
  const tablaVisible = await p.locator('#nominas-table').isVisible();
  const anchos = await p.evaluate(() => {
    const r = {};
    for (const pg of ['nominas', 'inventario', 'tareas', 'usuarios', 'dashboard']) {
      Router.navigate(pg);
      r[pg] = document.documentElement.scrollWidth;
    }
    Router.navigate('nominas');
    return r;
  });
  await p.waitForTimeout(400);
  r.evidencias.push(await captura(p, 'CP20-movil'));
  await p.context().close();
  const maximo = Math.max(...Object.values(anchos));
  const sinDesborde = maximo <= 390;
  return { ok: tarjetas > 0 && !tablaVisible && sinDesborde,
    obtenido: `En pantalla de 390 px la tabla de nóminas se reemplaza por ${tarjetas} tarjetas. Ancho real de la página por módulo: ${Object.entries(anchos).map(([k, v]) => `${k} ${v}px`).join(', ')}${sinDesborde ? ' (sin desplazamiento horizontal).' : ` → el contenido se sale de la pantalla (máximo ${maximo}px).`}` };
});

/* ==============================
   EJECUCIÓN
============================== */
(async () => {
  // Edge reciente solo admite el modo sin ventana "nuevo"
  browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const inicio = new Date();
  // Capturas adicionales para la descripción del sistema
  for (const c of casos) await ejecutar(c);
  if (!SOLO.length && admin) {
    await ir(admin, 'catalogo');
    capturasSistema.push({ archivo: await captura(admin, 'sis-catalogo'), titulo: 'Catálogo de diseños de calzado' });
    await ir(admin, 'usuarios');
    capturasSistema.push({ archivo: await captura(admin, 'sis-usuarios'), titulo: 'Gestión de usuarios' });
  }
  await browser.close();
  await db.end();
  const prev = fs.existsSync(path.join(OUT, 'resultados.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'resultados.json'), 'utf8')) : null;
  const salida = { inicio: inicio.toISOString(), fin: new Date().toISOString(), navegador: 'Microsoft Edge (Chromium) ' + browser.version(), resultados, capturasSistema };
  const nombre = SOLO.length ? `resultados-${SOLO.join('-')}.json` : 'resultados.json';
  fs.writeFileSync(path.join(OUT, nombre), JSON.stringify(salida, null, 2));
  const ok = resultados.filter(r => r.estado === 'Aprobado').length;
  console.log(`\nResumen: ${ok}/${resultados.length} aprobados → ${nombre}`);
})();
