# Comentarios y los 14 comandos seleccionados

Selección aprobada por el propietario: propuestas 1–14. Estado: implementación para ensayo local en la rama `codex/minecraft-comment-experience`; no acredita eventos reales de TikTok o YouTube ni reproducción real de ElevenLabs.

## Participación y respuesta

El menú público muestra TNT, RAIN, THUNDER, STORM, CREEPER, METEOR, FIRE, TSUNAMI, SPIN, FAST, MEGA, NUKE, ARROW y BIG, en ese orden. Los automáticos de excavación infinita también eligen sólo estos comandos. El catálogo interno conserva los 18 anteriores y añade STORM/CREEPER: 20 efectos compatibles, sin retirar Snake, arena o shaft.

Mayúsculas/minúsculas y el prefijo opcional `!` no cambian el efecto. `rain`, `!rain`, `TNT RAIN` y `TNTRAIN` seleccionan la misma lluvia de TNT. **Migración:** la antigua votación de `!rain` se conserva como `!voterain`, con un voto por identidad/ciclo y el mismo umbral. No mostrar ambas acciones como si aún compartieran el mismo comando.

La acción aceptada recibe un ID local, una tarjeta con nombre moderado y origen, una señal sonora de activación y narración opcional. El motor conserva autor/origen/ID en sus entidades, impactos y zonas persistentes. La señal de impacto se reproduce al producirse el impacto, sin otra petición TTS. La tarjeta caduca a los 8 segundos; la etiqueta del proyectil conserva su autor mientras existe.

El circuito del panel pasa por contrato del servidor, SSE y adaptador compartido: la identidad ficticia se usa también como nombre visible, en vez de reemplazarla por «Prueba local». Los eventos agregados de likes/votación no atribuyen la acción al último comentarista. Los automáticos dicen «Evento de la mina»; las pruebas conservan «PRUEBA». No se lee chat libre ni se usa `%user%` literal.

## Comportamiento implementado

Estas mecánicas son personalizadas para la mina 2D; no equivalen a reglas vanilla. Tiempos, daño y límites están en `config.EVENTS` y `config.MINECRAFT_EFFECTS`, no son límites de TikTok.

| Comando | Comportamiento en endless |
| --- | --- |
| TNT | Carga física que cae, rebota, descansa en terreno y consume su mecha antes de explotar. |
| RAIN | Ocho TNT con salidas escalonadas cada 0.55 s; física, mecha e impactos independientes, con el mismo autor. |
| THUNDER | Lluvia original de Minecraft y tres pulsos eléctricos durante 4 s que destruyen columnas acotadas. |
| STORM | Seis segundos de lluvia/viento; el viento modifica la velocidad del pico y el granizo de hielo provoca impactos destructivos. |
| CREEPER | Sprite frontal de la skin original; cae, se apoya, enciende una mecha de 1.3 s y explota. |
| METEOR | Magma con estela de fuego; daña bloques durante su trayectoria antes del impacto final. |
| FIRE | Cuatro proyectiles de fuego; sus impactos dejan zonas que dañan bloques durante 3 s. |
| TSUNAMI | Ola de agua que cruza la mina, erosiona bloques por pulsos y empuja físicamente al pico cercano. |
| SPIN | Giro acelerado y mayor trabajo de minería; el daño del pico sigue requiriendo contacto físico. |
| FAST | Prisa visual, mayor fuerza y velocidad física; mantiene los subpasos de colisión. |
| MEGA | TNT gigante con huella física acorde a su tamaño, mecha de 2 s y cráter mayor. |
| NUKE | Supercarga TNT/redstone, mecha de 3 s y tres centros de explosión procesados con presupuesto común; enfriamiento global de 45 s de juego. |
| ARROW | Ráfaga de cuatro flechas desde dispensadores; cada impacto daña el bloque alcanzado. |
| BIG | Aumenta el radio real de colisión del pico y amplía los golpes alrededor de bloques destruidos por contacto. |

Las cargas grandes necesitan una abertura acorde con su tamaño: no atraviesan paredes para alcanzar al pico. Si la excavación aún es estrecha pueden descansar sobre la entrada; un indicador visible conserva miniatura, autor y mecha real cuando la carga queda encima del encuadre. El tiempo total incluye caída y mecha; el HUD muestra «EN CURSO» si hay trabajo pendiente después de la duración nominal. Ningún efecto finaliza la excavación infinita.

## Rechazo y límites

Se mantienen 10 s globales entre efectos de chat y 15 s por identidad, más el enfriamiento propio del motor. La respuesta distingue pausa, espera global, espera personal, enfriamiento del efecto, falta de equipo y motor ocupado. Cuando el tiempo es conocido se indica el restante observado; una acción rechazada no genera tarjeta de activación ni narración y no consume un cooldown nuevo.

Chat normal y duplicados no sustituyen la tarjeta vigente. Un efecto destructivo de chat espera a que dejen de existir los proyectiles, clima o fuego anteriores: **no hay una cola nueva de peticiones de espectadores** ni una promesa de ejecución posterior. La cola interna del motor procesa daño limitado; la cola de voz mantiene sus límites independientes.

Pausa congela el motor y cancela audio pendiente. Emergencia limpia clima, proyectiles, fuego, cargas comunitarias y tarjetas. Reanudar no reproduce locuciones antiguas. Los IDs de voz automáticos son únicos por sesión y secuencia, aunque el motor se reinicie determinísticamente; la tarjeta conserva además su referencia al ID del motor.

Los resultados internos cuentan sólo destrucción directa atribuible a esa acción, con un máximo de 64 registros en memoria. No se muestra un resumen falso de contribución para FAST/SPIN/BIG ni se convierte el conteo en dinero, espectadores o ingresos.

## Probar y revertir

```powershell
python scripts/import_minecraft.py
npm test
npm run check
npm run test:endless-soak
node server.js
```

Abrir `/block-wars` y `/block-wars/control`. En el panel, «Ensayar como comentario» está marcado: elegir una identidad ficticia y pulsar RAIN debe conservar nombre y «PRUEBA» en la mina. Enviar otro efecto inmediatamente debe explicar la espera y conservar al autor anterior. Al desmarcar esa opción, el banco vuelve a acciones directas del operador. Los efectos anteriores siguen disponibles en su sección desplegable.

Comprobar los 14, pausa/emergencia, recuperación sin ElevenLabs y modo de movimiento reducido. [Resultados ejecutados y límites](MINECRAFT_COMMANDS_VERIFICATION.md). Las pruebas aceleradas no sustituyen OBS/CEF durante 120 minutos ni eventos reales. Recursos y procedencia: [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md). La voz real y la integración de plataformas siguen pendientes.

Reversión: volver a la rama anterior o revertir el commit de esta fase; reiniciar el servidor local y recargar la fuente. Las texturas ignoradas y sus respaldos no se borran. La versión anterior puede seguir usando sus 34 texturas base.
