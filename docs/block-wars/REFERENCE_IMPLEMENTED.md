# Referencias visuales y resultado local

Fecha: 2026-11-11. Estado: código ejecutable y pruebas locales; captura OBS prolongada, TikFinity instalado y transmisión real pendientes. La app usa ahora excavación **infinita con pico físico** por petición posterior del propietario. Los modos anteriores `arena` y `shaft` siguen disponibles para compatibilidad.

## Qué muestran las capturas y qué decidimos implementar

La inspección individual de las diez imágenes está en [VISUAL_REFERENCE_ANALYSIS.md](VISUAL_REFERENCE_ANALYSIS.md). Las imágenes muestran estados; no son evidencia de la física, velocidad, algoritmo, conexión del chat ni consecuencias de eventos.

| Evidencia visual | Implementación local y límites de inferencia |
| --- | --- |
| Mundo vertical casi completo, pocas columnas, pared oscura y hueco con cielo | Canvas720×1280; siete columnas de mundo más una pared lateral de bedrock, cielo y nubes. No se copia la interfaz del reproductor ni su chat externo. |
| Pico grande dentro del conducto, colores de material y grietas sobre celdas | Un pico visible con cabeza según herramienta. Por instrucción posterior, su cuerpo cae y rebota mediante círculo-AABB y daña por contacto. Esta física fue elegida; las imágenes no la demostraban. |
| TNT pequeña, grande, girada y Jackpot | Entidades de tamaño/color distinto antes del impacto; mecha y descenso programados. Tamaños,1.2s de mecha y radios son balance local. |
| SPIN, FIRE STORM y JACKPOT con temporizador/banner | HUD sincronizado con `activeEvent`; giro, proyectiles de fuego y TNT especial propios. No se deduce que el código o shader de referencia fueran iguales. |
| Dieciocho nombres en el catálogo | Dieciocho acciones reales acotadas; los efectos no observables directamente se especificaron como decisiones locales en `config.EVENTS`. |
| Nombre pendiente `%user%` y círculos rojos de anotación | No se reproducen placeholders, nombres privados ni marcas del cursor. El juego no necesita texto arbitrario de espectadores. |
| `LIKE=TNT` y `SUB=NUKE` | Likes gratuitos cargan TNT con umbral configurado. No se traduce SUB a un pago ni se activan regalos: la referencia no prueba permisos o integración TikTok. |

## Texturas: originales de Minecraft, efectos locales

Por petición explícita del propietario se importaron **34 PNG originales de Minecraft26.3**:24 imágenes de bloques, picos y TNT, más diez etapas `destroy_stage_0..9`. Están en `assets-local/minecraft/` con `provenance.json`, excluidos de Git. Importador, pines, pruebas y procedencia están documentados en [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md). No son texturas creadas por LivesIA ni una licencia nueva para redistribuirlas.

Las etapas de grietas son las imágenes originales. Su composición Canvas, iluminación y tiempo de selección son implementación local; usar esos PNG no demuestra equivalencia exacta con el shader de Minecraft. El cielo, nubes, cámara, partículas, trayectorias, formas de proyectiles, buffs y lógica son código local. Existe respaldo procedural si los PNG locales no están disponibles; el indicador de recursos diferencia ese estado.

## Física infinita, reloj y cámara

`layout:'endless'` usa un buffer7×40. `state.body` contiene centro continuo en celdas, velocidad, radio, rotación, equipo y colisiones. Gravedad14, restitución0.8, horizontal mínima2.5, vertical máxima7.5 y hasta ocho subpasos por actualización. El pico refleja velocidad al tocar superficies; no es sólo una animación encima de mineros BFS. Acumula trabajo de su herramienta y sólo un contacto real puede gastarlo en HP. Las explosiones conservan alcance de área, y `!mine` añade trabajo para el próximo contacto.

Al superar la fila25, descarta12 filas superiores y genera12 inferiores; `rowOffset` registra profundidad absoluta. Reubica entidades, partículas, efectos e índices de explosiones pendientes y conserva sus límites. No reinicia escenario ni puntuación. `phase` permanece `playing`, `remaining=0`; cada180s de juego cambia únicamente el ciclo lógico `round` para que vuelvan a funcionar los votos gratuitos. No es un final de partida.

La app usa timestep de50ms, máximo cinco pasos por frame y descarta recuperación al volver de suspensión. El motor limita `dt` a0.25s. La cámara de endless coloca el cuerpo cerca del62% de la altura, avanza sin perseguir hacia arriba cada rebote y resta las filas descartadas para conservar continuidad. Suaviza con tasa7/s y delta visual máximo0.1s; un reset explícito se detecta al retroceder tiempo u offset. Reducir movimiento conserva física y resultados y elimina partículas y giro decorativo. La fuerza mostrada es trabajo potencial: no garantiza extracción a una tasa fija de bloques/s en este modelo de contacto.

Los modos finitos anteriores se conservan: `arena` usa rondas por tiempo/objetivo y `shaft` termina al alcanzar el piso. La regresión que hacía volver el pico a paredes superiores tras excavar abajo tiene prueba reproducible; esa solución finita no interrumpe `endless`.

## Eventos verificables

TNT, Mega, Nuke y Jackpot difieren en tamaño/radio; Jackpot sólo duplica puntos virtuales. Arrow excava una línea; Thunder una columna; Tsunami una banda. Fire, Rain y TNT Rain lanzan ráfagas con aspecto y magnitud distintos. Meteor impacta un área; Black Hole atrae partículas y colapsa bloques hacia su centro. Rainbow cambia fuerza y bonifica minerales; Butterfly evita desgaste y cambia trayectoria de selección en shaft; Demon aumenta fuerza, puntos y desgaste; Spin, Fast y Big cambian fuerza, giro o excavación lateral. En endless, todos actúan sobre la herramienta física y sus contactos, conservando explosiones remotas por diseño. No hay dinero ni premios canjeables.

Entidades+cola:24; partículas:160; VFX:24. Máximo40 operaciones de bloque por actualización, hasta32 para explosiones. NUKE tiene cooldown global45s; los otros valores constan en `config.js`. Chat acepta una allowlist con cooldown global10s y por identidad/fuente15s. Pausa, emergencia, dedupe y límites permanecen activos. Ver [CATALOG.md](CATALOG.md).

## Pruebas ejecutadas y réplica

```powershell
npm test
npm run check
npm run test:endless-soak
$env:SOAK_HOURS='6'; npm run test:block-soak
```

El registro de esta tarea confirma las pruebas específicas de motor, física, pozo y catálogo; el coordinador debe registrar por separado el resultado final de la suite completa y del navegador. No se afirma aquí que un comando haya pasado sólo por estar listado.

`npm run test:endless-soak` ejecutó seis horas virtuales en dos motores paralelos, normal y movimiento reducido:432000 pasos,21240s de juego tras pausas,117 renovaciones de voto y ciclo lógico118, sin resúmenes. Alcanzó profundidad25674.69 celdas,2138 corrimientos,66469 colisiones y excavó las siete columnas. Incluyó360 pausas,72 emergencias y4320 duplicados. Máximos: entidades15, cola4, conjunto15/24, partículas160, VFX14 y32 bloques removidos por paso. Replay físico del modo reducido idéntico. Tiempo real observado4.18s en Node; no equivale a seis horas reales de emisión.

El soak compatible de arena/shaft también ejecutó seis horas virtuales por modo: arena513 rondas; shaft1293 rondas y432000 pasos. En shaft, entidades20, cola3, conjunto20/24, partículas160, VFX21 y32 bloques removidos por paso. Los18 eventos y cinco picos tuvieron acciones aceptadas; se verificaron1440 duplicados y se ignoraron2880 fixtures pagados. Las etiquetas `tikfinity` de estas pruebas son datos sintéticos, no una conexión real.

Pendientes: revisión visual final en movimiento y dispositivo real; sesión prolongada de navegador/OBS; eventos reales de la versión instalada de TikFinity y permisos de la cuenta. No se activaron publicación ni regalos. Las capturas de referencia y las pruebas Node no acreditan esas condiciones.
