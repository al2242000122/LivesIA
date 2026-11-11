# Motor de excavación y render original

Motor real bajo `games/block-wars/engine.js`, configuración en `config.js` y Canvas en `render.js`. CommonJS/UMD sin dependencias ni recursos externos. La ruta y el panel web se integran en la fase de presentación, en PR separado; este componente ya se ejecuta y prueba desde Node.

`createEngine(options)` devuelve `state,update,action,pause,reset,configure,clearEffects`. `update(dt)` usa segundos y limita cada avance a0.25 s. El controlador debe usar timestep fijo; suspensión no recupera miles de pasos. Mapa simétrico de20 ×25 por defecto, materiales con dureza y puntos virtuales, semilla y rondas de180 s con resumen4 s. Los dos equipos minan automáticamente sin eventos externos.

Picos: madera0.6 b/s/20 usos, piedra1/40, oro2.8/12, diamante1.75/120 y netherita2.2/180. Eficiencia0–V multiplica1/1.3/1.7/2.5/4/6. Dureza divide la tasa efectiva; acumulación fraccional permite oro V16.8 b/s en dureza1. Irrompibilidad y Fortuna usan RNG con semilla. Fortuna solo cambia puntuación de minerales, nunca dinero. Progresión desbloquea picos por0/8/16/30/45 bloques; reposición gratuita garantiza continuidad. El operador puede equipar libremente en ensayo; los votos del público respetan desbloqueos.

Acciones: `mine,repair,pickaxe,enchant,tnt,rain,meteor,nuke,turbo,descomunal`. Validación estricta, sin coerción ni campos arbitrarios. Cola24, partículas160 y efectos24; máximo40 operaciones de bloque por actualización,32 reservadas como tope a explosiones. Aceptación por lotes atómica. Nuke global45 s, turbo10 s/cooldown20 s por equipo, descomunal6 s/cooldown30 s. Cooldown Nuke cruza rondas; reset explícito reinicia la sesión. Movimiento reducido conserva el resultado del juego y elimina partículas. `clearEffects()` limpia cola, partículas, efectos y aceleraciones para emergencia; `pause(true)` detiene todos los relojes de juego.

Pruebas `node --test tests/block-engine.test.cjs`: semilla/replay, dureza/velocidades, progresión, desgaste/encantamientos, pausa/reset, rondas, límites y120000 ticks con ráfagas. `render.js` dibuja bloques, grietas, herramientas y efectos originales; no usa imágenes de terceros.
