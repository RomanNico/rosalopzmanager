# Pruebas automatizadas de ROSALOPZManager

Scripts usados en el taller *Implementación del Plan de Pruebas de Software*.

| Script | Qué hace |
|---|---|
| `e2e.js` | Ejecuta los 20 casos de prueba (CP01–CP20) en Microsoft Edge con Playwright, verifica cada resultado en la interfaz y en PostgreSQL, y guarda capturas como evidencia. |
| `estres.js` | Prueba de estrés de la API (PE01–PE03): peticiones concurrentes, tiempos de respuesta, errores y memoria del servidor. |

## Cómo ejecutarlas

```bash
# 1. Dejar la base de datos en el estado inicial (BORRA los datos; guarda respaldo en /backups)
npm run reiniciar-datos

# 2. En otra terminal, iniciar el servidor de pruebas en el puerto 3999
PORT=3999 node server.js        # PowerShell: $env:PORT=3999; node server.js

# 3. Ejecutar
npm run test:e2e                 # los 20 casos
node pruebas/e2e.js CP04 CP05    # solo algunos casos
npm run test:estres              # prueba de estrés
```

Los resultados (JSON) y las capturas quedan en `pruebas/resultados/` (no se suben a git).
Varios casos dependen de los anteriores (CP09, CP10 y CP17 usan la usuaria creada en CP04), así que
para una ejecución completa se debe reiniciar la base antes de correr la suite.

## Demostración en vivo

Navegador visible, más despacio y con un panel que muestra qué caso se está probando y su resultado (✅ / ❌).
Estos comandos funcionan igual en PowerShell, CMD y Git Bash:

```bash
npm run reiniciar-datos     # datos limpios (obligatorio antes de cada demo: CP04 crea a Laura Gómez)
npm run demo                # CP01, CP04, CP10 y CP13 a 1.200 ms por acción
npm run demo:lento          # lo mismo a 2.000 ms por acción
```

⚠️ En PowerShell no uses `npm run ... -- opciones`: PowerShell elimina el `--` y las opciones no llegan
al script. Para otros casos o velocidades llama a node directamente:
`node pruebas/e2e.js --demo --velocidad=2500 CP01 CP02 CP13`

Si no tienes Edge, indica otro navegador basado en Chromium:
`NAVEGADOR="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run test:e2e`
