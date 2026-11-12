# 🐍 Serpiente Infinita LIVE — MVP original

Juego interactivo vertical para TikTok LIVE: autopiloto de serpiente por laberintos aleatorios, interacciones por chat/likes/regalos, overlay para OBS y panel separado de pruebas. Construido desde cero con JavaScript/Canvas y un servidor local Node.js; **sin dependencias npm**, sin necesidad de instalar paquetes ni introducir contraseñas de TikTok en el juego.

## Requisitos

- Para el juego y el panel: PC con **Node.js 20 o posterior** (el servidor funciona en Windows/macOS/Linux).
- Para recibir regalos reales mediante la integración incluida: **Windows**, porque TikFinity Desktop y su Event API local sólo están disponibles en Windows (según la documentación de TikFinity consultada en 2026).
- OBS Studio, o software de transmisión que pueda mostrar una página web/captura de navegador.
- Para eventos reales: TikFinity Desktop vinculado a tu propio TikTok LIVE, con su **Event API** local activa. La integración requiere que esté disponible y conectada; la conexión del juego es a `ws://127.0.0.1:21213/`.
- Cuenta que cumpla las condiciones de TikTok para transmitir y recibir regalos. Este software **no habilita la monetización**.

## Iniciar

1. Descomprime la carpeta.
2. Abre una terminal en la carpeta que contiene `server.js`.
3. Ejecuta `node server.js`.
4. Abre `http://127.0.0.1:4173/` para ver el juego y `http://127.0.0.1:4173/control` para probar botones.
5. En OBS, **Fuentes → Navegador**, URL `http://127.0.0.1:4173/`, ancho **720**, alto **1280**. Conviene desactivar la suspensión de la fuente cuando no está visible, si quieres que la partida permanezca activa en cambios de escena.
6. Si tu cuenta puede transmitir, abre TikTok LIVE Studio/OBS según el flujo que tengas habilitado, y configura la escena vertical. No expongas el panel de control en el LIVE.
7. Ejecuta TikFinity Desktop en la **misma PC**, conecta tu usuario al LIVE y verifica que el cartel cambie de «MODO DEMO» a «RELAY CONECTADO». El texto indica conexión al relay, no prueba por sí solo que TikTok esté transmitiendo. Los efectos disparados desde el panel llevan `PRUEBA` incluso si el relay está conectado.

Detener: `Ctrl+C` en la terminal.

## Mecánicas actuales

| Evento | Efecto |
|---|---|
| Regalo llamado Rose/Rosa | +2 manzanas por unidad |
| Regalo Finger Heart/Corazón/Heart Me | +1 escudo por unidad (máximo 5) |
| Regalo Donut/Doughnut/Dona | Turbo temporal |
| Regalo Galaxy/Galaxia | Lluvia de manzanas y efecto de colores |
| Otro regalo | +1 manzana por unidad |
| Cada 100 likes acumulados | +1 manzana |
| Follow | +1 manzana |
| Suscripción | +5 manzanas |
| Comentar `!manzana` | +1 manzana, con límites antispam (gratis) |

Los nombres y la disponibilidad de regalos pueden variar por región. **Antes de transmitir, comprueba el nombre exacto que devuelve TikFinity** y ajusta la función `gift()` de `game.js`. No se anuncian precios de monedas porque cambian. Se evita contar varias veces las rachas incompletas de regalos (`giftType=1`, `repeatEnd`).

## Arquitectura

- `server.js`: servidor HTTP exclusivamente local (`127.0.0.1:4173`), distribución de la interfaz y puente de eventos SSE de las pruebas.
- `index.html` + `styles.css`: vista vertical limpia que captura OBS.
- `game.js`: juego, generación de laberintos, autopiloto, Canvas, efectos e integración local TikFinity.
- `control.html`: panel de botones para probar eventos sin gasto alguno.
- `control.js`: lógica del panel, separada para permitir CSP sin scripts inline.

La conexión a TikFinity se realiza **en el navegador que renderiza el juego**, no en el servidor Node; por ello debe ejecutarse en la misma máquina que TikFinity. El panel utiliza SSE local para accionar la instancia que aparece en OBS.

## Pruebas y estabilización

Sin instalar paquetes del proyecto:

```powershell
npm run check
npm test
npm run test:soak
```

El ensayo `test:soak` recorre dos horas virtuales por defecto. Para seis: asigna `$env:SOAK_HOURS = '6'` antes de ejecutarlo. Es una simulación acelerada con reloj/Canvas de prueba; no equivale a una emisión real. La auditoría, defectos reproducidos, límites del contrato y plan por fases están en [AUDIT_PHASE_1.md](docs/AUDIT_PHASE_1.md).

La API de control exige JSON tipado, permite hasta 30 comandos/s y 4096 bytes por mensaje; admite 16 ventanas SSE. Rechaza orígenes/hosts ajenos y sanea textos. No hay autenticación entre procesos locales: usa solo una PC de confianza y no publiques el puerto. Las pruebas se rotulan como simulación y las suscripciones se distinguen de los follows gratuitos. El soporte LIVE real, OBS/CEF y monetización siguen pendientes de validación.

## Limitaciones y seguridad

- **MVP, no producto en producción validado**: debe probarse en tu equipo con tu versión de TikFinity y OBS. El formato de eventos de terceros puede variar.
- TikFinity es un servicio tercero, **no la API oficial pública de TikTok**. Consulta sus condiciones y las de TikTok antes de usarlo comercialmente.
- No abras el puerto al exterior ni uses un túnel público para el panel de control. El servidor sólo escucha en loopback.
- No incluye pagos, retiros, analíticas reales de ingresos, ni garantiza vistas, aprobación o rentabilidad.
- TikTok restringe solicitudes engañosas o presión para enviar regalos, y actividades tipo apuestas. No ofrezcas premios aleatorios de valor por regalos ni simules regalos reales.
- Para un lanzamiento, revisa moderación del chat, ajustes y compatibilidad de nombres reales de regalos, estabilidad en emisiones largas y elegibilidad de LIVE Gifts.

## Fuentes útiles

- TikFinity Events API: https://tikfinity.com/ (buscar «Event API»)
- Ayuda TikTok Diamantes: https://support.tiktok.com/es/business-and-creator/video-gifts-on-tiktok/diamonds
- TikTok interactive games (vía evaluación de socios): https://cp-game.tiktok.com/interactive-game-registration
- Normas LIVE de TikTok: https://www.tiktok.com/community-guidelines/

---

## Block Wars LIVE: ensayo local de minería vertical

Block Wars LIVE ya funciona localmente: **excavación infinita**, con un pico que cae, rebota y choca contra los bloques. El daño ocurre por contacto; el terreno nuevo aparece sin detener la partida ni reiniciar el puntaje al llegar al fondo. Incluye cámara, cinco picos y encantamientos, equipos DARK vs LIGHT,25 likes por TNT y18 eventos gratuitos con enfriamientos. Los regalos pagados están deshabilitados. Serpiente Infinita conserva sus rutas y funciones.

```powershell
python scripts/import_minecraft.py  # opcional: PNG originales desde el cliente oficial fijado
npm start
# Juego: http://127.0.0.1:4173/block-wars
# Panel: http://127.0.0.1:4173/block-wars/control
```

La importación requiere Python 3.10+ y red; el juego sólo requiere Node 20+. Instala34 PNG originales, incluidas las diez etapas de grietas de Minecraft. Actualiza instalaciones anteriores de24 PNG con respaldo y preserva los originales si falla la actualización. Conserva los PNG **fuera de Git**, valida hashes y registra procedencia. Sin importar se usa arte de respaldo y se indica en pantalla. El importador no ejecuta Minecraft. [Recursos y condiciones](docs/block-wars/MINECRAFT_ASSETS.md). La descarga local no acredita permiso para distribuir o monetizar esta aplicación independiente.

OBS: fuente de navegador **720 × 1280**, URL del juego; mantener activa su renderización. El panel simula eventos, permite cambiar picos/encantamientos, pausa, reinicio, reducción de movimiento y emergencia. El chat reconoce `TNT`, `MEGA`, `SPIN`, etc. ([catálogo](docs/block-wars/CATALOG.md)). Los efectos alteran el motor, no son un video pregrabado. [Referencia visual e implementación](docs/block-wars/REFERENCE_IMPLEMENTED.md).

Comprobar con `npm test`, `npm run check` y `npm run test:endless-soak` (seis horas virtuales). `test:block-soak` conserva los ensayos de los modos anteriores. La suite de importación usa Python 3.10+ (Windows: `python`; Linux/macOS: `python3`), sin paquetes adicionales ni descarga durante las pruebas. La simulación acelerada y la prueba en navegador no sustituyen una emisión prolongada en OBS/CEF. TikFinity recibe eventos en el navegador del juego y aún debe contrastarse con una cuenta LIVE real.

- [Plan y estado de Block Wars](docs/block-wars/README.md)
- [Diseño del juego](docs/block-wars/GAME_DESIGN.md)
- [Crecimiento y futura monetización](docs/block-wars/GROWTH_AND_MONETIZATION.md)
- [Arquitectura técnica](docs/block-wars/TECHNICAL_SPEC.md)
- [Backlog para Codex](docs/block-wars/CODEX_BACKLOG.md)

**Nota:** no se deben confundir follows gratuitos con subs pagadas. TikTok no remunera directamente cada like o vista; se requiere elegibilidad para LIVE y Gifts si en el futuro se habilitan regalos.
