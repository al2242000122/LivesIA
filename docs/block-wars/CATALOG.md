# Catálogo local de eventos gratuitos

Estado: implementación local para ensayo. Los nombres del catálogo provienen del encargo aprobado; los límites de esta página son decisiones propias de seguridad y balance, no mediciones de una plataforma o de un juego de referencia. Ningún comando necesita regalos ni suscripciones pagadas.

## Selección vigente

El propietario eligió los comandos 1–14 de la [propuesta Minecraft implementada](MINECRAFT_COMMANDS.md). El menú y los automáticos de endless promueven esos 14; el catálogo interno conserva los anteriores y añade `storm` y `creeper` (20 claves). La tabla siguiente incluye compatibilidad.

## Chat

Se aceptan mayúsculas/minúsculas y espacios exteriores. Los espacios internos consecutivos se normalizan. Cada alias funciona sin prefijo o con `!`. No se ejecuta texto, HTML, JavaScript ni shell del chat; sólo se selecciona una acción del catálogo estático `config.EVENTS`.

| Alias de chat | Acción del motor |
| --- | --- |
| TNT | `tnt` |
| Rainbow | `rainbow` |
| Mega | `mega` |
| Arrow | `arrow` |
| Butterfly | `butterfly` |
| Nuke | `nuke` |
| TNT RAIN / TNTRAIN | `rain` |
| Thunder | `thunder` |
| Fire | `fire` |
| Rain | `rain` |
| Storm | `storm` |
| Creeper | `creeper` |
| Tsunami | `tsunami` |
| BLACK HOLE / BLACKHOLE | `black_hole` |
| Jackpot | `jackpot` |
| Demon | `demon` |
| Meteor | `meteor` |
| Spin | `spin` |
| Fast | `fast` |
| Big | `big` |

`rain`, `!rain`, `!TNT RAIN` y `!TNTRAIN` activan la misma lluvia de TNT. La antigua votación se conserva como **`!voterain`**: un voto por identidad y ciclo, umbral predeterminado de cinco. La clave interna `tnt_rain` permanece disponible para acciones directas compatibles del operador.

Los comandos originales `!dark`, `!light`, `!mine`, `!boom`, `!pico` y los cinco votos de picos conservan su comportamiento. Los efectos no requieren elegir equipo: se envía `neutral` cuando no existe pertenencia conocida; el motor resuelve ese destino. Se muestra un nombre moderado en las activaciones; hashes y chat crudo no se muestran ni se añaden a telemetría.

## Límites elegidos

- Cooldown global entre efectos directos de chat: **10 000 ms**, compartido entre fuentes simuladas y TikFinity para proteger el mismo motor.
- Cooldown por identidad: **15 000 ms** entre cualquiera de estos efectos, con identidades separadas por fuente. Las identidades ausentes comparten un bucket anónimo por fuente.
- Opciones `effectCooldownMs` y `actorEffectCooldownMs`: enteros de 1 000 a 3 600 000 ms. `actorTtlMs` debe cubrir el cooldown por actor. `createRules()` rechaza ajustes inválidos; `rules.configure()` devuelve `false`.
- Un evento duplicado no repite efecto. Si el motor rechaza por pausa, resumen, cola o cooldown propio, los cooldowns nuevos no se consumen. Un identificador ya procesado sigue deduplicado; el usuario necesita un nuevo comentario para intentar otra vez.
- El cooldown global de NUKE del motor sigue siendo **45 segundos de juego**. Los otros cooldowns, duraciones y magnitudes del motor están declarados en `config.EVENTS`; no se derivan de la velocidad del chat.
- Los límites existentes de actores, deduplicación, votos, notificaciones, cola, entidades y partículas siguen activos. Las acciones de likes, votos y temporizador conservan sus límites independientes.
- `metrics.bySource.<fuente>.effects` cuenta efectos directos aceptados por el motor. `state.nextEffectInMs` expresa el bloqueo global de chat observado al procesar el último evento; no representa espectadores.

## Contrato del panel

`bw_action.action` admite exactamente las 20 claves de `config.EVENTS`, además de `mine`, `repair`, `turbo`, `descomunal`, `pickaxe` y `enchant`. El origen enviado por el cliente no puede convertir una simulación en evento real. `count` permanece limitado a 1–8 y sólo se admite para `mine`, `repair`, `tnt`, `meteor` y `rain`. No se amplían los campos del panel para ejecutar código o activar regalos/suscripciones. La atribución `actor/source/actionId` se pasa como contexto interno separado del JSON del motor.

## Réplica

```powershell
node --test tests/block-rules.test.cjs tests/block-server.test.cjs tests/block-catalog.test.cjs
npm run check
```

Las pruebas locales y la simulación acelerada no verifican una transmisión de TikTok, una sesión prolongada de OBS ni la elegibilidad de una cuenta.
