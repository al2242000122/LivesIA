# ElevenLabs: configuración local por CLI

El propietario solicitó ejecutar `npx -y @elevenlabs/cli@latest onboard init` y seguir su flujo oficial. Se ejecutó la CLI1.11.0 desde LivesIA. El propietario aprobó personalmente la página de ElevenLabs; la CLI confirmó que creó una clave, la guardó en `.env.local`, lo encontró ignorado por Git y limpió el portapapeles. No se abrió, imprimió ni copió ese archivo en la conversación. No se añade al repositorio.

La CLI pidió permisos para varias funciones de ElevenLabs. Se informó al propietario antes de su confirmación. La aplicación sólo utiliza Text to Speech; las llamadas conservan el presupuesto local y no crean agentes, clonaciones de voz ni otros recursos.

## Arranque y aislamiento de pruebas

`npm start` ejecuta `scripts/start.cjs`: carga el archivo local opcional con `process.loadEnvFile()` y arranca el servidor fijo. Requiere Node20.12+ cuando existe `.env.local`; en esta PC hay Node24.13.0. Las variables ya suministradas al proceso conservan prioridad. Un fallo de carga muestra un diagnóstico fijo, sin contenido del archivo ni excepciones privadas.

Sin ese archivo se conserva el arranque con variables de proceso o sin narración. Los tests HTTP arrancan `server.js` directamente para no cargar la clave real del propietario. Las pruebas del bootstrap copian el arranque a directorios temporales y usan claves ficticias; no abren el proyecto real ni consumen créditos. `start-first-live.ps1` también apunta al bootstrap cuando necesita abrir el servidor; no sustituye un servidor ya abierto.

El transporte TTS utiliza `@elevenlabs/elevenlabs-js`2.78.0, licencia MIT, fijado con integrity en `package-lock.json`. Instalar con `npm ci`; el SDK se mantiene en el servidor. La integración conserva Flash v2.5, MP3, plantillas fijas, deduplicación, reserva conservadora de presupuesto, cancelación, plazo total y límite de audio. No se aceptan URLs, modelos ni texto libre desde el panel.

Instalación reproducible comprobada con `npm ci --ignore-scripts --no-audit`:7paquetes fijados, seis MIT y uno BSD-2-Clause (`webidl-conversions`3.0.1). Conservar sus avisos al distribuir. `npm audit --omit=dev --audit-level=high` reportó0vulnerabilidades en esta revisión; no garantiza ausencia de defectos futuros. La CI instala el lock y ejecuta la auditoría.

En OneDrive se midieron18–21s de carga fría del SDK en pruebas. Se carga una sola vez al crear el servicio con configuración válida, antes de aceptar solicitudes de voz; el juego sin voz no lo inicializa. El lanzador concede hasta30s para que aparezca el servidor. Esa carga inicial no forma parte del plazo de cada solicitud TTS y debe distinguirse de la latencia de narración real, todavía sin medir.

Las rutas del juego y de control conservan su contrato. En YouTube, sólo metas de likes y suscriptores gratuitos simulados pueden pedir voz; los14comandos mantienen sus FX. El chat real de YouTube continúa pendiente.

## Verificar sin exponer la clave

```powershell
npm ci
npm test
npm run check
npx -y @elevenlabs/cli@latest onboard check --answered --env-path .env.local
```

El onboarding no acredita por sí solo que una narración se haya escuchado en OBS. Antes de iniciar la aplicación con voz o enviar una solicitud TTS de ensayo, el flujo de la CLI requiere aprobar la prueba concreta. Después hay que comprobar pronunciación, latencia, fuente única, volumen relativo de FX/voz y cancelación al silenciar/emergencia. No se inicia una emisión por ejecutar la comprobación del onboarding.

Tras la aprobación explícita del propietario, la prueba CLI devolvió200 y se grabaron los dos avisos reales de likes/suscriptor simulado en OBS:2solicitudes del juego,121caracteres reservados, mezcla con pico−8.14dBFS y decodificación completa sin errores. Ver [prueba real](ELEVENLABS_OBS_REHEARSAL_2026-11-13.md). El [ensayo anterior](OBS_YOUTUBE_REHEARSAL_2026-11-13.md) sólo incluía FX. El chat integrado y la estabilidad prolongada siguen pendientes.

Fuentes oficiales: [onboarding y autenticación](https://elevenlabs.io/docs/api-reference/authentication), [inicio con CLI](https://elevenlabs.io/docs/eleven-api/quickstart), [SDK](https://github.com/elevenlabs/elevenlabs-js), [carga local de Node](https://nodejs.org/en/blog/release/v20.12.0). Skills oficiales descargadas a una carpeta temporal, fuera del repositorio, según la instrucción de la CLI.
