# Motor local de minería y física

Actualización: 2026-11-11. Motor real en `engine.js`, configuración en `config.js`, colisiones en `physics.js` y Canvas en `render.js`. Node20+/CommonJS y UMD sin dependencias npm. En navegador cargar `config.js` y `physics.js` antes de `engine.js`. Los PNG originales de Minecraft son recursos locales de terceros, descritos en [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md); cielo, lógica, cámara y efectos son implementación local.

## Contrato y modos compatibles

`createEngine(options)` devuelve `state,update,action,pause,reset,configure,clearEffects`. `update(dt)` usa segundos y limita un avance a0.25s. La app usa pasos fijos de0.05s; tras suspensión no intenta recuperar miles de pasos. `state` conserva su referencia entre actualizaciones y reinicios; sus listas internas deben leerse desde esa referencia.

- `arena`, predeterminado:20×25, equipos con minería autónoma y mapa simétrico. Rondas finitas de180s por defecto, resumen4s.
- `shaft`: pozo localizado con dos columnas abiertas por ocho filas, BFS sobre cielo conectado, cámara al frente y rondas finitas. Llegar al piso termina esa excavación antes de volver a paredes viejas del techo.
- `endless`, modo de la app: buffer predeterminado7×40, pico físico y terreno continuo. `remaining=0`, `phase='playing'`, `result=null`; nunca muestra resumen ni reinicia puntos o terreno por tiempo. `round=1+floor(elapsed/180)` sólo marca ciclos lógicos para renovar votos gratuitos.

En `endless`, `state.body={x,y,vx,vy,radius,rotation,team,collisions}` usa centros continuos en celdas; no se suma0.5 para dibujar el cuerpo. `state.rowOffset` cuenta filas descartadas. Profundidad absoluta = `rowOffset+body.y`. `focus` y los targets discretos permanecen como compatibilidad para HUD, reglas y explosivos.

## Contacto y terreno continuo

El cuerpo es un círculo contra AABB de celdas y paredes: gravedad14 celdas/s², restitución0.8, velocidad vertical máxima7.5 celdas/s y horizontal mínima2.5. La simulación divide cada actualización en hasta ocho subpasos; corrige penetración y refleja la velocidad según la normal de contacto. Radio0.35; BIG usa0.5. No teletransporta el pico a un bloque cercano ni usa BFS para dañarlo en este modo.

Cada equipo acumula trabajo potencial `effectiveSpeed*dt`, hasta64. Sólo el contacto real puede gastarlo para reducir HP. `!mine` agrega trabajo almacenado; no causa excavación remota. Las explosiones sí afectan áreas remotas, por diseño. El equipo del cuerpo depende del lado horizontal o del buff activo; así ambos equipos conservan picos y mejoras. Fuerza potencial no equivale a bloques efectivamente extraídos por segundo: también intervienen dureza, tiempo de aire y contactos.

Cuando el cuerpo baja de la fila25, el motor descarta12 filas superiores y añade12 nuevas con semilla por profundidad absoluta. Conserva280 celdas, ajusta cuerpo, targets, entidades, VFX, partículas e índices pendientes, y descarta entradas fuera del margen. No reinicia nivel ni puntos. La cámara resta el cambio de `rowOffset`, sigue al cuerpo sin retroceder en cada rebote y no se reinicia por ciclos de votos; un reset explícito sí vuelve al inicio.

## Herramientas, eventos y límites

Picos: madera0.6/20 usos, piedra1/40, oro2.8/12, diamante1.75/120 y netherita2.2/180. Eficiencia0–V multiplica1/1.3/1.7/2.5/4/6. En arena/shaft, oro V produce16.8 unidades de trabajo/s antes de dureza. En endless ese valor es fuerza/trabajo potencial, no una promesa de extracción física a16.8 bloques/s. Irrompibilidad y Fortuna usan RNG con semilla. Fortuna sólo cambia puntos virtuales. Se desbloquean picos por0/8/16/30/45 bloques; reposición gratuita garantiza continuidad. El operador puede equipar libremente en ensayo; votos del público respetan desbloqueos.

El catálogo compartido `EVENTS` contiene18 acciones: TNT, Rainbow, Mega, Arrow, Butterfly, Nuke, TNT Rain, Thunder, Fire, Rain, Tsunami, Black Hole, Jackpot, Demon, Meteor, Spin, Fast y Big. También se conservan `mine,repair,pickaxe,enchant,turbo,descomunal`. En shaft/endless, los proyectiles tienen trayectorias programadas y mechas de1.2s más0.08s por objeto en ráfaga. Radios, trayectorias, daño y cooldowns son decisiones locales, no mediciones de las capturas. Jackpot duplica puntos virtuales; no otorga dinero ni premios.

Validación estricta, sin coerción ni campos arbitrarios. Entidades+cola comparten24 entradas, partículas160 y VFX24. Explosiones: máximo32 operaciones; presupuesto compartido con minería/contacto:40 por actualización. Velocidad potencial limitada a240 y trabajo almacenado64. NUKE global45s cruza ciclos/rondas. Turbo10s/cooldown20s; descomunal6s/cooldown30s. El resto está en `config.js`.

Pausa congela física, mechas, buffs y VFX. Movimiento reducido elimina partículas y giro decorativo sin cambiar colisiones, desgaste, mapa o puntuación. `clearEffects()` cancela cola, entidades, VFX, partículas y buffs; la emergencia del panel también elimina cargas pendientes de reglas y pausa.

## Verificación reproducible

```powershell
node --test tests/block-engine.test.cjs tests/block-shaft.test.cjs tests/block-endless.test.cjs tests/block-physics.test.cjs
npm run test:endless-soak
$env:SOAK_HOURS='6'; npm run test:block-soak
```

Se conservan19 regresiones del motor inicial. Las nuevas cubren fuerzas normales de colisión, rebote, no atravesar suelo, daño exclusivamente por contacto, streaming, replay, pausa, reset, movimiento reducido, eventos y límites. El soak infinito de seis horas virtuales ejecutó432000 pasos, siete columnas excavadas,2138 corrimientos y66469 colisiones sin resúmenes ni fugas del cuerpo. Comparó en paralelo el modo normal y movimiento reducido, renovó117 ventanas de voto, y conservó buffer y colas acotadas. No acredita seis horas reales de navegador, OBS ni TikTok LIVE.
