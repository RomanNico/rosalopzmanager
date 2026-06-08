// js/api.js
// Simple API client for ROSALOPZManager backend
(function(){
  const base = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : 'http://localhost:4000/api';

  async function request(path, options = {}){
    const url = base + path;
    const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status} ${res.statusText}: ${txt}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
  }

  const API = {
    health: () => request('/health'),
    // Usuarios
    getUsuarios: () => request('/usuarios'),
    createUsuario: (u) => request('/usuarios', { method: 'POST', body: JSON.stringify(u) }),
    // Inventario
    getInventario: () => request('/inventario'),
    createInventario: (it) => request('/inventario', { method: 'POST', body: JSON.stringify(it) }),
    ajustarStock: (id, ajuste, motivo) => request(`/inventario/${id}/ajustar`, { method: 'PUT', body: JSON.stringify({ ajuste, motivo }) }),
    // Nóminas
    getNominas: () => request('/nominas'),
    createNomina: (n) => request('/nominas', { method: 'POST', body: JSON.stringify(n) }),
    // Migration
    migrateJefeToAdmin: () => request('/migrate/jefe-to-admin', { method: 'POST' })
  };

  if (typeof window !== 'undefined') window.API = API;
  if (typeof module !== 'undefined') module.exports = API;
})();
