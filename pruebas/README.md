# Pruebas automatizadas de ROSALOPZManager

Scripts usados en el taller *Implementación del Plan de Pruebas de Software*.

| Script | Qué hace |
|---|---|
| `e2e.js` | Ejecuta los 20 casos de prueba (CP01–CP20) en Microsoft Edge con Playwright, verifica cada resultado en la interfaz y en PostgreSQL, y guarda capturas como evidencia. |
| `estres.js` | Prueba de estrés de la API (PE01–PE03): peticiones concurrentes, tiempos de respuesta, errores y memoria del servidor. |

## Cómo ejecutarlas

```bash
# 1. Dejar la base de datos en el estado inicial (BORRA los datos; guarda respaldo en /backups)
npm run seed -- --force

# 2. En otra terminal, iniciar el servidor de pruebas en el puerto 3999
PORT=3999 node server.js        # PowerShell: $env:PORT=3999; node server.js

# 3. Ejecutar
npm run test:e2e                 # los 20 casos
npm run test:e2e -- CP04 CP05    # solo algunos casos
npm run test:estres              # prueba de estrés
```

Los resultados (JSON) y las capturas quedan en `pruebas/resultados/` (no se suben a git).
Varios casos dependen de los anteriores (CP09, CP10 y CP17 usan la usuaria creada en CP04), así que
para una ejecución completa se debe reiniciar la base antes de correr la suite.

Si no tienes Edge, indica otro navegador basado en Chromium:
`NAVEGADOR="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run test:e2e`
