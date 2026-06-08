/**
 * ROSALOPZManager - Main Application
 * SPA Router + All Modules
 * Fábrica de Calzado Bufalo R.P.
 */

/* ==============================
   STATE
============================== */
let currentUser = null;
let currentPage = 'dashboard';

/* ==============================
   THEME
============================== */


/* ==============================
   ROUTER
============================= */
const Router = {
  navigate: (page) => {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    currentPage = page;
    updateBreadcrumb(page);

    // Render page data
    switch(page) {
      case 'dashboard': renderDashboard(); break;
      case 'catalogo': renderCatalogo(); break;
      case 'nominas': renderNominas(); break;
      case 'inventario': renderInventario(); break;
      case 'tareas': renderTareas(); break;
      case 'usuarios': renderUsuarios(); break;
      case 'reportes': renderReportes(); break;
      case 'perfil': renderPerfil(); break;
    }

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    
    // Re-attach nav listeners
    setupNavListeners();
  },
};

const pageNames = {
  dashboard: 'Dashboard',
  catalogo: 'Catálogo Calzado',
  nominas: 'Nóminas',
  inventario: 'Inventario',
  tareas: 'Tareas',
  usuarios: 'Usuarios',
  reportes: 'Reportes',
  perfil: 'Mi Perfil',
};

function updateBreadcrumb(page) {
  const bc = document.getElementById('breadcrumb-current');
  if (bc) bc.textContent = pageNames[page] || page;
}

/* ==============================
   AUTH
============================== */
function checkAuth() {
  const session = DB.Session.get();
  if (session) {
    currentUser = session;
    showApp();
  } else {
    showAuth('login');
  }
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  setupSidebar();
  setupHeader();
  updateNotifBadge();
  setupNavListeners();
  
  // Only admins see dashboard; employees default to 'nominas'
  const rolLC = (currentUser.rol || '').toLowerCase();
  console.log('[showApp] User role:', rolLC);
  
  if (rolLC === 'empleado') {
    console.log('[showApp] Navigating employee to nominas');
    Router.navigate('nominas');
  } else {
    console.log('[showApp] Navigating admin to dashboard');
    Router.navigate('dashboard');
  }
}

function showAuth(tab = 'login') {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-content').forEach(t => t.style.display = 'none');
  const target = document.getElementById(`auth-${tab}`);
  if (target) target.style.display = 'block';
}

/* ==============================
   SIDEBAR + HEADER SETUP
============================== */
function setupNavListeners() {
  // Ensure nav listeners are attached
  document.querySelectorAll('.nav-item').forEach(item => {
    // Remove existing listeners by cloning
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
  });
  
  // Re-attach listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const page = item.dataset.page;
      if (page) Router.navigate(page);
    });
  });
}

function setupSidebar() {
  if (!currentUser) return;
  const rol = (currentUser.rol || '').toLowerCase();

  // Show/hide nav items based on role
  const adminOnly = document.querySelectorAll('[data-role="administrador"]');

  adminOnly.forEach(el => {
    el.style.display = (rol === 'administrador') ? '' : 'none';
  });

  // Toggle Nuevo Diseño and Nuevo Usuario buttons based on role (admin only)
  const addCatBtn = document.getElementById('btn-add-catalogo');
  if (addCatBtn) addCatBtn.style.display = (rol === 'administrador') ? '' : 'none';

  // Update user info in sidebar
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserRole = document.getElementById('sidebar-user-role');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarUserName) sidebarUserName.textContent = currentUser.nombre;
  if (sidebarUserRole) {
    const cargoStr = currentUser.cargo ? ` (${currentUser.cargo})` : '';
    const roleCap = (currentUser.rol || '').charAt(0).toUpperCase() + (currentUser.rol || '').slice(1);
    sidebarUserRole.textContent = roleCap + cargoStr;
  }
  if (sidebarAvatar) {
    sidebarAvatar.textContent = Fmt.initials(currentUser.nombre);
    sidebarAvatar.style.background = Fmt.avatarColor(currentUser.id);
  }
}

function setupHeader() {
  if (!currentUser) return;
  const headerName = document.getElementById('header-user-name');
  const headerRole = document.getElementById('header-user-role');
  const headerAvatar = document.getElementById('header-avatar');
  if (headerName) headerName.textContent = currentUser.nombre.split(' ')[0];
  if (headerRole) {
    const roleCap = (currentUser.rol || '').charAt(0).toUpperCase() + (currentUser.rol || '').slice(1);
    headerRole.textContent = roleCap;
  }
  if (headerAvatar) {
    headerAvatar.textContent = Fmt.initials(currentUser.nombre);
    headerAvatar.style.background = Fmt.avatarColor(currentUser.id);
  }
}

/* ==============================
   DASHBOARD
============================== */
function renderDashboard() {
  // Stats
  const nominaStats = DB.Nominas.getTotales();
  const invStats = DB.Inventario.getStats();
  const tareaStats = DB.Tareas.getStats();
  const totalEmpleados = DB.Usuarios.getEmpleados().length;

  document.getElementById('stat-empleados').textContent = totalEmpleados;
  document.getElementById('stat-nominas').textContent = Fmt.currency(nominaStats.totalNeto);
  document.getElementById('stat-inventario').textContent = invStats.totalProductos;
  document.getElementById('stat-tareas').textContent = `${tareaStats.completadas}/${tareaStats.total}`;
  document.getElementById('stat-stock-bajo').textContent = invStats.stockBajo;
  document.getElementById('stat-pendientes').textContent = nominaStats.pendientes;

  // Alerts
  const alertsContainer = document.getElementById('dashboard-alerts');
  const lowStock = DB.Inventario.getLowStock();
  const vencidas = DB.Tareas.getAll().filter(t => t.estado !== 'completada' && t.fecha_vencimiento < new Date().toISOString().split('T')[0]);

  let alertsHtml = '';
  if (lowStock.length > 0) {
    alertsHtml += `<div class="dash-alert dash-alert-warning">
      <span class="dash-alert-icon">⚠️</span>
      <div><strong>${lowStock.length} producto(s)</strong> con stock bajo o agotado: ${lowStock.map(p => p.nombre).slice(0,3).join(', ')}${lowStock.length > 3 ? '...' : ''}</div>
    </div>`;
  }
  if (vencidas.length > 0) {
    alertsHtml += `<div class="dash-alert dash-alert-danger">
      <span class="dash-alert-icon">🔴</span>
      <div><strong>${vencidas.length} tarea(s)</strong> vencidas sin completar</div>
    </div>`;
  }
  if (alertsHtml === '') {
    alertsHtml = `<div class="dash-alert dash-alert-success"><span class="dash-alert-icon">✅</span><div>Todo en orden. Sin alertas activas.</div></div>`;
  }
  if (alertsContainer) alertsContainer.innerHTML = alertsHtml;

  // Recent activities
  renderRecentActivities();

  // Donut charts
  const tareaCanvas = document.getElementById('tareas-chart');
  if (tareaCanvas) {
    Charts.drawDonut(tareaCanvas, [
      { value: tareaStats.completadas, color: '#06d6a0' },
      { value: tareaStats.en_progreso, color: '#4cc9f0' },
      { value: tareaStats.pendientes, color: '#f8a80c' },
      { value: tareaStats.vencidas, color: '#ef233c' },
    ], {
      centerText: tareaStats.completadas,
      centerSub: 'Completadas',
    });
  }

  // Bar chart for nominas
  const nominaCanvas = document.getElementById('nomina-chart');
  if (nominaCanvas) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    Charts.drawBar(nominaCanvas, meses.map((label, i) => ({
      label,
      value: Math.floor(3000000 + Math.random() * 1500000),
      color: '#4361ee',
      color2: '#3a0ca3',
    })), { pad: 20, barWidth: 24 });
  }

  // Top tasks
  renderTopTasks();
}

function renderRecentActivities() {
  const container = document.getElementById('recent-activities');
  if (!container) return;
  const tareas = DB.Tareas.getAll().slice(-5).reverse();
  if (tareas.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Sin actividades recientes</p></div>';
    return;
  }
  container.innerHTML = tareas.map(t => `
    <div class="activity-item" style="cursor: pointer;" onclick="verDetalleTarea(${t.id})">
      <div class="avatar" style="background: ${Fmt.avatarColor(t.usuario_id || 1)}; width:36px; height:36px; font-size:0.8rem; flex-shrink:0;">
        ${Fmt.initials(t.empleado?.nombre || 'S')}
      </div>
      <div class="activity-body">
        <div class="activity-text">${t.empleado?.nombre || 'Sistema'}: <strong>${t.descripcion.substring(0, 40)}${t.descripcion.length > 40 ? '...' : ''}</strong></div>
        <div class="activity-meta">Etapa: <span class="badge badge-primary" style="font-size: 0.65rem;">${t.etapa_actual.toUpperCase()}</span> · ${Fmt.estadoTarea(t.estado)}</div>
      </div>
    </div>
  `).join('');
}

function renderTopTasks() {
  const container = document.getElementById('top-tasks');
  if (!container) return;
  const tareas = DB.Tareas.getAll().filter(t => t.estado !== 'completada').slice(0, 4);
  if (tareas.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size:0.9rem; padding: 12px 0;">Sin tareas pendientes 🎉</div>';
    return;
  }
  container.innerHTML = tareas.map(t => `
    <div class="task-mini-item" style="cursor: pointer;" onclick="verDetalleTarea(${t.id})">
      <div class="task-mini-dot" style="background: ${t.prioridad === 'alta' ? 'var(--danger)' : t.prioridad === 'media' ? 'var(--warning)' : 'var(--success)'}"></div>
      <div class="task-mini-body">
        <div class="task-mini-text">${t.descripcion.substring(0, 48)}...</div>
        <div class="task-mini-meta">${t.empleado?.nombre || 'Por Asignar'} · Vence: ${Fmt.date(t.fecha_vencimiento)}</div>
      </div>
      <span class="badge badge-info" style="font-size:0.6rem;">${t.etapa_actual.toUpperCase()}</span>
    </div>
  `).join('');
}

/* ==============================
   CATÁLOGO MODULE
============================== */
let catalogoSearch = '';
let catalogoFiltroTalla = '';
let catalogoFiltroColor = '';

function renderCatalogo() {
  const canManage = ((currentUser.rol || '').toLowerCase() === 'administrador');
  let productos = DB.Catalogo.getAll();

  // Populate Talla & Color Filter Dropdowns dynamically once if empty
  const filterTalla = document.getElementById('catalogo-filtro-talla');
  const filterColor = document.getElementById('catalogo-filtro-color');

  if (filterTalla && filterTalla.options.length <= 1) {
    const allTallas = [...new Set(productos.flatMap(p => p.tallas))].sort((a,b)=>a-b);
    allTallas.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = `Talla ${t}`;
      filterTalla.appendChild(opt);
    });
  }
  if (filterColor && filterColor.options.length <= 1) {
    const allColores = [...new Set(productos.flatMap(p => p.colores))].sort();
    allColores.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      filterColor.appendChild(opt);
    });
  }

  // Apply filters
  if (catalogoSearch) {
    productos = productos.filter(p => p.referencia.toLowerCase().includes(catalogoSearch.toLowerCase()) || p.nombre.toLowerCase().includes(catalogoSearch.toLowerCase()));
  }
  if (catalogoFiltroTalla) {
    productos = productos.filter(p => p.tallas.includes(parseInt(catalogoFiltroTalla)));
  }
  if (catalogoFiltroColor) {
    productos = productos.filter(p => p.colores.includes(catalogoFiltroColor));
  }

  const container = document.getElementById('catalogo-container');
  if (!container) return;

  if (productos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">👟</div><h3>Sin productos en el catálogo</h3><p>No se encontraron productos coincidentes.</p></div>`;
    return;
  }

  container.innerHTML = productos.map(p => `
    <div class="catalog-card glass">
      <div class="catalog-img-container" onclick="verDetalleCatalogo(${p.id})" style="cursor:pointer;">
        <img src="${p.foto || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'}" class="catalog-img" alt="${p.nombre}" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'" />
      </div>
      <div class="catalog-card-body">
        <div class="catalog-ref">${p.referencia}</div>
        <h3 class="catalog-title" onclick="verDetalleCatalogo(${p.id})" style="cursor:pointer; font-size:1.15rem; font-weight:700;">${p.nombre}</h3>
        <div class="catalog-price">${Fmt.currency(p.precio)}</div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom: 12px; display:flex; flex-direction:column; gap:4px;">
          <div>🧬 Material: <strong>${p.material || 'N/A'}</strong></div>
          <div>👟 Suela: <strong>${p.suela || 'N/A'}</strong></div>
        </div>
        
        <div class="catalog-badges">
          <div style="width:100%; display:flex; flex-wrap:wrap; gap:4px; margin-bottom: 6px;">
            ${p.colores.map(c => `<span class="badge badge-info" style="font-size:0.65rem; padding: 2px 6px;">${c}</span>`).join('')}
          </div>
          <div style="width:100%; display:flex; flex-wrap:wrap; gap:4px;">
            ${p.tallas.slice(0, 6).map(t => `<span class="catalog-badge-tallas">${t}</span>`).join('')}
            ${p.tallas.length > 6 ? `<span class="catalog-badge-tallas">+${p.tallas.length - 6}</span>` : ''}
          </div>
        </div>

        ${canManage ? `
          <div class="catalog-actions">
            <button class="btn btn-sm btn-outline" style="flex:1;" onclick="editCatalogo(${p.id})">✏️ Editar</button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteCatalogo(${p.id})">🗑️</button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderTallasCheckboxes(selectedTallas = []) {
  const container = document.getElementById('cat-tallas-container');
  if (!container) return;
  
  let html = '';
  for (let t = 21; t <= 44; t++) {
    const isChecked = selectedTallas.includes(t);
    html += `
      <label class="talla-checkbox-label ${isChecked ? 'selected' : ''}" data-talla="${t}">
        <input type="checkbox" name="cat-tallas-check" value="${t}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('selected', this.checked)" />
        ${t}
      </label>
    `;
  }
  container.innerHTML = html;
}

function openAddCatalogo() {
  document.getElementById('catalogo-form').reset();
  document.getElementById('cat-id-edit').value = '';
  document.getElementById('catalogo-modal-title').textContent = 'Nuevo Calzado';
  renderTallasCheckboxes([]);
  Modal.open('catalogo-modal');
}

function editCatalogo(id) {
  const p = DB.Catalogo.getById(id);
  if (!p) return;
  document.getElementById('cat-id-edit').value = id;
  document.getElementById('catalogo-modal-title').textContent = 'Editar Calzado';
  document.getElementById('cat-referencia').value = p.referencia;
  document.getElementById('cat-nombre').value = p.nombre;
  document.getElementById('cat-colores').value = p.colores.join(', ');
  document.getElementById('cat-suela').value = p.suela || '';
  document.getElementById('cat-material').value = p.material || '';
  document.getElementById('cat-precio').value = p.precio;
  document.getElementById('cat-foto-url').value = p.foto || '';
  document.getElementById('cat-descripcion').value = p.descripcion || '';
  renderTallasCheckboxes(p.tallas);
  Modal.open('catalogo-modal');
}

function saveCatalogo() {
  const id = document.getElementById('cat-id-edit').value;
  const checkedTallas = Array.from(document.querySelectorAll('input[name="cat-tallas-check"]:checked')).map(el => parseInt(el.value));
  
  if (checkedTallas.length === 0) {
    Toast.error('Debes seleccionar al menos una talla disponible');
    return;
  }

  const data = {
    referencia: document.getElementById('cat-referencia').value,
    nombre: document.getElementById('cat-nombre').value,
    tallas: checkedTallas,
    colores: document.getElementById('cat-colores').value.split(',').map(c => c.trim()).filter(Boolean),
    suela: document.getElementById('cat-suela').value,
    material: document.getElementById('cat-material').value,
    precio: document.getElementById('cat-precio').value,
    foto: document.getElementById('cat-foto-url').value,
    descripcion: document.getElementById('cat-descripcion').value,
  };

  if (!data.referencia || !data.nombre || data.colores.length === 0) {
    Toast.error('Completa los campos obligatorios');
    return;
  }

  const result = id ? DB.Catalogo.update(parseInt(id), data) : DB.Catalogo.create(data);
  if (result.error) { Toast.error(result.error); return; }
  Toast.success(id ? 'Diseño actualizado' : 'Diseño agregado al catálogo');
  Modal.close('catalogo-modal');
  renderCatalogo();
}

async function deleteCatalogo(id) {
  const ok = await Modal.confirm('¿Seguro que deseas eliminar este diseño de calzado?', 'Eliminar Calzado');
  if (!ok) return;
  DB.Catalogo.delete(id);
  Toast.success('Calzado eliminado');
  renderCatalogo();
}

function verDetalleCatalogo(id) {
  const p = DB.Catalogo.getById(id);
  if (!p) return;

  document.getElementById('cat-detail-title').textContent = `${p.nombre} (${p.referencia})`;
  
  const body = document.getElementById('catalogo-detalle-body');
  body.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; border-radius:var(--radius-md); overflow:hidden; background:#11112b;">
      <img src="${p.foto || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'}" style="max-height:260px; object-fit:contain;" alt="${p.nombre}" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'" />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
      <div class="glass" style="padding:12px;"><span style="font-size:0.75rem; color:var(--text-muted);">PRECIO VENTA</span><div style="font-size:1.15rem; font-weight:800; color:var(--success);">${Fmt.currency(p.precio)}</div></div>
      <div class="glass" style="padding:12px;"><span style="font-size:0.75rem; color:var(--text-muted);">REFERENCIA</span><div style="font-size:1.15rem; font-weight:800; color:var(--accent);">${p.referencia}</div></div>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;" class="glass; padding:16px;">
      <div>🧬 <strong>Material:</strong> ${p.material || 'N/A'}</div>
      <div>👟 <strong>Suela:</strong> ${p.suela || 'N/A'}</div>
      <div>🎨 <strong>Colores:</strong> ${p.colores.join(', ')}</div>
      <div>📏 <strong>Tallas:</strong> ${p.tallas.join(', ')}</div>
      ${p.descripcion ? `<div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06); color:var(--text-secondary); font-style:italic;">"${p.descripcion}"</div>` : ''}
    </div>
    <div style="text-align:right;">
      <button class="btn btn-outline" onclick="Modal.close('catalogo-detalle-modal')">Cerrar</button>
    </div>
  `;
  Modal.open('catalogo-detalle-modal');
}

/* ==============================
   NÓMINAS MODULE
============================== */
let nominaSearch = '';
let nominaFiltroEstado = '';
let nominaFiltroPeriodo = '';
let nominaFiltroPeriodoDetalle = '';

function actualizarFiltrosPeriodo() {
  const periodo = document.getElementById('nomina-filtro-periodo').value;
  const container = document.getElementById('nomina-filtro-detalle-container');
  if (!container) return;
  
  container.innerHTML = '';
  nominaFiltroPeriodo = periodo;
  nominaFiltroPeriodoDetalle = '';

  const nominas = DB.Nominas.getAll();

  if (periodo === 'semana') {
    // Collect active weeks
    const weeks = [...new Set(nominas.map(n => `${n.año}-W${String(n.semana).padStart(2,'0')}`))].sort().reverse();
    const select = document.createElement('select');
    select.className = 'form-control';
    select.style.width = '180px';
    select.innerHTML = '<option value="">Elegir Semana</option>' + weeks.map(w => `<option value="${w}">Semana ${w.split('-W')[1]} (${w.split('-W')[0]})</option>`).join('');
    select.onchange = (e) => {
      nominaFiltroPeriodoDetalle = e.target.value;
      renderNominas();
    };
    container.appendChild(select);
  } else if (periodo === 'mes') {
    const mesesValidos = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const months = [...new Set(nominas.map(n => {
      const d = new Date(n.fecha);
      return `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
    }))].sort().reverse();
    const select = document.createElement('select');
    select.className = 'form-control';
    select.style.width = '180px';
    select.innerHTML = '<option value="">Elegir Mes</option>' + months.map(m => {
      const [y, idx] = m.split('-');
      return `<option value="${m}">${mesesValidos[parseInt(idx)]} ${y}</option>`;
    }).join('');
    select.onchange = (e) => {
      nominaFiltroPeriodoDetalle = e.target.value;
      renderNominas();
    };
    container.appendChild(select);
  } else if (periodo === 'año') {
    const years = [...new Set(nominas.map(n => new Date(n.fecha).getFullYear()))].sort().reverse();
    const select = document.createElement('select');
    select.className = 'form-control';
    select.style.width = '140px';
    select.innerHTML = '<option value="">Elegir Año</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    select.onchange = (e) => {
      nominaFiltroPeriodoDetalle = e.target.value;
      renderNominas();
    };
    container.appendChild(select);
  }
  
  renderNominas();
}

function renderNominas() {
  const canManage = ((currentUser.rol || '').toLowerCase() === 'administrador');
  let nominas = DB.Nominas.getAll();

  if (((currentUser.rol || '').toLowerCase() === 'empleado')) {
    nominas = nominas.filter(n => n.usuario_id === currentUser.id);
  }

  // Filters
  if (nominaSearch) {
    nominas = nominas.filter(n => n.usuario?.nombre?.toLowerCase().includes(nominaSearch.toLowerCase()));
  }
  if (nominaFiltroEstado) {
    nominas = nominas.filter(n => n.estado === nominaFiltroEstado);
  }

  // Period filtering
  if (nominaFiltroPeriodo && nominaFiltroPeriodoDetalle) {
    if (nominaFiltroPeriodo === 'semana') {
      const [year, week] = nominaFiltroPeriodoDetalle.split('-W');
      nominas = nominas.filter(n => n.año === parseInt(year) && n.semana === parseInt(week));
    } else if (nominaFiltroPeriodo === 'mes') {
      const [year, monthIdx] = nominaFiltroPeriodoDetalle.split('-');
      nominas = nominas.filter(n => {
        const d = new Date(n.fecha);
        return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(monthIdx);
      });
    } else if (nominaFiltroPeriodo === 'año') {
      nominas = nominas.filter(n => new Date(n.fecha).getFullYear() === parseInt(nominaFiltroPeriodoDetalle));
    }
  }

  const totales = {
    total: nominas.reduce((s, n) => s + n.neto, 0),
    pagadas: nominas.filter(n => n.estado === 'pagada').length,
    pendientes: nominas.filter(n => n.estado === 'pendiente').length,
  };

  document.getElementById('nomina-total-pago').textContent = Fmt.currency(totales.total);
  document.getElementById('nomina-pagadas').textContent = totales.pagadas;
  document.getElementById('nomina-pendientes').textContent = totales.pendientes;

  const addBtn = document.getElementById('btn-add-nomina');
  if (addBtn) addBtn.style.display = canManage ? '' : 'none';

  const tbody = document.getElementById('nomina-tbody');
  if (!tbody) return;

  if (nominas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">💰</div><h3>Sin nóminas registradas</h3><p>No se encontraron registros de nóminas para este período.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = nominas.map(n => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="avatar" style="background:${Fmt.avatarColor(n.usuario_id)}; width:34px; height:34px; font-size:0.78rem;">${Fmt.initials(n.usuario?.nombre || '?')}</div>
          <div>
            <div style="font-weight:600;">${n.usuario?.nombre || 'N/A'}</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">${n.usuario?.cargo || ''}</div>
          </div>
        </div>
      </td>
      <td>${Fmt.rolBadge(n.usuario?.rol || '')}</td>
      <td>${Fmt.currency(n.salario)}</td>
      <td style="color:var(--danger);">${Fmt.currency(n.deducciones)}</td>
      <td style="color:var(--success);">${Fmt.currency(n.bonificaciones)}</td>
      <td><strong style="color:var(--accent);">${Fmt.currency(n.neto)}</strong></td>
      <td>${Fmt.estadoNomina(n.estado)}</td>
      <td style="min-width:120px;">
        ${n.medio_pago ? `<span class="badge badge-info">${n.medio_pago}</span>` : '<span class="text-muted">-</span>'}
        ${n.comprobante ? `<div style="margin-top:6px;"><a href="${n.comprobante}" target="_blank"><img src="${n.comprobante}" style="width:68px; height:auto; border-radius:6px; border:1px solid var(--border);" alt="comprobante"/></a></div>` : ''}
      </td>
      <td>
        <div>${Fmt.date(n.fecha)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">Semana ${n.semana}, ${n.año}</div>
      </td>
      ${canManage ? `<td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm btn-outline" onclick="editNomina(${n.id})" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteNomina(${n.id})" title="Eliminar">🗑️</button>
          ${n.estado === 'pendiente' ? `<button class="btn btn-sm btn-success" onclick="pagarNomina(${n.id})" title="Marcar pagada">💳</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="abrirModalDescargaNomina(${n.usuario_id})" title="Descargar nóminas del empleado">📥</button>
        </div>
      </td>` : `<td><button class="btn btn-sm btn-outline" onclick="abrirModalDescargaNomina(${n.usuario_id})" title="Descargar mi nómina">📥</button></td>`}
    </tr>
  `).join('');

  if (!canManage) {
    const header = document.getElementById('nomina-table-actions-header');
    if (header) header.style.display = '';
  }
}

function openAddNomina() {
  const empleados = DB.Usuarios.getEmpleados();
  const selectHtml = empleados.map(e => `<option value="${e.id}">${e.nombre} (${e.cargo})</option>`).join('');
  document.getElementById('nomina-usuario-select').innerHTML = selectHtml;
  document.getElementById('nomina-form').reset();
  document.getElementById('nomina-modal-title').textContent = 'Nueva Nómina';
  document.getElementById('nomina-id-edit').value = '';
  document.getElementById('nomina-salario').value = '1423500';
  document.getElementById('nomina-fecha').value = new Date().toISOString().split('T')[0];
  Modal.open('nomina-modal');
}

function editNomina(id) {
  const nominas = DB.Nominas.getAll();
  const n = nominas.find(x => x.id === id);
  if (!n) return;
  const empleados = DB.Usuarios.getEmpleados();
  const selectHtml = empleados.map(e => `<option value="${e.id}" ${e.id === n.usuario_id ? 'selected' : ''}>${e.nombre} (${e.cargo})</option>`).join('');
  document.getElementById('nomina-usuario-select').innerHTML = selectHtml;
  document.getElementById('nomina-id-edit').value = id;
  document.getElementById('nomina-modal-title').textContent = 'Editar Nómina';
  document.getElementById('nomina-salario').value = n.salario;
  document.getElementById('nomina-deducciones').value = n.deducciones;
  document.getElementById('nomina-bonificaciones').value = n.bonificaciones;
  document.getElementById('nomina-fecha').value = n.fecha;
  document.getElementById('nomina-estado').value = n.estado;
  // medio y comprobante
  if (n.medio_pago) {
    document.getElementById('nomina-medio').value = n.medio_pago;
    document.getElementById('nomina-comprobante-group').style.display = (n.medio_pago ? 'block' : 'none');
  } else {
    document.getElementById('nomina-medio').value = '';
    document.getElementById('nomina-comprobante-group').style.display = 'none';
  }
  if (n.comprobante) {
    const img = document.getElementById('nomina-comp-preview');
    img.src = n.comprobante;
    img.style.display = 'block';
  } else {
    const img = document.getElementById('nomina-comp-preview');
    img.src = '';
    img.style.display = 'none';
  }
  Modal.open('nomina-modal');
}

function saveNomina() {
  const id = document.getElementById('nomina-id-edit').value;
  const data = {
    usuario_id: document.getElementById('nomina-usuario-select').value,
    salario: document.getElementById('nomina-salario').value,
    deducciones: document.getElementById('nomina-deducciones').value,
    bonificaciones: document.getElementById('nomina-bonificaciones').value,
    fecha: document.getElementById('nomina-fecha').value,
    estado: document.getElementById('nomina-estado').value,
    medio_pago: document.getElementById('nomina-medio').value || '',
  };
  if (!data.usuario_id || !data.salario || !data.fecha) {
    Toast.error('Por favor completa todos los campos requeridos');
    return;
  }
  // Handle optional comprobante file (read as data URL)
  const fileInput = document.getElementById('nomina-comprobante-file');
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      data.comprobante = ev.target.result;
      const result = id ? DB.Nominas.update(parseInt(id), data) : DB.Nominas.create(data);
      if (result.error) { Toast.error(result.error); return; }
      Toast.success(id ? 'Nómina actualizada correctamente' : 'Nómina creada correctamente');
      Modal.close('nomina-modal');
      renderNominas();
    };
    reader.readAsDataURL(file);
  } else {
    // If editing and no new file provided, keep existing comprobante
    if (id) {
      const prev = DB.Nominas.getAll().find(x => x.id === parseInt(id));
      if (prev && prev.comprobante) data.comprobante = prev.comprobante;
    }
    const result = id ? DB.Nominas.update(parseInt(id), data) : DB.Nominas.create(data);
    if (result.error) { Toast.error(result.error); return; }
    Toast.success(id ? 'Nómina actualizada correctamente' : 'Nómina creada correctamente');
    Modal.close('nomina-modal');
    renderNominas();
  }
}

async function deleteNomina(id) {
  const ok = await Modal.confirm('¿Eliminar esta nómina? Esta acción no se puede deshacer.', 'Eliminar Nómina');
  if (!ok) return;
  DB.Nominas.delete(id);
  Toast.success('Nómina eliminada');
  renderNominas();
}

function pagarNomina(id) {
  DB.Nominas.update(id, { estado: 'pagada' });
  Toast.success('Nómina marcada como pagada ✅');
  renderNominas();
}

/* ==============================
   THEME MANAGEMENT
============================== */
function initTheme() {
  const saved = localStorage.getItem('rosalopz_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
  updateLogoImages(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('rosalopz_theme', next);
  updateThemeBtn(next);
  updateLogoImages(next);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function updateLogoImages(theme) {
  // Keep auth/login logo always using the light (transparent) variant; change other logos with theme
  const logos = document.querySelectorAll('.sidebar-logo, .dash-logo-hero img');
  logos.forEach(img => {
    if (theme === 'light') img.src = 'assets/img/logo-light.png';
    else img.src = 'assets/img/logo.png';
  });
  // Ensure auth login uses light logo (transparent) regardless
  const authLogo = document.querySelector('.auth-brand-logo-centered img');
  if (authLogo) authLogo.src = 'assets/img/logo-light.png';
}

/* ==============================
   INVENTARIO MODULE
============================== */
let invSearch = '';
let invCategoria = '';

function renderInventario() {
  const isEmpleado = ((currentUser.rol || '').toLowerCase() === 'empleado');
  let items = DB.Inventario.getAll();
  const stats = DB.Inventario.getStats();

  document.getElementById('inv-total-prod').textContent = stats.totalProductos;
  document.getElementById('inv-stock-bajo').textContent = stats.stockBajo;
  document.getElementById('inv-valor-total').textContent = Fmt.currency(stats.valorTotal);
  document.getElementById('inv-categorias').textContent = stats.categorias;

  // Hide add/edit/delete buttons for employees - only allow subtract
  const addBtn = document.querySelector('#page-inventario .btn-primary');
  if (addBtn) addBtn.style.display = isEmpleado ? 'none' : '';

  if (invSearch) {
    items = items.filter(p => p.nombre.toLowerCase().includes(invSearch.toLowerCase()) || p.proveedor.toLowerCase().includes(invSearch.toLowerCase()));
  }
  if (invCategoria) {
    items = items.filter(p => p.categoria === invCategoria);
  }

  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3><p>Agrega el primer producto al inventario.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-info">${p.categoria}</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="font-size:1.1rem;">${p.cantidad}</strong>
          <span style="color:var(--text-muted); font-size:0.8rem;">${p.unidad}</span>
        </div>
        <div class="progress-bar-wrap" style="margin-top:4px; width:80px;">
          <div class="progress-bar-fill" style="width:${Math.min(100, (p.cantidad / (p.stock_minimo * 3)) * 100)}%; background: ${p.cantidad <= p.stock_minimo ? 'var(--danger)' : 'linear-gradient(90deg, var(--success), #06d6a0)'};"></div>
        </div>
      </td>
      <td>${p.proveedor}</td>
      <td>${Fmt.currency(p.precio_unitario)}</td>
      <td>${Fmt.currency(p.cantidad * p.precio_unitario)}</td>
      <td>${Fmt.stockBadge(p.cantidad, p.stock_minimo)}</td>
      <td>${Fmt.date(p.fecha_actualizacion)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          ${isEmpleado ? '' : `<button class="btn btn-sm btn-outline" onclick="editProducto(${p.id})" title="Editar">✏️</button>`}
          <button class="btn btn-sm btn-danger btn-icon" onclick="ajustarStock(${p.id}, 'salida')" title="Salida de stock" style="width:32px; height:32px;">➖</button>
          ${isEmpleado ? '' : `<button class="btn btn-sm btn-success btn-icon" onclick="ajustarStock(${p.id}, 'entrada')" title="Entrada" style="width:32px; height:32px;">➕</button>`}
          ${isEmpleado ? '' : `<button class="btn btn-sm btn-danger" onclick="deleteProducto(${p.id})" title="Eliminar">🗑️</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddProducto() {
  document.getElementById('inv-form').reset();
  document.getElementById('inv-id-edit').value = '';
  document.getElementById('inv-modal-title').textContent = 'Nuevo Producto';
  Modal.open('inv-modal');
}

function editProducto(id) {
  const p = DB.Inventario.getById(id);
  if (!p) return;
  document.getElementById('inv-id-edit').value = id;
  document.getElementById('inv-modal-title').textContent = 'Editar Producto';
  document.getElementById('inv-nombre').value = p.nombre;
  document.getElementById('inv-cantidad').value = p.cantidad;
  document.getElementById('inv-unidad').value = p.unidad;
  document.getElementById('inv-proveedor').value = p.proveedor;
  document.getElementById('inv-precio').value = p.precio_unitario;
  document.getElementById('inv-stock-min').value = p.stock_minimo;
  document.getElementById('inv-categoria').value = p.categoria;
  Modal.open('inv-modal');
}

function saveProducto() {
  const id = document.getElementById('inv-id-edit').value;
  const data = {
    nombre: document.getElementById('inv-nombre').value,
    cantidad: document.getElementById('inv-cantidad').value,
    unidad: document.getElementById('inv-unidad').value,
    proveedor: document.getElementById('inv-proveedor').value,
    precio_unitario: document.getElementById('inv-precio').value,
    stock_minimo: document.getElementById('inv-stock-min').value,
    categoria: document.getElementById('inv-categoria').value,
  };
  if (!data.nombre || !data.cantidad) {
    Toast.error('Nombre y cantidad son requeridos');
    return;
  }
  const result = id ? DB.Inventario.update(parseInt(id), data) : DB.Inventario.create(data);
  if (result.error) { Toast.error(result.error); return; }
  Toast.success(id ? 'Producto actualizado' : 'Producto creado');
  Modal.close('inv-modal');
  renderInventario();
}

function ajustarStock(id, tipo) {
  // Open stock adjust modal and prefill values
  const p = DB.Inventario.getById(id);
  if (!p) return;
  document.getElementById('stock-adjust-id').value = id;
  document.getElementById('stock-adjust-nombre').value = p.nombre;
  document.getElementById('stock-adjust-cantidad').value = 1;
  document.getElementById('stock-adjust-tipo').value = tipo || 'salida';
  Modal.open('stock-adjust-modal');
}

function handleStockAdjust(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('stock-adjust-id').value);
  const tipo = document.getElementById('stock-adjust-tipo').value;
  const qty = parseInt(document.getElementById('stock-adjust-cantidad').value);
  if (!id || !qty || isNaN(qty) || qty <= 0) {
    Toast.error('Cantidad inválida');
    return;
  }
  const p = DB.Inventario.getById(id);
  const result = DB.Inventario.ajustarStock(id, qty, tipo);
  if (result.error) { Toast.error(result.error); return; }
  Toast.success(`Stock ${tipo === 'entrada' ? 'incrementado' : 'reducido'} en ${qty} ${p.unidad}`);
  Modal.close('stock-adjust-modal');
  renderInventario();
}

async function deleteProducto(id) {
  const ok = await Modal.confirm('¿Eliminar este producto del inventario?', 'Eliminar Producto');
  if (!ok) return;
  DB.Inventario.delete(id);
  Toast.success('Producto eliminado');
  renderInventario();
}

/* ==============================
   TAREAS MODULE (con Pipeline)
============================== */
let tareaSearch = '';
let tareaFiltroEstado = '';
let tareaFiltroPrioridad = '';

function renderTareas() {
  const canManage = ((currentUser.rol || '').toLowerCase() === 'administrador');
  const scopeEl = document.getElementById('tarea-filtro-ambito');
  let tareas = [];

  if (canManage) {
    if (scopeEl) scopeEl.style.display = 'none';
    tareas = DB.Tareas.getAll();
  } else {
    if (scopeEl) scopeEl.style.display = '';
    const scopeVal = scopeEl ? scopeEl.value : 'activas';
    if (scopeVal === 'historial') {
      tareas = DB.Tareas.getAll().filter(t => 
        t.historial_etapas && t.historial_etapas.some(h => h.usuario_id === currentUser.id)
      );
    } else {
      tareas = DB.Tareas.getByUsuario(currentUser.id);
    }
  }

  if (tareaSearch) {
    tareas = tareas.filter(t => t.descripcion.toLowerCase().includes(tareaSearch.toLowerCase()) || (t.producto?.nombre || '').toLowerCase().includes(tareaSearch.toLowerCase()));
  }
  if (tareaFiltroEstado) {
    tareas = tareas.filter(t => t.estado === tareaFiltroEstado);
  }
  if (tareaFiltroPrioridad) {
    tareas = tareas.filter(t => t.prioridad === tareaFiltroPrioridad);
  }

  const stats = canManage ? DB.Tareas.getStats() : DB.Tareas.getStats(currentUser.id);
  document.getElementById('tarea-pendientes').textContent = stats.pendientes;
  document.getElementById('tarea-progreso').textContent = stats.en_progreso;
  document.getElementById('tarea-completadas').textContent = stats.completadas;
  document.getElementById('tarea-vencidas').textContent = stats.vencidas;

  const addBtn = document.getElementById('btn-add-tarea');
  if (addBtn) addBtn.style.display = canManage ? '' : 'none';

  const container = document.getElementById('tareas-container');
  if (!container) return;

  if (tareas.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">✅</div><h3>Sin tareas</h3><p>No hay tareas registradas.</p></div>`;
    return;
  }

  const etapaCargoMap = { corte: 'Cortador', guarnecido: 'Guarnecedor', soladura: 'Solador', emplantillado: 'Emplantillador', listo: 'Finalizado' };
  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = tareas.map(t => {
    const isOverdue = t.estado !== 'completada' && t.fecha_vencimiento < todayStr;
    const prodName = t.producto ? `${t.producto.nombre} (${t.producto.referencia})` : 'Diseño Desconocido';
    const labelCargo = etapaCargoMap[t.etapa_actual] || t.etapa_actual;

    // Needs-assignment: task state is 'completada' but stage isn't 'listo' (waiting for supervisor)
    const needsAssignment = canManage && t.estado === 'completada' && t.etapa_actual !== 'listo';
    const etapas = ['corte', 'guarnecido', 'soladura', 'emplantillado', 'listo'];
    const currentIdx = etapas.indexOf(t.etapa_actual);
    const nextCargo = needsAssignment && currentIdx >= 0 && currentIdx < etapas.length - 1 
      ? etapaCargoMap[etapas[currentIdx + 1]] 
      : null;

    const tallasStr = Array.isArray(t.tallas_lote) && t.tallas_lote.length > 0
      ? t.tallas_lote.join(', ')
      : (t.talla ? String(t.talla) : 'N/A');

    const isCompletedFinal = t.estado === 'completada' && t.etapa_actual === 'listo';
    const statusClass = needsAssignment 
      ? 'status-pending-assignment' 
      : (isCompletedFinal ? 'status-completed' : 'status-in-progress');

    return `
    <div class="tarea-card glass ${statusClass} ${isOverdue ? 'overdue' : ''} ${needsAssignment ? 'needs-assignment' : ''}" style="padding: 20px; transition: var(--transition); position:relative; cursor:pointer;" onclick="verDetalleTarea(${t.id})">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        ${Fmt.prioridadBadge(t.prioridad)}
        <span class="badge ${needsAssignment ? 'badge-warning' : 'badge-primary'}" style="font-size:0.68rem;">Etapa: ${labelCargo}</span>
      </div>
      <h4 style="font-size:0.95rem; font-weight:600; margin-bottom:8px; line-height:1.4;">${t.descripcion}</h4>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:12px;">
        <div>💟 <strong>${prodName}</strong></div>
        <div>📐 Tallas: ${tallasStr} · Color: ${t.color} · Cant: ${t.cantidad_pares} pares</div>
      </div>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:14px; display:flex; flex-direction:column; gap:4px;">
        <div>👤 Asignado: <strong>${t.empleado?.nombre || 'Por asignar'}</strong></div>
        <div style="${isOverdue ? 'color:var(--danger);' : ''}">📅 Vence: ${Fmt.date(t.fecha_vencimiento)} ${isOverdue ? '⚠️ VENCIDA' : ''}</div>
        <div>⏱️ Creada: ${Fmt.date(t.fecha_creacion)}</div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-outline" style="flex:1;" onclick="verDetalleTarea(${t.id})">👁️ Ver Flujo</button>
        ${canManage ? `
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteTarea(${t.id})">🗑️</button>
        ` : ''}
      </div>
      ${needsAssignment ? `
        <div class="assignment-banner">
          🚨 PENDIENTE: Asignar ${nextCargo} para siguiente etapa
        </div>
      ` : ''}
    </div>`;
  }).join('');
}

function openAddTarea() {
  const selectCalzado = document.getElementById('tarea-catalogo-select');
  const catalog = DB.Catalogo.getAll();
  
  if (catalog.length === 0) {
    Toast.error('Primero debes agregar algún calzado al catálogo');
    Router.navigate('catalogo');
    return;
  }

  selectCalzado.innerHTML = catalog.map(p => `<option value="${p.id}">${p.nombre} (${p.referencia})</option>`).join('');
  
  // Filter employees showing only Cortadores at start
  const cortadores = DB.Usuarios.getEmpleadosPorCargo('Cortador');
  const selectEmp = document.getElementById('tarea-empleado-select');
  if (cortadores.length === 0) {
    selectEmp.innerHTML = `<option value="">(Sin Cortadores registrados)</option>`;
  } else {
    selectEmp.innerHTML = cortadores.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  }

  document.getElementById('tarea-form').reset();
  document.getElementById('tarea-id-edit').value = '';
  document.getElementById('tarea-modal-title').textContent = 'Nueva Tarea de Producción';
  
  actualizarCamposCalzadoTarea();
  
  // Set default due date: one week from now
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  document.getElementById('tarea-vencimiento').value = nextWeek.toISOString().split('T')[0];

  Modal.open('tarea-modal');
}

function renderTallasLoteBtns(availTallas, selectedTallas = []) {
  const container = document.getElementById('tarea-tallas-container');
  if (!container) return;
  container.innerHTML = availTallas.map(t => `
    <button type="button" class="talla-select-btn ${selectedTallas.includes(t) ? 'active' : ''}" data-talla="${t}" onclick="toggleTallaLote(this, ${t})">${t}</button>
  `).join('');
}

function toggleTallaLote(btn, talla) {
  btn.classList.toggle('active');
  actualizarTituloTarea();
}

function getSelectedTallasLote() {
  return Array.from(document.querySelectorAll('#tarea-tallas-container .talla-select-btn.active'))
    .map(b => parseInt(b.dataset.talla));
}

function actualizarTituloTarea() {
  const prodEl = document.getElementById('tarea-catalogo-select');
  const colorEl = document.getElementById('tarea-color');
  const paresEl = document.getElementById('tarea-pares');
  const descEl = document.getElementById('tarea-descripcion');
  if (!prodEl || !colorEl || !paresEl || !descEl) return;
  
  const prodId = parseInt(prodEl.value);
  const prod = DB.Catalogo.getById(prodId);
  if (!prod) return;

  const color = colorEl.value || '?';
  const pares = paresEl.value || '?';
  const ref = prod.referencia;

  descEl.value = `${prod.nombre.toUpperCase()} ${color.toUpperCase()} ${ref.toUpperCase()} - ${pares} PARES`;
}

function actualizarCamposCalzadoTarea() {
  const prodId = parseInt(document.getElementById('tarea-catalogo-select').value);
  const p = DB.Catalogo.getById(prodId);
  if (!p) return;

  const selectColor = document.getElementById('tarea-color');
  selectColor.innerHTML = p.colores.map(c => `<option value="${c}">${c}</option>`).join('');

  // Render tallas buttons for multi-select
  renderTallasLoteBtns(p.tallas, []);
  actualizarTituloTarea();
}

function saveTarea() {
  const id = document.getElementById('tarea-id-edit').value;
  const tallasSeleccionadas = getSelectedTallasLote();

  if (tallasSeleccionadas.length === 0) {
    Toast.error('Selecciona al menos una talla para el lote');
    return;
  }

  const data = {
    descripcion: document.getElementById('tarea-descripcion').value,
    usuario_id: document.getElementById('tarea-empleado-select').value,
    catalogo_id: document.getElementById('tarea-catalogo-select').value,
    tallas_lote: tallasSeleccionadas,
    talla: tallasSeleccionadas[0], // keep primary talla for compat
    color: document.getElementById('tarea-color').value,
    cantidad_pares: document.getElementById('tarea-pares').value,
    prioridad: document.getElementById('tarea-prioridad').value,
    fecha_vencimiento: document.getElementById('tarea-vencimiento').value,
    asignado_por: currentUser.id,
  };

  if (!data.descripcion || !data.usuario_id || !data.catalogo_id || !data.fecha_vencimiento) {
    Toast.error('Completa todos los campos requeridos');
    return;
  }

  const result = id ? DB.Tareas.update(parseInt(id), data) : DB.Tareas.create(data);
  if (result.error) { Toast.error(result.error); return; }

  // Notify the assigned employee
  if (!id && data.usuario_id) {
    const empleado = DB.Usuarios.getById(parseInt(data.usuario_id));
    const prod = DB.Catalogo.getById(parseInt(data.catalogo_id));
    DB.Notificaciones.create({
      para_usuario_id: parseInt(data.usuario_id),
      tipo: 'tarea_asignada',
      titulo: '✅ Nueva Tarea Asignada',
      mensaje: `Se te asignó la tarea: ${data.descripcion}. Producto: ${prod?.nombre || 'N/A'}. Tallas: ${tallasSeleccionadas.join(', ')}.`,
      tarea_id: result.tarea?.id,
    });
    updateNotifBadge();
  }

  Toast.success(id ? 'Tarea modificada' : 'Tarea iniciada en etapa de Corte 🏭');
  Modal.close('tarea-modal');
  renderTareas();
}

async function deleteTarea(id) {
  const ok = await Modal.confirm('¿Eliminar esta tarea de producción?', 'Eliminar Tarea');
  if (!ok) return;
  DB.Tareas.delete(id);
  Toast.success('Tarea eliminada');
  renderTareas();
}

function verDetalleTarea(id) {
  const t = DB.Tareas.getAll().find(x => x.id === id);
  if (!t) return;

  const userCanManage = ((currentUser.rol || '').toLowerCase() === 'administrador');
  const cargoFiltroMap = { corte: 'Cortador', guarnecido: 'Guarnecedor', soladura: 'Solador', emplantillador: 'Emplantillador', listo: 'Finalizado' };
  
  // Render timeline stepper
  const etapas = [
    { key: 'corte', label: 'Corte', cargo: 'Cortador' },
    { key: 'guarnecido', label: 'Guarnecido', cargo: 'Guarnecedor' },
    { key: 'soladura', label: 'Soladura', cargo: 'Solador' },
    { key: 'emplantillador', label: 'Emplantillado', cargo: 'Emplantillador' },
    { key: 'listo', label: 'Entrega', cargo: '' }
  ];

  const currentIdx = etapas.findIndex(e => e.key === t.etapa_actual);
  // Calculate pipeline width percent
  const percentMap = [0, 25, 50, 75, 100];
  const progressPercent = percentMap[currentIdx] !== undefined ? percentMap[currentIdx] : 0;

  const stepperHtml = etapas.map((et, i) => {
    let stateClass = 'step-inactive';
    if (i < currentIdx) stateClass = 'step-completed';
    else if (i === currentIdx) {
      if (t.estado === 'completada' && t.etapa_actual !== 'listo') {
        stateClass = 'step-completed'; // Completed worker part, waiting for supervisor to advance
      } else {
        stateClass = 'step-active';
      }
    }
    
    // Find history info
    const hist = t.historial_etapas.find(h => h.etapa === et.key);
    const workerName = hist ? (DB.Usuarios.getById(hist.usuario_id)?.nombre || 'Trabajador') : '';
    const dateLabel = hist ? Fmt.date(hist.fecha_inicio.split('T')[0]) : '';
    const iconStr = (i < currentIdx || (i === currentIdx && t.estado === 'completada')) ? '✓' : String(i + 1);

    return `
      <div class="pipeline-step ${stateClass}">
        <div class="step-circle">${iconStr}</div>
        <div class="step-label">${et.label}</div>
        ${workerName ? `<div class="step-employee">${workerName}</div>` : ''}
        ${dateLabel ? `<div class="step-date">${dateLabel}</div>` : ''}
      </div>
    `;
  }).join('');

  // Render detail details
  const prodName = t.producto ? `${t.producto.nombre} (${t.producto.referencia})` : 'Desconocido';
  const imgUrl = t.producto?.foto || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80';
  
  let actionPanelHtml = '';
  
  // Check if current user is the assignee of the current stage
  const isAssignee = t.usuario_id === currentUser.id;
  
  if (t.etapa_actual === 'listo') {
    actionPanelHtml = `
      <div style="background:rgba(6,214,160,0.1); border:1px solid rgba(6,214,160,0.3); border-radius:8px; padding:16px; margin-top:20px; text-align:center;">
        <span style="font-size:1.5rem;">🎉</span>
        <h4 style="font-weight:700; color:var(--success); margin:6px 0;">¡Producción Completada!</h4>
        <p style="font-size:0.85rem; color:var(--text-secondary);">El lote de calzado ya se encuentra en bodega listo para su entrega final.</p>
      </div>
    `;
  } else if (isAssignee && t.estado !== 'completada') {
    actionPanelHtml = `
      <div class="glass" style="padding:16px; margin-top:20px; text-align:center;">
        <h4 style="font-weight:600; margin-bottom:8px;">🛠️ Panel de Operario (${currentUser.cargo})</h4>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">Una vez termines de fabricar/procesar el lote en esta etapa, confírmalo abajo.</p>
        <button class="btn btn-success" style="width:100%;" onclick="finalizarEtapaEmpleado(${t.id})">✔️ Completar Mi Etapa</button>
      </div>
    `;
  } else if (t.estado === 'completada' && t.etapa_actual !== 'listo') {
    if (userCanManage) {
      const nextEtapa = etapas[currentIdx + 1];
      const empleadosCargo = DB.Usuarios.getEmpleadosPorCargo(nextEtapa.cargo);
      const optionsHtml = empleadosCargo.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
      
      actionPanelHtml = `
        <div class="glass" style="padding:16px; margin-top:20px; border-color:rgba(248,168,12,0.3);">
          <h4 style="font-weight:600; margin-bottom:8px; color:var(--secondary);">🎯 Control de Calidad / Entrega de Lote</h4>
          <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:12px;">La etapa de <strong>${etapas[currentIdx].label}</strong> ha sido completada. Asigna el lote al siguiente responsable de la etapa de <strong>${nextEtapa.label}</strong>.</p>
          
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:0.75rem;">Siguiente responsable (${nextEtapa.cargo}) *</label>
            <select class="form-control" id="next-responsable-select">${optionsHtml || `<option value="">(No hay empleados registrados como ${nextEtapa.cargo})</option>`}</select>
          </div>
          
          <button class="btn btn-primary" style="width:100%;" ${empleadosCargo.length === 0 ? 'disabled' : ''} onclick="avanzarEtapaTarea(${t.id})">🚀 Enviar a Etapa de ${nextEtapa.label}</button>
        </div>
      `;
    } else {
      actionPanelHtml = `
        <div class="glass" style="padding:16px; margin-top:20px; text-align:center;">
          <h4 style="font-weight:600; margin-bottom:6px; color:var(--warning);">⏳ En Espera de Control</h4>
          <p style="font-size:0.82rem; color:var(--text-muted);">Tu etapa está completada. El supervisor asignará el calzado al siguiente operario.</p>
        </div>
      `;
    }
  } else {
    // Other states: task assigned, but not logged in user
    actionPanelHtml = `
      <div class="glass" style="padding:14px; margin-top:20px; text-align:center; opacity:0.8;">
        <h4 style="font-weight:500; font-size:0.85rem;">📌 Estado de la Tarea</h4>
        <p style="font-size:0.8rem; color:var(--text-muted);">Lote asignado a <strong>${t.empleado?.nombre || 'operario'}</strong> (${cargoFiltroMap[t.etapa_actual] || 'N/A'}). En espera de finalización.</p>
      </div>
    `;
  }

  const detailBody = document.getElementById('tarea-detalle-body');
  detailBody.innerHTML = `
    <!-- Top Details -->
    <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
      <div style="width:80px; height:80px; border-radius:var(--radius-md); overflow:hidden; background:#11112b; flex-shrink:0;">
        <img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'" />
      </div>
      <div>
        <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:4px;">${prodName}</h4>
        <p style="font-size:0.82rem; color:var(--text-secondary);">${t.descripcion}</p>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
          Talla: <strong>${t.talla}</strong> · Color: <strong>${t.color}</strong> · Cantidad: <strong>${t.cantidad_pares} pares</strong>
        </div>
      </div>
    </div>

    <!-- Stepper Pipeline -->
    <div style="position:relative;">
      <div class="pipeline">
        <div class="pipeline-progress-line" style="width: ${progressPercent}%;"></div>
        ${stepperHtml}
      </div>
    </div>

    <!-- Timeline list -->
    <div class="glass" style="padding:16px; margin-top:16px;">
      <h4 style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Bitácora de Fechas y Cambios</h4>
      <div style="display:flex; flex-direction:column; gap:8px; font-size:0.8rem;">
        <div>📅 <strong>Fecha de Creación:</strong> ${Fmt.datetime(t.fecha_creacion + 'T00:00:00.000Z')}</div>
        ${t.historial_etapas.map(h => {
          const w = DB.Usuarios.getById(h.usuario_id);
          return `
            <div style="padding-left:12px; border-left:2px solid var(--primary);">
              🛠️ <strong>Etapa ${cargoFiltroMap[h.etapa]}:</strong> Asignado a ${w?.nombre || 'Trabajador'} el ${Fmt.datetime(h.fecha_inicio)}.
              ${h.fecha_fin ? `<br><span style="color:var(--success);">✓ Finalizó:</span> ${Fmt.datetime(h.fecha_fin)}` : '<br><span style="color:var(--warning);">⏳ En proceso...</span>'}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Action panel -->
    ${actionPanelHtml}

    <div class="modal-footer" style="margin-top:20px; padding-top:14px;">
      <button class="btn btn-outline" onclick="Modal.close('tarea-detalle-modal')">Cerrar</button>
    </div>
  `;
  Modal.open('tarea-detalle-modal');
}

function finalizarEtapaEmpleado(id) {
  const result = DB.Tareas.finalizarEtapaEmpleado(id);
  if (result.error) { Toast.error(result.error); return; }

  // Notify all admin/jefe users
  const tarea = result.tarea;
  const etapaCargoMap = { corte: 'Cortador', guarnecido: 'Guarnecedor', soladura: 'Solador', emplantillado: 'Emplantillador', listo: 'Finalizado' };
  const siguientesEtapas = ['corte', 'guarnecido', 'soladura', 'emplantillado', 'listo'];
  const cidx = siguientesEtapas.indexOf(tarea.etapa_actual);
  const nextStageLabel = cidx >= 0 && cidx < siguientesEtapas.length - 1 ? etapaCargoMap[siguientesEtapas[cidx + 1]] : 'Entrega Final';

  const managers = DB.Usuarios.getAll().filter(u => u.rol === 'administrador');
  managers.forEach(m => {
    DB.Notificaciones.create({
      para_usuario_id: m.id,
      tipo: 'tarea_completada',
      titulo: `🏻 Etapa Completada: ${etapaCargoMap[tarea.etapa_actual] || tarea.etapa_actual}`,
      mensaje: `${currentUser.nombre} completó su etapa en: "${tarea.descripcion}". Debes asignar al siguiente: ${nextStageLabel}.`,
      tarea_id: id,
    });
  });
  updateNotifBadge();

  Toast.success('¡Has completado tu etapa! Lote listo para validación del supervisor.');
  Modal.close('tarea-detalle-modal');
  renderTareas();
}

function avanzarEtapaTarea(id) {
  const select = document.getElementById('next-responsable-select');
  const proximoUsuarioId = select ? select.value : null;

  if (!proximoUsuarioId && document.getElementById('next-responsable-select')) {
    Toast.error('Debes seleccionar al operario responsable para la siguiente etapa');
    return;
  }

  const result = DB.Tareas.avanzarEtapa(id, proximoUsuarioId);
  if (result.error) { Toast.error(result.error); return; }

  // Notify the next worker if it's not 'listo'
  if (proximoUsuarioId && result.tarea?.etapa_actual !== 'listo') {
    const etapaCargoMap = { corte: 'Cortador', guarnecido: 'Guarnecedor', soladura: 'Solador', emplantillado: 'Emplantillador', listo: 'Finalizado' };
    const t = result.tarea;
    DB.Notificaciones.create({
      para_usuario_id: parseInt(proximoUsuarioId),
      tipo: 'tarea_asignada',
      titulo: `✅ Nueva Etapa Asignada: ${etapaCargoMap[t.etapa_actual] || t.etapa_actual}`,
      mensaje: `El supervisor te asignó la siguiente etapa de: "${t.descripcion}". Por favor revisa tus tareas.`,
      tarea_id: id,
    });
    updateNotifBadge();
  }

  Toast.success('El calzado ha sido enviado a la siguiente etapa de producción 🚀');
  Modal.close('tarea-detalle-modal');
  renderTareas();
}

/* ==============================
   USUARIOS MODULE
============================== */
let usuarioSearch = '';

function toggleCargoField() {
  const rol = (document.getElementById('usuario-rol').value || '').toLowerCase();
  const cargoGroup = document.getElementById('usuario-cargo-group');
  if (cargoGroup) {
    cargoGroup.style.display = (rol === 'empleado') ? '' : 'none';
  }
}

function renderUsuarios() {
  if (((currentUser.rol || '').toLowerCase() !== 'administrador')) {
    Router.navigate('dashboard');
    Toast.warning('Solo administradores pueden ver esta sección');
    return;
  }

  let usuarios = DB.Usuarios.getAll();
  if (usuarioSearch) {
    usuarios = usuarios.filter(u => u.nombre.toLowerCase().includes(usuarioSearch.toLowerCase()) || u.email.toLowerCase().includes(usuarioSearch.toLowerCase()));
  }

  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  if (usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👥</div><h3>Sin usuarios</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="avatar" style="background:${Fmt.avatarColor(u.id)};">${Fmt.initials(u.nombre)}</div>
          <div>
            <div style="font-weight:600;">${u.nombre}</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">${u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <div>${Fmt.rolBadge(u.rol)}</div>
        ${u.rol === 'empleado' ? `<span class="badge badge-info" style="font-size:0.68rem; margin-top:2px;">Cargo: ${u.cargo || 'General'}</span>` : ''}
      </td>
      <td>${u.telefono || '-'}</td>
      <td>${Fmt.date(u.creado_en)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm btn-outline" onclick="editUsuario(${u.id})">✏️</button>
          ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUsuario(${u.id})">🗑️</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('stat-total-usuarios').textContent = usuarios.length;
  document.getElementById('stat-admins').textContent = usuarios.filter(u => u.rol === 'administrador').length;
  document.getElementById('stat-jefes').textContent = usuarios.filter(u => u.rol === 'jefe').length;
  document.getElementById('stat-empleados-u').textContent = usuarios.filter(u => u.rol === 'empleado').length;
}

function openAddUsuario() {
  document.getElementById('usuario-form').reset();
  document.getElementById('usuario-id-edit').value = '';
  document.getElementById('usuario-modal-title').textContent = 'Nuevo Usuario';
  document.getElementById('usuario-password-group').style.display = '';
  document.getElementById('usuario-rol').value = 'empleado';
  toggleCargoField();
  Modal.open('usuario-modal');
}

function editUsuario(id) {
  const u = DB.Usuarios.getById(id);
  if (!u) return;
  document.getElementById('usuario-id-edit').value = id;
  document.getElementById('usuario-modal-title').textContent = 'Editar Usuario';
  document.getElementById('usuario-nombre').value = u.nombre;
  document.getElementById('usuario-email').value = u.email;
  document.getElementById('usuario-rol').value = u.rol;
  document.getElementById('usuario-cargo').value = u.cargo || 'Cortador';
  document.getElementById('usuario-telefono').value = u.telefono || '';
  document.getElementById('usuario-direccion').value = u.direccion || '';
  document.getElementById('usuario-password-group').style.display = 'none';
  toggleCargoField();
  Modal.open('usuario-modal');
}

function saveUsuario() {
  const id = document.getElementById('usuario-id-edit').value;
  const rolVal = document.getElementById('usuario-rol').value;
  const cargoVal = rolVal === 'empleado' ? document.getElementById('usuario-cargo').value : (rolVal === 'jefe' ? 'Dirección' : 'Administración');
  
  const data = {
    nombre: document.getElementById('usuario-nombre').value,
    email: document.getElementById('usuario-email').value,
    rol: rolVal,
    cargo: cargoVal,
    telefono: document.getElementById('usuario-telefono').value,
    direccion: document.getElementById('usuario-direccion').value,
  };
  if (!id) data.password = document.getElementById('usuario-password').value;

  if (!data.nombre || !data.email) {
    Toast.error('Nombre y correo son requeridos');
    return;
  }
  if (!Validate.email(data.email)) {
    Toast.error('Correo electrónico inválido');
    return;
  }
  if (!id && (!data.password || data.password.length < 6)) {
    Toast.error('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const result = id ? DB.Usuarios.update(parseInt(id), data) : DB.Usuarios.create(data);
  if (result.error) { Toast.error(result.error); return; }
  Toast.success(id ? 'Usuario actualizado' : 'Usuario creado correctamente');
  Modal.close('usuario-modal');
  renderUsuarios();
}

async function deleteUsuario(id) {
  if (id === currentUser.id) { Toast.warning('No puedes eliminarte a ti mismo'); return; }
  const ok = await Modal.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.', 'Eliminar Usuario');
  if (!ok) return;
  DB.Usuarios.delete(id);
  Toast.success('Usuario eliminado');
  renderUsuarios();
}

/* ==============================
   REPORTES MODULE
============================== */
function renderReportes() {
  const reportes = DB.Reportes.getAll().reverse();
  const tbody = document.getElementById('reportes-tbody');
  if (!tbody) return;

  if (reportes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📊</div><h3>Sin reportes generados</h3><p>Genera tu primer reporte usando los botones de arriba.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = reportes.map(r => {
    const tipoLabels = { nominas: '💰 Nóminas', inventario: '📦 Inventario', tareas: '✅ Tareas' };
    return `
    <tr>
      <td><strong>#${r.id}</strong></td>
      <td>${tipoLabels[r.tipo] || r.tipo}</td>
      <td>${r.generador?.nombre || 'Sistema'}</td>
      <td>${Fmt.datetime(r.fecha_generacion)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm btn-primary" onclick="verReporte(${r.id})">👁️ Ver</button>
          <button class="btn btn-sm btn-outline" onclick="exportarExcel(${r.id})">📄 Excel</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteReporte(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalGenerarReporte(tipo) {
  const labels = { nominas: 'Nóminas', inventario: 'Inventario', tareas: 'Tareas' };
  document.getElementById('generar-reporte-modal-title').textContent = `Generar Reporte de ${labels[tipo] || tipo}`;
  document.getElementById('gr-tipo').value = tipo;
  document.getElementById('gr-periodo-tipo').value = 'todo';
  actualizarCamposGenerarReporte();
  Modal.open('generar-reporte-periodo-modal');
}

function generarReporte(tipo) {
  abrirModalGenerarReporte(tipo);
}

function actualizarCamposGenerarReporte() {
  const tipo = document.getElementById('gr-periodo-tipo').value;
  const container = document.getElementById('gr-valor-container');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const thisYear = new Date().getFullYear();

  if (tipo === 'todo') {
    container.innerHTML = '';
  } else if (tipo === 'dia') {
    container.innerHTML = `
      <label class="form-label">Selecciona el Día *</label>
      <input type="date" class="form-control" id="gr-valor-dia" value="${todayStr}" required />
    `;
  } else if (tipo === 'semana') {
    const weekVal = `${thisYear}-W23`; // default week
    container.innerHTML = `
      <label class="form-label">Selecciona la Semana *</label>
      <input type="week" class="form-control" id="gr-valor-semana" value="${weekVal}" required />
    `;
  } else if (tipo === 'mes') {
    const monthVal = todayStr.substring(0, 7); // YYYY-MM
    container.innerHTML = `
      <label class="form-label">Selecciona el Mes *</label>
      <input type="month" class="form-control" id="gr-valor-mes" value="${monthVal}" required />
    `;
  } else if (tipo === 'año') {
    container.innerHTML = `
      <label class="form-label">Escribe el Año *</label>
      <input type="number" class="form-control" id="gr-valor-año" min="2020" max="2100" value="${thisYear}" required />
    `;
  }
}

function procesarGeneracionReporte() {
  const tipo = document.getElementById('gr-tipo').value;
  const periodo = document.getElementById('gr-periodo-tipo').value;
  const todayVal = new Date().toISOString().split('T')[0];

  let contenido = {};
  let labelPeriodo = 'Historial Completo';

  const getWeekNumber = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const tempDate = new Date(d.valueOf());
    tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
    const yearStart = new Date(tempDate.getFullYear(), 0, 1);
    return {
      week: Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
      year: tempDate.getFullYear()
    };
  };

  if (tipo === 'nominas') {
    let nominas = DB.Nominas.getAll();
    if (periodo === 'dia') {
      const val = document.getElementById('gr-valor-dia').value;
      if (!val) return;
      nominas = nominas.filter(n => n.fecha === val);
      labelPeriodo = `Diario - ${val}`;
    } else if (periodo === 'semana') {
      const val = document.getElementById('gr-valor-semana').value;
      if (!val) return;
      const [year, week] = val.split('-W');
      nominas = nominas.filter(n => n.año === parseInt(year) && n.semana === parseInt(week));
      labelPeriodo = `Semanal - Semana ${week}, Año ${year}`;
    } else if (periodo === 'mes') {
      const val = document.getElementById('gr-valor-mes').value;
      if (!val) return;
      const [year, month] = val.split('-');
      nominas = nominas.filter(n => {
        const d = new Date(n.fecha + 'T00:00:00');
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
      });
      labelPeriodo = `Mensual - Mes ${month}, Año ${year}`;
    } else if (periodo === 'año') {
      const val = parseInt(document.getElementById('gr-valor-año').value);
      if (!val) return;
      nominas = nominas.filter(n => n.año === val || new Date(n.fecha + 'T00:00:00').getFullYear() === val);
      labelPeriodo = `Anual - Año ${val}`;
    }

    const total = nominas.reduce((s, n) => s + n.neto, 0);
    contenido = {
      resumen: { total_nominas: nominas.length, total_pago: total, pagadas: nominas.filter(n => n.estado === 'pagada').length, pendientes: nominas.filter(n => n.estado === 'pendiente').length },
      detalle: nominas.map(n => ({ empleado: n.usuario?.nombre, salario: n.salario, deducciones: n.deducciones, bonificaciones: n.bonificaciones, neto: n.neto, estado: n.estado, fecha: n.fecha })),
      generado_el: todayVal,
      periodo: labelPeriodo
    };
  } else if (tipo === 'inventario') {
    const items = DB.Inventario.getAll();
    const stats = DB.Inventario.getStats();
    
    if (periodo === 'dia') {
      const val = document.getElementById('gr-valor-dia').value;
      labelPeriodo = `Diario - ${val}`;
    } else if (periodo === 'semana') {
      const val = document.getElementById('gr-valor-semana').value;
      const [year, week] = val.split('-W');
      labelPeriodo = `Semanal - Semana ${week}, Año ${year}`;
    } else if (periodo === 'mes') {
      const val = document.getElementById('gr-valor-mes').value;
      const [year, month] = val.split('-');
      labelPeriodo = `Mensual - Mes ${month}, Año ${year}`;
    } else if (periodo === 'año') {
      const val = document.getElementById('gr-valor-año').value;
      labelPeriodo = `Anual - Año ${val}`;
    }

    contenido = {
      resumen: stats,
      stock_bajo: DB.Inventario.getLowStock().map(p => ({ nombre: p.nombre, cantidad: p.cantidad, minimo: p.stock_minimo })),
      detalle: items,
      generado_el: todayVal,
      periodo: labelPeriodo
    };
  } else if (tipo === 'tareas') {
    let tareas = DB.Tareas.getAll();
    
    if (periodo === 'dia') {
      const val = document.getElementById('gr-valor-dia').value;
      if (!val) return;
      tareas = tareas.filter(t => t.fecha_creacion === val);
      labelPeriodo = `Diario - ${val}`;
    } else if (periodo === 'semana') {
      const val = document.getElementById('gr-valor-semana').value;
      if (!val) return;
      const [year, week] = val.split('-W');
      tareas = tareas.filter(t => {
        const wk = getWeekNumber(t.fecha_creacion);
        return wk.year === parseInt(year) && wk.week === parseInt(week);
      });
      labelPeriodo = `Semanal - Semana ${week}, Año ${year}`;
    } else if (periodo === 'mes') {
      const val = document.getElementById('gr-valor-mes').value;
      if (!val) return;
      const [year, month] = val.split('-');
      tareas = tareas.filter(t => {
        const d = new Date(t.fecha_creacion + 'T00:00:00');
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
      });
      labelPeriodo = `Mensual - Mes ${month}, Año ${year}`;
    } else if (periodo === 'año') {
      const val = parseInt(document.getElementById('gr-valor-año').value);
      if (!val) return;
      tareas = tareas.filter(t => new Date(t.fecha_creacion + 'T00:00:00').getFullYear() === val);
      labelPeriodo = `Anual - Año ${val}`;
    }

    const completed = tareas.filter(t => t.estado === 'completada').length;
    const pending = tareas.filter(t => t.estado === 'pendiente').length;
    const inProgress = tareas.filter(t => t.estado === 'en_progreso').length;
    const overdue = tareas.filter(t => t.estado !== 'completada' && t.fecha_vencimiento < todayVal).length;

    contenido = {
      resumen: { total: tareas.length, completadas: completed, pendientes: pending, en_progreso: inProgress, vencidas: overdue },
      detalle: tareas.map(t => ({ descripcion: t.descripcion, empleado: t.empleado?.nombre, estado: t.estado, prioridad: t.prioridad, vencimiento: t.fecha_vencimiento })),
      generado_el: todayVal,
      periodo: labelPeriodo
    };
  }

  const result = DB.Reportes.create(tipo, contenido, currentUser.id);
  if (result.ok) {
    Toast.success(`Reporte generado exitosamente (${labelPeriodo})`);
    Modal.close('generar-reporte-periodo-modal');
    renderReportes();
    verReporte(result.reporte.id);
  }
}

function verReporte(id) {
  const reportes = DB.Reportes.getAll();
  const r = reportes.find(x => x.id === id);
  if (!r) return;

  const tipoLabels = { nominas: '💰 Nóminas', inventario: '📦 Inventario', tareas: '✅ Tareas' };
  let contenidoHtml = '';

  if (r.tipo === 'nominas') {
    const res = r.contenido.resumen;
    contenidoHtml = `
      <div class="grid-2" style="margin-bottom:20px;">
        <div class="glass" style="padding:16px; text-align:center;"><div style="font-size:0.75rem; color:var(--text-muted);">TOTAL NÓMINAS</div><div style="font-size:1.4rem; font-weight:800; color:var(--accent);">${res.total_nominas}</div></div>
        <div class="glass" style="padding:16px; text-align:center;"><div style="font-size:0.75rem; color:var(--text-muted);">PAGO TOTAL</div><div style="font-size:1.1rem; font-weight:800; color:var(--success);">${Fmt.currency(res.total_pago)}</div></div>
      </div>
      <table class="data-table"><thead><tr><th>Empleado</th><th>Salario</th><th>Deducciones</th><th>Bonos</th><th>Neto</th><th>Estado</th></tr></thead>
      <tbody>${(r.contenido.detalle || []).map(d => `<tr><td>${d.empleado || 'N/A'}</td><td>${Fmt.currency(d.salario)}</td><td>${Fmt.currency(d.deducciones)}</td><td>${Fmt.currency(d.bonificaciones)}</td><td><strong>${Fmt.currency(d.neto)}</strong></td><td>${Fmt.estadoNomina(d.estado)}</td></tr>`).join('')}</tbody></table>`;
  } else if (r.tipo === 'inventario') {
    contenidoHtml = `
      <div class="grid-2" style="margin-bottom:20px;">
        <div class="glass" style="padding:16px; text-align:center;"><div style="font-size:0.75rem; color:var(--text-muted);">PRODUCTOS</div><div style="font-size:1.4rem; font-weight:800;">${r.contenido.resumen.totalProductos}</div></div>
        <div class="glass" style="padding:16px; text-align:center;"><div style="font-size:0.75rem; color:var(--text-muted);">VALOR TOTAL</div><div style="font-size:1.1rem; font-weight:800; color:var(--success);">${Fmt.currency(r.contenido.resumen.valorTotal)}</div></div>
      </div>
      ${r.contenido.stock_bajo.length > 0 ? `<div style="background:rgba(239,35,60,0.1); border:1px solid rgba(239,35,60,0.3); border-radius:8px; padding:12px; margin-bottom:16px;"><strong>⚠️ Stock Bajo:</strong> ${r.contenido.stock_bajo.map(p => p.nombre).join(', ')}</div>` : ''}
      <table class="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio</th></tr></thead>
      <tbody>${(r.contenido.detalle || []).map(d => `<tr><td>${d.nombre}</td><td>${d.categoria}</td><td>${d.cantidad} ${d.unidad}</td><td>${Fmt.currency(d.precio_unitario)}</td></tr>`).join('')}</tbody></table>`;
  } else if (r.tipo === 'tareas') {
    const res = r.contenido.resumen;
    contenidoHtml = `
      <div class="grid-4" style="margin-bottom:20px;">
        <div class="glass" style="padding:12px; text-align:center;"><div style="font-size:0.72rem; color:var(--text-muted);">TOTAL</div><div style="font-size:1.3rem; font-weight:800;">${res.total}</div></div>
        <div class="glass" style="padding:12px; text-align:center;"><div style="font-size:0.72rem; color:var(--success);">COMPLETADAS</div><div style="font-size:1.3rem; font-weight:800; color:var(--success);">${res.completadas}</div></div>
        <div class="glass" style="padding:12px; text-align:center;"><div style="font-size:0.72rem; color:var(--warning);">PENDIENTES</div><div style="font-size:1.3rem; font-weight:800; color:var(--warning);">${res.pendientes}</div></div>
        <div class="glass" style="padding:12px; text-align:center;"><div style="font-size:0.72rem; color:var(--danger);">VENCIDAS</div><div style="font-size:1.3rem; font-weight:800; color:var(--danger);">${res.vencidas}</div></div>
      </div>
      <table class="data-table"><thead><tr><th>Tarea</th><th>Asignado</th><th>Prioridad</th><th>Estado</th></tr></thead>
      <tbody>${(r.contenido.detalle || []).map(d => `<tr><td>${d.descripcion}</td><td>${d.empleado || 'N/A'}</td><td>${Fmt.prioridadBadge(d.prioridad)}</td><td>${Fmt.estadoTarea(d.estado)}</td></tr>`).join('')}</tbody></table>`;
  }

  const periodLabel = r.contenido.periodo ? ` (${r.contenido.periodo})` : '';
  document.getElementById('reporte-modal-title').textContent = `${tipoLabels[r.tipo] || 'Reporte'} - ${Fmt.date(r.fecha_generacion.split('T')[0])}${periodLabel}`;
  document.getElementById('reporte-preview-content').innerHTML = contenidoHtml;
  document.getElementById('reporte-modal-download-btn').onclick = () => exportarExcel(id);
  Modal.open('reporte-preview-modal');
}

function exportarPDF(id) {
  const reportes = DB.Reportes.getAll();
  const r = reportes.find(x => x.id === id);
  if (!r) return;
  
  const tipoLabels = { nominas: 'Nominas', inventario: 'Inventario', tareas: 'Tareas' };
  const periodStr = r.contenido.periodo ? `Período: ${r.contenido.periodo}` : 'Período: Todo el Historial';
  let csvLines = [`ROSALOPZManager - Reporte de ${tipoLabels[r.tipo] || r.tipo}`,
    `Generado: ${new Date(r.fecha_generacion).toLocaleString('es-CO')}`,
    `${periodStr}`,
    ``];

  if (r.tipo === 'nominas') {
    csvLines.push('Empleado,Salario,Deducciones,Bonificaciones,Neto,Estado,Fecha');
    (r.contenido.detalle || []).forEach(d => {
      csvLines.push(`"${d.empleado || 'N/A'}",${d.salario},${d.deducciones},${d.bonificaciones},${d.neto},${d.estado},${d.fecha}`);
    });
    csvLines.push(``);
    csvLines.push(`Total Pago Neto,${r.contenido.resumen?.total_pago || 0}`);
  } else if (r.tipo === 'inventario') {
    csvLines.push('Producto,Categoria,Cantidad,Unidad,Precio Unitario');
    (r.contenido.detalle || []).forEach(d => {
      csvLines.push(`"${d.nombre}","${d.categoria}",${d.cantidad},"${d.unidad}",${d.precio_unitario}`);
    });
  } else if (r.tipo === 'tareas') {
    csvLines.push('Tarea,Empleado,Prioridad,Estado,Vencimiento');
    (r.contenido.detalle || []).forEach(d => {
      csvLines.push(`"${d.descripcion}","${d.empleado || 'N/A'}",${d.prioridad},${d.estado},${d.vencimiento}`);
    });
    csvLines.push(``);
    csvLines.push(`Total,${r.contenido.resumen?.total || 0}`);
    csvLines.push(`Completadas,${r.contenido.resumen?.completadas || 0}`);
  }

  const csvContent = csvLines.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${r.tipo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  Toast.success('📄 Reporte descargado como CSV');
}

/* ==============================================================
   DESCARGAS NOMINAS POR EMPLEADO
============================================================== */
function abrirModalDescargaNomina(usuario_id) {
  const usuario = DB.Usuarios.getById(usuario_id);
  if (!usuario) {
    Toast.error('Empleado no encontrado');
    return;
  }
  document.getElementById('dn-usuario-id').value = usuario_id;
  document.getElementById('dn-empleado-nombre').value = usuario.nombre;
  document.getElementById('dn-periodo-tipo').value = 'todo';
  actualizarCamposDescargaNomina();
  Modal.open('descargar-nominas-modal');
}

function actualizarCamposDescargaNomina() {
  const tipo = document.getElementById('dn-periodo-tipo').value;
  const container = document.getElementById('dn-valor-container');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const thisYear = new Date().getFullYear();

  if (tipo === 'todo') {
    container.innerHTML = '';
  } else if (tipo === 'dia') {
    container.innerHTML = `
      <label class="form-label">Selecciona el Día *</label>
      <input type="date" class="form-control" id="dn-valor-dia" value="${todayStr}" required />
    `;
  } else if (tipo === 'semana') {
    // Current week format YYYY-Www
    const weekVal = `${thisYear}-W23`; // Fallback/default week
    container.innerHTML = `
      <label class="form-label">Selecciona la Semana *</label>
      <input type="week" class="form-control" id="dn-valor-semana" value="${weekVal}" required />
    `;
  } else if (tipo === 'mes') {
    const monthVal = todayStr.substring(0, 7); // YYYY-MM
    container.innerHTML = `
      <label class="form-label">Selecciona el Mes *</label>
      <input type="month" class="form-control" id="dn-valor-mes" value="${monthVal}" required />
    `;
  } else if (tipo === 'año') {
    container.innerHTML = `
      <label class="form-label">Escribe el Año *</label>
      <input type="number" class="form-control" id="dn-valor-año" min="2020" max="2100" value="${thisYear}" required />
    `;
  }
}

function procesarDescargaNominaEmpleado() {
  const usuario_id = parseInt(document.getElementById('dn-usuario-id').value);
  const tipo = document.getElementById('dn-periodo-tipo').value;
  const usuario = DB.Usuarios.getById(usuario_id);
  if (!usuario) return;

  let nominas = DB.Nominas.getAll().filter(n => n.usuario_id === usuario_id);

  let labelFiltro = 'Historial_Completo';

  if (tipo === 'dia') {
    const dia = document.getElementById('dn-valor-dia').value;
    if (!dia) { Toast.error('Selecciona un día válido'); return; }
    nominas = nominas.filter(n => n.fecha === dia);
    labelFiltro = `Dia_${dia}`;
  } else if (tipo === 'semana') {
    const semanaRaw = document.getElementById('dn-valor-semana').value; // e.g. "2026-W23"
    if (!semanaRaw) { Toast.error('Selecciona una semana válida'); return; }
    const [year, week] = semanaRaw.split('-W');
    nominas = nominas.filter(n => n.año === parseInt(year) && n.semana === parseInt(week));
    labelFiltro = `Semana_${year}_W${week}`;
  } else if (tipo === 'mes') {
    const mesRaw = document.getElementById('dn-valor-mes').value; // e.g. "2026-06"
    if (!mesRaw) { Toast.error('Selecciona un mes válido'); return; }
    const [year, month] = mesRaw.split('-');
    nominas = nominas.filter(n => {
      const d = new Date(n.fecha + 'T00:00:00');
      return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
    });
    labelFiltro = `Mes_${year}_${month}`;
  } else if (tipo === 'año') {
    const año = parseInt(document.getElementById('dn-valor-año').value);
    if (!año) { Toast.error('Digita un año válido'); return; }
    nominas = nominas.filter(n => n.año === año || new Date(n.fecha + 'T00:00:00').getFullYear() === año);
    labelFiltro = `Año_${año}`;
  }

  if (nominas.length === 0) {
    Toast.warning('No hay nóminas para descargar de este empleado en el período seleccionado.');
    return;
  }

  const nombreEmpleado = usuario.nombre;
  const csvLines = [
    `ROSALOPZManager - Nóminas de ${nombreEmpleado} (${labelFiltro.replace(/_/g, ' ')})`,
    `Descargado: ${new Date().toLocaleString('es-CO')}`,
    ``,
    'Fecha,Semana,A\u00f1o,Salario Base,Deducciones,Bonificaciones,Neto,Estado'
  ];

  nominas.forEach(n => {
    csvLines.push(`${n.fecha},${n.semana},${n.año},${n.salario},${n.deducciones},${n.bonificaciones},${n.neto},${n.estado}`);
  });

  csvLines.push(``);
  const totalNeto = nominas.reduce((s, n) => s + n.neto, 0);
  csvLines.push(`TOTAL NETO,,,,,,${totalNeto},`);

  const csvContent = csvLines.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nominas_${nombreEmpleado.replace(/\s+/g, '_')}_${labelFiltro}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  Modal.close('descargar-nominas-modal');
  Toast.success(`📥 Nóminas de ${nombreEmpleado} descargadas`);
}

async function deleteReporte(id) {
  const ok = await Modal.confirm('¿Eliminar este reporte?', 'Eliminar Reporte');
  if (!ok) return;
  DB.Reportes.delete(id);
  Toast.success('Reporte eliminado');
  renderReportes();
}

/* ==============================
   PERFIL MODULE
============================== */
function renderPerfil() {
  if (!currentUser) return;
  const user = DB.Usuarios.getById(currentUser.id);
  if (!user) return;

  const perfilAvatar = document.getElementById('perfil-avatar');
  const perfilNombre = document.getElementById('perfil-nombre-display');
  const perfilRol = document.getElementById('perfil-rol-display');

  if (perfilAvatar) {
    perfilAvatar.textContent = Fmt.initials(user.nombre);
    perfilAvatar.style.background = Fmt.avatarColor(user.id);
  }
  if (perfilNombre) perfilNombre.textContent = user.nombre;
  if (perfilRol) {
    const cargoStr = user.cargo ? ` · Cargo: ${user.cargo}` : '';
    perfilRol.innerHTML = Fmt.rolBadge(user.rol) + `<span style="margin-left:8px; font-size:0.85rem; color:var(--text-muted);">${cargoStr}</span>`;
  }

  document.getElementById('perfil-nombre').value = user.nombre;
  document.getElementById('perfil-email').value = user.email;
  document.getElementById('perfil-telefono').value = user.telefono || '';
  document.getElementById('perfil-direccion').value = user.direccion || '';

  // Stats
  const misNominas = DB.Nominas.getByUsuario(user.id);
  const misTareas = DB.Tareas.getByUsuario(user.id);

  document.getElementById('perfil-stat-nominas').textContent = misNominas.length;
  document.getElementById('perfil-stat-ultimo-pago').textContent = misNominas.length > 0 ? Fmt.currency(misNominas[misNominas.length - 1].neto) : '-';
  document.getElementById('perfil-stat-tareas').textContent = misTareas.length;
  document.getElementById('perfil-stat-completadas').textContent = misTareas.filter(t => t.estado === 'completada').length;

  // Render task history
  renderPerfilHistorialTareas(misTareas);
}

function savePerfil() {
  const data = {
    nombre: document.getElementById('perfil-nombre').value,
    telefono: document.getElementById('perfil-telefono').value,
    direccion: document.getElementById('perfil-direccion').value,
  };
  if (!data.nombre) { Toast.error('El nombre es requerido'); return; }
  const result = DB.Usuarios.update(currentUser.id, data);
  if (result.error) { Toast.error(result.error); return; }
  currentUser = { ...currentUser, ...data };
  DB.Session.set(currentUser);
  setupHeader();
  setupSidebar();
  Toast.success('Perfil actualizado correctamente');
}

function cambiarPassword() {
  const actual = document.getElementById('pwd-actual').value;
  const nueva = document.getElementById('pwd-nueva').value;
  const confirmar = document.getElementById('pwd-confirmar').value;

  if (!actual || !nueva || !confirmar) { Toast.error('Completa todos los campos'); return; }
  const user = DB.Usuarios.getById(currentUser.id);
  if (user.password !== btoa(actual)) { Toast.error('Contraseña actual incorrecta'); return; }
  if (nueva.length < 6) { Toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return; }
  if (nueva !== confirmar) { Toast.error('Las contraseñas no coinciden'); return; }

  DB.Usuarios.update(currentUser.id, { password: btoa(nueva) });
  document.getElementById('perfil-pwd-form').reset();
  Toast.success('Contraseña cambiada correctamente');
}

function renderPerfilHistorialTareas(tareas) {
  const container = document.getElementById('perfil-historial-tareas');
  const panel = document.getElementById('perfil-historial-tareas-panel');
  if (!container) return;

  // Show only for employees
  if (((currentUser.rol || '').toLowerCase() !== 'empleado')) {
    if (panel) panel.style.display = 'none';
    return;
  }
  if (panel) panel.style.display = '';

  // Get ALL tasks (not just current assignments)
  const todasMisTareas = DB.Tareas.getAll().filter(t => 
    t.historial_etapas.some(h => h.usuario_id === currentUser.id)
  );

  if (todasMisTareas.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; padding:12px 0;">No tienes tareas registradas aún.</div>';
    return;
  }

  const etapaCargoMap = { corte: 'Corte', guarnecido: 'Guarnecido', soladura: 'Soladura', emplantillado: 'Emplantillado', listo: 'Finalizado' };

  container.innerHTML = todasMisTareas.map(t => {
    const miEtapa = t.historial_etapas.find(h => h.usuario_id === currentUser.id);
    const tallasStr = Array.isArray(t.tallas_lote) && t.tallas_lote.length > 0 ? t.tallas_lote.join(', ') : (t.talla || 'N/A');
    const prod = t.producto;
    const estadoColor = t.estado === 'completada' ? 'var(--success)' : t.estado === 'en_progreso' ? 'var(--accent)' : 'var(--warning)';

    return `
      <div class="glass" style="padding:14px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div style="font-weight:600; font-size:0.9rem;">${t.descripcion}</div>
          ${Fmt.estadoTarea(t.estado)}
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted); display:flex; flex-direction:column; gap:3px;">
          <div>💟 Producto: <strong>${prod?.nombre || 'N/A'}</strong> — Tallas: ${tallasStr} — Color: ${t.color} — ${t.cantidad_pares} pares</div>
          <div>🛠️ Mi Etapa: <strong>${etapaCargoMap[miEtapa?.etapa] || miEtapa?.etapa || '?'}</strong></div>
          <div>📅 Inicio: ${Fmt.date(miEtapa?.fecha_inicio?.split('T')[0])} ${miEtapa?.fecha_fin ? `— Fin: ${Fmt.date(miEtapa.fecha_fin.split('T')[0])}` : '<span style="color:var(--warning);">(⏳ En proceso)</span>'}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ==============================
   NOTIFICATIONS UI
============================== */
function updateNotifBadge() {
  if (!currentUser) return;
  const count = DB.Notificaciones.getUnreadCount(currentUser.id);
  const badge = document.getElementById('notif-count-badge');
  if (!badge) return;
  if (count > 0) {
    badge.style.display = 'flex';
    badge.textContent = count > 9 ? '9+' : count;
  } else {
    badge.style.display = 'none';
  }
}

let notifPanelOpen = false;
function toggleNotifPanel() {
  const panel = document.getElementById('notif-dropdown');
  if (!panel) return;
  notifPanelOpen = !notifPanelOpen;
  panel.style.display = notifPanelOpen ? 'block' : 'none';
  if (notifPanelOpen) renderNotifList();
}

function exportarExcel(id) {
  const reportes = DB.Reportes.getAll();
  const r = reportes.find(x => x.id === id);
  if (!r) return;

  const title = `ROSALOPZManager - Reporte`;
  const generated = new Date(r.fecha_generacion).toLocaleString('es-CO');

  // Build HTML table with inline styles suitable for Excel (xls/html)
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#222}
    .header{display:flex;align-items:center;gap:12px}
    .logo{width:84px}
    table{border-collapse:collapse;width:100%;margin-top:12px}
    th,td{border:1px solid #ddd;padding:8px}
    th{background:#4361ee;color:#fff}
    .muted{color:#666;font-size:12px}
  </style></head><body>`;

  html += `<div class="header"><img class="logo" src="assets/img/logo-light.png"/><div><h2>${title}</h2><div class="muted">Generado: ${generated}</div><div class="muted">${r.contenido.periodo || ''}</div></div></div>`;

  if (r.tipo === 'nominas') {
    html += `<h3>Resumen Nóminas</h3>`;
    html += `<table><thead><tr><th>Empleado</th><th>Salario</th><th>Deducciones</th><th>Bonos</th><th>Neto</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>`;
    (r.contenido.detalle || []).forEach(d => {
      html += `<tr><td>${d.empleado || ''}</td><td>${d.salario}</td><td>${d.deducciones}</td><td>${d.bonificaciones}</td><td>${d.neto}</td><td>${d.estado}</td><td>${d.fecha}</td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<p class="muted">Total Pago Neto: ${r.contenido.resumen?.total_pago || 0}</p>`;
  } else if (r.tipo === 'inventario') {
    html += `<h3>Inventario</h3>`;
    html += `<table><thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th><th>Precio Unitario</th></tr></thead><tbody>`;
    (r.contenido.detalle || []).forEach(d => {
      html += `<tr><td>${d.nombre}</td><td>${d.categoria}</td><td>${d.cantidad}</td><td>${d.unidad}</td><td>${d.precio_unitario}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else if (r.tipo === 'tareas') {
    html += `<h3>Tareas</h3>`;
    html += `<table><thead><tr><th>Tarea</th><th>Empleado</th><th>Prioridad</th><th>Estado</th><th>Vencimiento</th></tr></thead><tbody>`;
    (r.contenido.detalle || []).forEach(d => {
      html += `<tr><td>${d.descripcion}</td><td>${d.empleado || ''}</td><td>${d.prioridad}</td><td>${d.estado}</td><td>${d.vencimiento}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  html += `</body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${r.tipo}_${new Date().toISOString().split('T')[0]}.xls`;
  a.click();
}

function borrarTodasNotif() {
  if (!currentUser) return;
  DB.Notificaciones.deleteAll(currentUser.id);
  updateNotifBadge();
  renderNotifList();
  Toast.info('Notificaciones borradas');
}

/* ==============================
   INIT / EVENT LISTENERS
============================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Init theme
  initTheme();

  // Init DB
  await DB.init();

  // Check auth
  checkAuth();

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const result = DB.Usuarios.login(email, password);
    if (result.error) { Toast.error(result.error); return; }
    currentUser = result.user;
    DB.Session.set(currentUser);
    Toast.success(`¡Bienvenido, ${currentUser.nombre.split(' ')[0]}! 👋`);
    showApp();
  });

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      nombre: document.getElementById('reg-nombre').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
      rol: document.querySelector('.role-option.selected')?.dataset.rol || 'empleado',
      cargo: document.querySelector('.role-option.selected')?.dataset.rol === 'empleado' ? 'Cortador' : 'Dirección',
    };
    if (!Validate.email(data.email)) { Toast.error('Correo inválido'); return; }
    if (data.password.length < 6) { Toast.error('La contraseña debe tener mínimo 6 caracteres'); return; }
    const result = DB.Usuarios.create(data);
    if (result.error) { Toast.error(result.error); return; }
    Toast.success('¡Cuenta creada! Inicia sesión ahora.');
    switchAuthTab('login');
    document.getElementById('login-email').value = data.email;
  });

  // Role selector
  document.querySelectorAll('.role-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Password strength
  document.getElementById('reg-password')?.addEventListener('input', (e) => {
    const score = Validate.password(e.target.value);
    const segs = document.querySelectorAll('.strength-seg');
    const label = document.getElementById('strength-label');
    segs.forEach((s, i) => {
      s.className = 'strength-seg';
      if (i < score) {
        s.classList.add(score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong');
      }
    });
    const labels = ['', 'Débil', 'Regular', 'Buena', 'Excelente'];
    if (label) label.textContent = labels[score] || '';
  });

  // Toggle passwords
  document.querySelectorAll('.toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁️' : '🙈';
      }
    });
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) Router.navigate(page);
    });
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    DB.Session.clear();
    currentUser = null;
    showAuth('login');
    Toast.info('Sesión cerrada');
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    sidebar?.classList.toggle('collapsed');
    main?.classList.toggle('expanded');
  });

  // Mobile hamburger
  document.getElementById('header-hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.toggle('visible');
  });

  // Overlay close
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
  });

  // Modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.closeAll();
    });
  });

  // Photo base64 file reader in Catalog Modal
  document.getElementById('cat-foto-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        document.getElementById('cat-foto-url').value = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Catalog Filters
  document.getElementById('catalogo-search')?.addEventListener('input', (e) => {
    catalogoSearch = e.target.value;
    renderCatalogo();
  });
  document.getElementById('catalogo-filtro-talla')?.addEventListener('change', (e) => {
    catalogoFiltroTalla = e.target.value;
    renderCatalogo();
  });
  document.getElementById('catalogo-filtro-color')?.addEventListener('change', (e) => {
    catalogoFiltroColor = e.target.value;
    renderCatalogo();
  });

  // Nomina search & filters
  document.getElementById('nomina-search')?.addEventListener('input', (e) => {
    nominaSearch = e.target.value;
    renderNominas();
  });

  // Nomina medio change -> show file input when digital
  const medioEl = document.getElementById('nomina-medio');
  if (medioEl) {
    medioEl.addEventListener('change', (e) => {
      const v = e.target.value;
      const grp = document.getElementById('nomina-comprobante-group');
      if (grp) grp.style.display = (v && v !== 'efectivo') ? 'block' : 'none';
    });
  }

  // Nomina comprobante preview
  const compFile = document.getElementById('nomina-comprobante-file');
  if (compFile) {
    compFile.addEventListener('change', (e) => {
      const f = e.target.files[0];
      const img = document.getElementById('nomina-comp-preview');
      if (!f) { if (img) { img.src = ''; img.style.display = 'none'; } return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (img) { img.src = ev.target.result; img.style.display = 'block'; }
      };
      reader.readAsDataURL(f);
    });
  }
  document.getElementById('nomina-filtro-estado')?.addEventListener('change', (e) => {
    nominaFiltroEstado = e.target.value;
    renderNominas();
  });
  document.getElementById('nomina-filtro-periodo')?.addEventListener('change', actualizarFiltrosPeriodo);

  // Inventario search
  document.getElementById('inv-search')?.addEventListener('input', (e) => {
    invSearch = e.target.value;
    renderInventario();
  });
  document.getElementById('inv-filtro-categoria')?.addEventListener('change', (e) => {
    invCategoria = e.target.value;
    renderInventario();
  });

  // Tareas search & filters
  document.getElementById('tarea-search')?.addEventListener('input', (e) => {
    tareaSearch = e.target.value;
    renderTareas();
  });
  document.getElementById('tarea-filtro-estado')?.addEventListener('change', (e) => {
    tareaFiltroEstado = e.target.value;
    renderTareas();
  });
  document.getElementById('tarea-filtro-prioridad')?.addEventListener('change', (e) => {
    tareaFiltroPrioridad = e.target.value;
    renderTareas();
  });
  document.getElementById('tarea-filtro-ambito')?.addEventListener('change', (e) => {
    renderTareas();
  });

  // Close notif panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notif-dropdown');
    const btn = document.getElementById('btn-notif');
    if (panel && notifPanelOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.style.display = 'none';
      notifPanelOpen = false;
    }
  });

  // Usuarios search
  document.getElementById('usuario-search')?.addEventListener('input', (e) => {
    usuarioSearch = e.target.value;
    renderUsuarios();
  });
});
