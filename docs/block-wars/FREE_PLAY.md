# Participación gratuita

Reglas reales en `games/block-wars/rules.js`, independientes del motor y los transportes. `createRules(engine,options)` devuelve `handle,flush,configure,reset,state,metrics`. El controlador llama `flush()` por tick para despachar hasta8 TNT pendientes sin perder créditos cuando la cola rechaza trabajo.

- Likes:25 por TNT, remanentes y métricas separados por fuente; no mezclar DEMO con relay para alcanzar umbral. Se agregan cantidades en contadores, no una operación por pulsación.
- `!dark` / `!light`: equipo y cambio cada60 s. `!mine`:15 s, requiere equipo. `!boom`:30 s, tres cargas activan TNT. `!rain`: cinco votos, uno por actor/ronda.
- `!pico`: consulta segura; no muestra texto arbitrario del chat. `!madera,!piedra,!oro,!diamante,!netherita`: votos de equipo, tres votos por ventana30 s, un ganador; herramientas desbloqueadas gratuitamente.
- Follow: reparación/refuerzo del equipo conocido o neutral, dedupe/cooldown60 s. `gift` y `subscribe_paid` se ignoran en Block Wars.
- Actor/acción y dedupe tienen límites/TTL, rechazando entradas nuevas si se saturan. Identidad de sesión efímera, sin logs de nombres o mensajes. Las notificaciones se construyen con texto de allowlist.

`state` expone progreso por fuente, miembros, votos, créditos y avisos de lectura. `metrics.bySource` expone likes/follows/comments/commands/duplicates/ignored/rejected/tnt. Ninguna cifra representa espectadores, ingresos o retención. Conectarse a un relay no convierte estos eventos en un LIVE verificado.

Pruebas: `node --test tests/block-rules.test.cjs`. Carga: `node --expose-gc tests/block-soak.cjs`; `SOAK_HOURS` acepta más de0 y hasta24, por defecto2. Usa motor real, dos fuentes sintéticas, spam, duplicados, eventos pagados ignorados, pausas y Nuke. El resultado es simulación acelerada, no prueba de transmisión ni medida de FPS de OBS.
