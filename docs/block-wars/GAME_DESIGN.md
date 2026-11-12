# Game Design Document — Block Wars LIVE

**Versión:** 0.1 / diseño. **Implementación:** ensayo local; ver REFERENCE_IMPLEMENTED.md. **Plataforma:** navegador + OBS en vertical.

**Actualización del propietario:** la app visible es una excavación infinita, sin final ni reinicio automático de puntajes. El pico cae y rebota con colisiones físicas; el terreno se renueva con memoria acotada. Las rondas finitas descritas abajo se conservan sólo en los modos anteriores. La app usa las diez etapas originales de grietas de Minecraft importadas localmente. Ver [motor vigente](ENGINE.md).

## 1. Fantasía de juego

Un enorme mapa de roca y minerales se excava en directo. Un **equipo oscuro (DARK)** y un **equipo luminoso (LIGHT)** compiten por destruir zonas, encontrar objetivos y dominar rondas. Los espectadores eligen bando gratuitamente y provocan acontecimientos visuales mediante participación en el chat, likes y follows.

Inspiración de lectura visual: bloques cúbicos, capas geológicas, minerales, pico y TNT; implementación **original en 2 D con acabado pixel art**, profundidad simulada y animaciones propias. El producto y las miniaturas NO deben usar la denominación o el logotipo Minecraft.

## 2. Bucle de la partida

1. Generar un mapa nuevo mediante semilla (reproducible para depuración), con vetas, roca, tierra y cámaras, además de una frontera DARK/LIGHT.
2. Abrir elección de equipos con `!dark` y `!light`; permitir participación aun sin seguir ni enviar regalos.
3. Mineros automáticos de ambos equipos dañan bloques de forma continua y visible.
4. Interacciones gratuitas disparan acciones con límite por usuario y por tipo de evento. El motor distribuye el daño mediante una cola para evitar congelaciones.
5. Cada 45–90 segundos, programar un acontecimiento gratuito que pueda variar el mapa (temporizador configurable).
6. Al terminar la ronda (tiempo o objetivo), declarar resultado por puntuación transparente, mostrar resumen y arrancar otra ronda sin intervención manual. Empates permitidos.
7. Mantener un indicador de estado LIVE/DEMO verificable. La partida no debe depender de recibir regalos para continuar.

## Sistema ampliado de picos y encantamientos

Se incorpora como parte del diseño de Block Wars el sistema de **picos de madera, piedra, oro, diamante y netherita**, cada uno con **velocidad de excavación, durabilidad y apariencia visual distintas**, además de **Eficiencia I–V**, Irrompibilidad, Fortuna, Prisa/Turbo y un modo temporal **DESCOMUNAL**. Oro puede ser el más rápido pero muy frágil; madera es marcadamente lenta; diamante/netherita resisten minería sostenida. **TNT, meteoritos y NUKE siguen vigentes**, con explosiones masivas compatibles con el motor de minería. Todo se desbloquea/probará mediante mecánicas gratuitas en la etapa inicial.

Especificación completa con tabla de velocidades, multiplicadores, comandos, interacciones y pruebas: [PICKAXES_AND_EVENTS.md](PICKAXES_AND_EVENTS.md).

## 3. Materiales y estética

- **Bloques:** piedra gris, tierra rojiza, obsidiana ficticia, cristal azulado, mineral dorado, magma y nubes. Texturas y siluetas **creadas desde cero**.
- **Bandos:** DARK usa tonos violeta/grafito; LIGHT usa cian/ámbar. Diferenciar además con iconos y patrones, no solo por color.
- **VFX:** pequeñas partículas, fracturas, ondas expansivas y vibración visual moderada; evitar destellos excesivos y efectos estroboscópicos.
- **Audio:** opcional, propio o con licencia comprobada; modo silenciado para OBS.
- **Personajes:** herramientas, mineros y monstruos propios; no copiar mobs, personajes, menús ni animaciones de Minecraft.

## 4. HUD vertical (720 × 1280)

Zona superior: título BLOCK WARS LIVE, nombre del evento, banda de estado de conexión. Zona media: **área principal del juego**, siempre dominante y legible en móvil. Zona inferior: marcador DARK vs LIGHT, objetivo de ronda, barra de likes agregados, siguiente evento gratuito y CTA discreto de `!dark` / `!light`. La interfaz debe dejar espacio para elementos superpuestos del chat de TikTok y sus botones.

Nunca tapar más de lo necesario con mensajes de regalos; alertas breves y sin engaños. Las métricas muestran origen real y estado “dato no disponible” si falla la fuente.

## 5. Acciones GRATIS — prioridad absoluta

| Evento | Efecto previsto | Restricción inicial |
| --- | --- | --- |
| Comentario `!dark` / `!light` | Elegir/cambiar bando | 1 cambio cada 60 s |
| Comentario `!mine` | El equipo del usuario golpea un bloque | Máx. 1 cada 15 s por usuario |
| Comentario `!rain` | Voto para lluvia de materiales | Máx. 1 voto por ronda |
| Comentario `!boom` | Añadir carga a un explosivo comunitario | Máx. 1 cada 30 s |
| Likes agregados | Cada **25 likes** llenan una carga de TNT comunitaria | Acumular por incrementos y agrupar efectos |
| Nuevo follow confirmado | 1 refuerzo visual del equipo si se conoce; si no, neutral | Deduplicar evento |
| Temporizador | Evento aleatorio de juego **gratuito** cada ~60 s | Semilla de aleatoriedad controlada |
| Visualizaciones / espectadores | Datos del HUD y análisis, **no efectos por usuario** sin fuente confiable | Nunca inventar |

Los umbrales son propuestas de configuración para probar; no se afirma que TikTok entregue todos estos eventos con idéntica precisión. La conversión de likes a TNT se realiza por **umbral global**, no una explosión pesada por pulsación.

### Eventos gratuitos de mapa (pool inicial)

- Lluvia de minerales; lluvia de TNT de bajo daño; lluvia de meteoritos pequeños; pulso de excavación; terremoto localizado; escudo de área.
- Cada evento tiene duraciones/costes/cooldowns. Se limita su concurrencia y nunca se necesita un regalo para verlo.
- RNG solo para efectos del juego sin premios de valor monetario o canjeable.

## 6. Lo que NO haremos al inicio

No enseñar una tabla de precios de regalos, reservar las partidas a compradores, hacer “paga para ganar”, pedir suscripciones pagadas, prometer pagos por likes, vender premios aleatorios ni crear actividades orientadas a apuestas.

## 7. Preparación visual para una fase posterior (desactivada)

Mantener categorías internas de eventos `small_effect`, `medium_effect` y `big_effect`, no asociadas inicialmente a regalos. Más adelante podrán mapearse a nombres/IDs reales validados por el creador, sin bloquear las opciones gratuitas.

## 8. Accesibilidad, usabilidad y moderación

- Fuentes grandes, texto contrastado, animaciones que permitan seguir la acción.
- Modo “reducir movimiento”, controles de volumen, botones de pausa/reinicio de emergencia.
- Sanitizar nombres públicos y chat antes de dibujar; no revelar identificadores internos.
- Filtrar spam y contenido ofensivo; conservar solo métricas mínimas.
- Mostrar la ayuda de comandos gratis mediante overlay rotativo no intrusivo.

## 9. Criterios de aceptación del juego

- Motor autónomo en el navegador en 720 × 1280, con rondas finitas y regeneración.
- Modo DEMO reproducible con simulador, sin LIVE ni monedas.
- Tres acciones gratuitas funcionan en primera iteración: cambio de equipo, likes→TNT y evento programado; ampliar luego.
- Ningún efecto visual permite colgar la interfaz con ráfagas de eventos.
- El diseño es original, identificable y legible en teléfono.
