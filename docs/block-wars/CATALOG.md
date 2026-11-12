# Catálogo local de eventos gratuitos

Estado: implementación local para ensayo. Los nombres del catálogo provienen del encargo aprobado; los límites de esta página son decisiones propias de seguridad y balance, no mediciones de una plataforma o de un juego de referencia. Ningún comando necesita regalos ni suscripciones pagadas.

## Chat

Se aceptan mayúsculas/minúsculas y espacios exteriores. Los espacios internos consecutivos se normalizan. Cada alias funciona sin prefijo o con `!`, con la excepción de `!rain` indicada abajo. No se ejecuta texto, HTML, JavaScript ni shell del chat; sólo se selecciona una acción del catálogo estático `config.EVENTS`.

| Alias de chat | Acción del motor |
| --- | --- |
| TNT | `tnt` |
| Rainbow | `rainbow` |
| Mega | `mega` |
| Arrow | `arrow` |
| Butterfly | `butterfly` |
| Nuke | `nuke` |
| TNT RAIN / TNTRAIN | `tnt_rain` |
| Thunder | `thunder` |
| Fire | `fire` |
| Rain | `rain` |
| Tsunami | `tsunami` |
| BLACK HOLE / BLACKHOLE | `black_hole` |
| Jackpot | `jackpot` |
| Demon | `demon` |
| Meteor | `meteor` |
| Spin | `spin` |
| Fast | `fast` |
| Big | `big` |

`!rain` conserva la votación original: un voto por identidad y ronda, umbral predeterminado de cinco. **Rain sin `!`** pide el evento directo y usa los límites nuevos. `!TNT RAIN` y `!TNTRAIN` seleccionan `tnt_rain`; no son votos.

Los comandos originales `!dark`, `!light`, `!mine`, `!boom`, `!pico` y los cinco votos de picos conservan su comportamiento. Los comandos de efecto nuevos no requieren elegir equipo: se envía `neutral` cuando no existe pertenencia conocida; el motor resuelve ese destino. No se muestran nombres, hashes ni chat crudo.

## Límites elegidos

- Cooldown global entre efectos directos de chat: **10 000 ms**, compartido entre fuentes simuladas y TikFinity para proteger el mismo motor.
- Cooldown por identidad: **15 000 ms** entre cualquiera de estos efectos, con identidades separadas por fuente. Las identidades ausentes comparten un bucket anónimo por fuente.
- Opciones `effectCooldownMs` y `actorEffectCooldownMs`: enteros de 1 000 a 3 600 000 ms. `actorTtlMs` debe cubrir el cooldown por actor. `createRules()` rechaza ajustes inválidos; `rules.configure()` devuelve `false`.
- Un evento duplicado no repite efecto. Si el motor rechaza por pausa, resumen, cola o cooldown propio, los cooldowns nuevos no se consumen. Un identificador ya procesado sigue deduplicado; el usuario necesita un nuevo comentario para intentar otra vez.
- El cooldown global de NUKE del motor sigue siendo **45 segundos de juego**. Los otros cooldowns, duraciones y magnitudes del motor están declarados en `config.EVENTS`; no se derivan de la velocidad del chat.
- Los límites existentes de actores, deduplicación, votos, notificaciones, cola, entidades y partículas siguen activos. Las acciones de likes, votos y temporizador conservan sus límites independientes.
- `metrics.bySource.<fuente>.effects` cuenta efectos directos aceptados por el motor. `state.nextEffectInMs` expresa el bloqueo global de chat observado al procesar el último evento; no representa espectadores.

## Contrato del panel

`bw_action.action` admite exactamente las 18 claves de `config.EVENTS`, además de `mine`, `repair`, `turbo`, `descomunal`, `pickaxe` y `enchant`. El origen enviado por el cliente no puede convertir una simulación en evento real. `count` permanece limitado a 1–8 y sólo se admite para `mine`, `repair`, `tnt`, `meteor` y `rain`. No se amplían los campos del panel para ejecutar código o activar regalos/suscripciones.

## Réplica

```powershell
node --test tests/block-rules.test.cjs tests/block-server.test.cjs tests/block-catalog.test.cjs
npm run check
```

Las pruebas locales y la simulación acelerada no verifican una transmisión de TikTok, una sesión prolongada de OBS ni la elegibilidad de una cuenta.
