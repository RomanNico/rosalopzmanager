/**
 * Prueba de estrés de la API de ROSALOPZManager (servidor local en :3999)
 * Lanza muchas peticiones concurrentes y mide tiempos, errores y memoria del servidor.
 *   npm run test:estres   (requiere el servidor de pruebas en el puerto 3999)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:3999/api';
const OUT = require('path').join(__dirname, 'resultados', 'estres.json');
fs.mkdirSync(require('path').dirname(OUT), { recursive: true });

const memoriaServidor = () => {
  const ps = `$c = Get-NetTCPConnection -LocalPort 3999 -State Listen; [math]::Round((Get-Process -Id $c.OwningProcess).WorkingSet64 / 1MB, 1)`;
  return parseFloat(execSync(`powershell -NoProfile -Command "${ps}"`).toString().trim());
};
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

async function escenario(nombre, total, concurrencia, peticion) {
  const tiempos = [];
  let errores = 0, enviadas = 0;
  const memAntes = memoriaServidor();
  const t0 = performance.now();
  const trabajador = async () => {
    while (enviadas < total) {
      enviadas++;
      const t = performance.now();
      try {
        const res = await peticion();
        if (!res.ok) errores++;
        await res.arrayBuffer();
      } catch (e) { errores++; }
      tiempos.push(performance.now() - t);
    }
  };
  await Promise.all(Array.from({ length: concurrencia }, trabajador));
  const duracion = (performance.now() - t0) / 1000;
  const memDespues = memoriaServidor();
  tiempos.sort((a, b) => a - b);
  const r = {
    escenario: nombre, peticiones: total, concurrencia, duracion_s: +duracion.toFixed(2),
    por_segundo: +(total / duracion).toFixed(1),
    promedio_ms: +(tiempos.reduce((s, x) => s + x, 0) / tiempos.length).toFixed(1),
    p50_ms: +pct(tiempos, 50).toFixed(1), p95_ms: +pct(tiempos, 95).toFixed(1), p99_ms: +pct(tiempos, 99).toFixed(1),
    max_ms: +tiempos[tiempos.length - 1].toFixed(1), errores, tasa_error: +((errores / total) * 100).toFixed(2),
    memoria_antes_mb: memAntes, memoria_despues_mb: memDespues,
  };
  console.log(JSON.stringify(r));
  return r;
}

(async () => {
  const login = await fetch(BASE + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@bufalo.com', password: 'admin123' }) }).then(r => r.json());
  const auth = { Authorization: 'Bearer ' + login.token };
  const res = [];
  res.push(await escenario('Disponibilidad (GET /api/health)', 2000, 100, () => fetch(BASE + '/health')));
  res.push(await escenario('Carga de datos completa (GET /api/sync)', 2000, 50, () => fetch(BASE + '/sync', { headers: auth })));
  res.push(await escenario('Inicios de sesión simultáneos (POST /api/login)', 300, 30, () => fetch(BASE + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jefe@bufalo.com', password: 'jefe123' }) })));
  // Recuperación: después de la carga el servicio sigue respondiendo normal
  const t = performance.now();
  const salud = await fetch(BASE + '/health').then(r => r.json());
  const recuperacion = { ok: salud.ok === true, ms: +(performance.now() - t).toFixed(1) };
  const tamano = (await fetch(BASE + '/sync', { headers: auth }).then(r => r.text())).length;
  console.log('recuperación', JSON.stringify(recuperacion), 'tamaño /api/sync', (tamano / 1024).toFixed(0) + ' KB');
  const equipo = {
    cpu: execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name"').toString().trim(),
    nucleos: require('os').cpus().length,
    ram_gb: +(require('os').totalmem() / 1024 ** 3).toFixed(1),
    so: execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption"').toString().trim(),
    node: process.version,
    postgres: null,
  };
  fs.writeFileSync(OUT, JSON.stringify({ fecha: new Date().toISOString(), equipo, escenarios: res, recuperacion, tamano_sync_kb: +(tamano / 1024).toFixed(0) }, null, 2));
})();
