# Primer LIVE: montaje desde cero

Fecha: 2026-11-11. Rama `codex/first-live-setup`, sobre el PR de objetivos de experiencia. **Ensayo local, sin transmisión pública verificada.**

## Resultado preparado en esta PC

- OBS Studio33.0.1 portable oficial, separado de cualquier instalación del usuario, bajo `%LOCALAPPDATA%/LivesIA/obs-studio/33.0.1`.
- Perfil y colección **LivesIA Ensayo**, escena **Mina LIVE**, lienzo/salida720×1280 a30FPS.
- Única fuente **Mina infinita**, navegador local `http://127.0.0.1:4173/block-wars`, audio en el mezclador OBS. Sin cámara, captura del escritorio ni micrófono; sin servidor/clave de transmisión.
- Fuente persistente: no se suspende al ocultarse ni se refresca al activarla. La partida se calcula en tiempo real.
- Grabación local MKV en `%LOCALAPPDATA%/LivesIA/recordings`: [ensayo real de33min47s decodificado completamente](OBS_REHEARSAL_2026-11-12.md), con imagen y FX capturados. El nivel de sonido es bajo; mezcla y voz real siguen pendientes. No equivale al ensayo prolongado de120min.
- Código de sonidos originales para18eventos, comentarios recompensados y follows; narración opcional de ElevenLabs por acciones aceptadas. La credencial local no estaba configurada durante este montaje. No se hizo una llamada real al TTS ni se verificaron sus latencias.

**Actualización 2026-11-12:** TikTok LIVE Studio 1.39.6 está instalado, con firmas válidas de TikTok Pte. Ltd. en lanzador y ejecutable. El propietario inició sesión y la aplicación mostró **«Sin acceso»**. La solicitud enviada a TikTok quedó **Under review**; la interfaz indicó respuesta en 3 días hábiles, sin aprobación confirmada. TikFinity aún no está instalado/verificado. [Registro y siguientes comprobaciones](TIKTOK_LIVE_ACCESS.md). El juego puede ensayarse sin esos programas.

## Abrir el ensayo

En PowerShell, desde la raíz del proyecto:

```powershell
.\scripts\start-first-live.ps1 -CheckOnly # comprueba rutas y firma, sin abrir aplicaciones
.\scripts\start-first-live.ps1            # servidor local, OBS y panel; sin emitir
```

El lanzador conserva el OBS ya abierto. Si hay otra sesión, seleccionar manualmente **LivesIA Ensayo** antes del ensayo. Un servidor ya activo no se reinicia automáticamente al cambiar código o variables de ElevenLabs.

1. En OBS seleccionar **Mina infinita → Interactuar → ACTIVAR SONIDO**. Se requiere una activación por carga de la fuente. Mantener la página de control fuera de la captura.
2. Abrir el panel y probar TNT, NUKE y un comentario `!dark` seguido de `!mine`. Los enfriamientos siguen activos. Un envío aceptado por el relay no garantiza que el motor acepte el efecto; ver el aviso del juego.
3. Verificar el medidor de audio de **Mina infinita** y grabar un ensayo privado. Detener grabación antes de cerrar OBS. No agregar audio del escritorio: podría duplicar sonido o capturar conversaciones ajenas.
4. Revisar silencio/volumen, pausa, reanudación y emergencia. La emergencia vacía audio y cargas pendientes. No deben reproducirse anuncios viejos al reanudar.
5. Configurar ElevenLabs con la guía [SPEECH_SETUP.md](SPEECH_SETUP.md). La clave sólo queda en el servidor local, nunca en el navegador o en Git. La voz usa plantillas; no lee chat libre. La moderación de nombres es básica, no completa. Se puede silenciar la voz conservando FX.

El panel admite voz/volumen/silencio; no conserva estos ajustes entre recargas. Los sonidos son señales de una acción aceptada, no medición del instante de detonación. Las acciones de prueba conservan el prefijo hablado «Prueba», también al drenar likes pendientes; no se atribuye un autor a likes agregados. Follows y suscripciones pagadas son distintos: los eventos pagados de Block Wars siguen deshabilitados.

## Completar el acceso a TikTok

1. Descargar [TikTok LIVE Studio desde TikTok](https://www.tiktok.com/studio/download?lang=es), instalar y entrar personalmente con la cuenta que emitirá. Comprobar ahí el acceso. No compartir contraseñas, códigos o claves de transmisión en el chat.
2. Elegir la ruta después de comprobar acceso: LIVE Studio con fuente web/captura admitida por su versión, o OBS con RTMP si TikTok entrega esa opción a la cuenta. No asumir que existe una clave RTMP. OBS Virtual Camera transporta video; no resuelve el audio por sí sola.
3. Instalar [TikFinity Desktop desde su sitio oficial](https://tikfinity.com/), comprobar sus condiciones y habilitar Event API local. La integración actual espera `ws://127.0.0.1:21213/`; contrastar puerto y paquetes con la versión instalada. La conexión abierta continúa rotulada como **RELAY SIN VERIFICAR**.
4. En una prueba controlada y con el LIVE activo, verificar un comentario, likes y un follow reales con otro dispositivo. Comprobar una sola recompensa y su fuente, reconexión y enfriamientos. No presentar simulaciones como participación real.
5. Revisar la salida final y el resumen nativo disponible. Hacer el ensayo de120min, medir FPS y continuidad, y revisar recursos/derechos antes de un lanzamiento comercial. Las texturas de Mojang se conservan sólo localmente; ver [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md). No hay monetización comprobada.

## Reproducir la preparación de OBS

Binario obtenido del [release oficial33.0.1](https://github.com/obsproject/obs-studio/releases/tag/33.0.1): `OBS-Studio-33.0.1-Windows-x64.zip`,223786669bytes, SHA256 `0d9436451c2d772b33428e3fdae9776f071895c335de17283176306fb72651d3`. Se comprobó ese hash y firma válida del ejecutable **OBS Project, LLC**. OBS es GPL; no se añade el binario al repositorio.

Tras extraer el ZIP en una carpeta portable independiente, con OBS cerrado:

```powershell
node scripts/prepare-obs.cjs "$env:LOCALAPPDATA/LivesIA/obs-studio/33.0.1/config/obs-studio" "$env:LOCALAPPDATA/LivesIA/recordings"
```

El generador crea archivos nuevos y rechaza sobreescribir un perfil/colección con esos nombres. No configura cuentas ni modifica el perfil activo de una instalación distinta. Para revertir, detener la grabación/servidor y volver a otra colección/perfil; conservar los archivos y grabaciones para revisión.

## Verificación y límites

`npm test`, `npm run check`; regresiones en `tests/live-experience.test.cjs`, `tests/live-server.test.cjs`, `tests/transport.test.cjs`, `tests/obs-setup.test.cjs`, `tests/block-audio.test.cjs` y `tests/speech.test.cjs`. No requieren créditos ni cuentas externas. La preparación del lanzador se valida con `-CheckOnly` y el parser de PowerShell.

Las revisiones detectaron y corrigieron el descarte de `bw_audio` por SSE y la pérdida de fuente en TNT comunitaria diferida. La grabación privada, ElevenLabs real, TikFinity real, acceso de la cuenta, sincronía final y ensayo de120min se registran con resultado real; las pruebas offline no los sustituyen.
