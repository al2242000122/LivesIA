# Block Wars LIVE — Picos, encantamientos y eventos destructivos

> **Estado:** especificación de funcionalidad pendiente de implementar en el modo Block Wars. No afecta al prototipo de Serpiente Infinita. Mantener la estrategia **gratis primero**: progresión mediante participación legítima, likes y comentarios; regalos de pago solo en una etapa posterior.

## Idea principal

Añadir **cinco tipos de pico** con una sensación de avance visual fuerte. Algunos romperán bloques lentamente; otros tendrán **velocidades descomunales**, especialmente al combinar materiales, encantamientos y aceleraciones temporales. El propietario actualizó el diseño el2026-11-11: los cinco picos y bloques utilizan texturas originales de Minecraft importadas localmente, fuera de Git. Esta indicación sustituye la anterior de arte totalmente original. No se importa audio. Ver [procedencia y límites](MINECRAFT_ASSETS.md) y [resultado implementado](REFERENCE_IMPLEMENTED.md).

Los nombres solicitados para el diseño son **madera, piedra, oro, diamante y netherita**. Son referencias de jugabilidad; la identidad gráfica de LivesIA y sus materiales visuales debe ser propia.

## Propuesta de balance inicial (ajustable por configuración)

| Pico | Velocidad base (bloques sencillos/seg.) | Durabilidad orientativa | Personalidad |
| --- | ---: | ---: | --- |
| Madera | 0.6 | 20 | Lento, básico; golpe marcado |
| Piedra | 1.0 | 40 | Estable y económico |
| Oro | 2.8 | 12 | **Extremadamente rápido**, pero se desgasta pronto |
| Diamante | 1.75 | 120 | Rápido, resistente, ideal para mantener la minería |
| Netherita | 2.2 | 180 | Poder sostenido, resiste mejor eventos destructivos |

**Estas cifras son de Block Wars, no estadísticas oficiales de Minecraft.** Medir en el prototipo real y ajustar para que se perciba claramente la diferencia incluso en pantallas pequeñas. Las unidades representan bloques blandos de dureza 1. Para bloques más duros, aplicar `tiempo_por_bloque = dureza / velocidad_efectiva`. Ningún pico debe quedar atrapado en una acción irrealizable: si existe bloque indestructible, señalarlo visualmente y elegir otra ruta.

**Progresión gratuita:** desbloquear mejoras por hitos dentro de la partida, acciones del equipo, likes comunitarios y objetivos temporales. No requerir suscripciones pagadas ni regalos para conseguir o probar picos potentes durante la etapa de crecimiento. Un minero automático debe seguir jugando aunque haya cero espectadores.

## Encantamientos y multiplicadores (configurables)

### Eficiencia I–V

| Nivel | Multiplicador de velocidad |
| --- | ---: |
| Sin eficiencia | ×1.0 |
| Eficiencia I | ×1.3 |
| Eficiencia II | ×1.7 |
| Eficiencia III | ×2.5 |
| Eficiencia IV | ×4.0 |
| Eficiencia V | ×6.0 |

Ejemplo: **madera sin encantamiento: 0.6 bloques/s**; **oro con Eficiencia V: 16.8 bloques/s**; **netherita con Eficiencia V: 13.2 bloques/s** antes de considerar dureza o aceleraciones. Son metas de simulación; el dibujo no necesita producir una animación por cada golpe.

### Otros encantamientos y estados

- **Irrompibilidad I–III:** disminuye probabilísticamente el desgaste por bloque, con semilla verificable y límites.
- **Fortuna I–III:** aumenta puntos/minerales virtuales por vetas extraídas; **nunca dinero, regalos, monedas TikTok ni premios canjeables**.
- **Toque preciso (opcional):** permite extraer algunos bloques especiales sin destruirlos, útil para objetivos de equipo; no combinar con Fortuna si genera conflicto de reglas.
- **Prisa / Turbo (estado temporal):** multiplicador adicional de velocidad otorgado por evento de comunidad o temporizador; duración fija y enfriamiento.
- **Modo DESCOMUNAL (evento raro, gratuito al inicio):** aceleración temporal muy alta (**×3 sobre la velocidad efectiva**, configurable) para momentos espectaculares; usar límites de simulación y partículas para conservar FPS.

La fórmula propuesta es:

```text
velocidad_efectiva = velocidad_base * multiplicador_eficiencia * multiplicador_prisa * multiplicador_evento
tiempo_por_bloque = dureza_del_bloque / velocidad_efectiva
```

El estado debe dejar claro el material, encantamientos, duración restante de buffs y la tasa efectiva. Al agotarse la durabilidad, cambiar automáticamente al pico disponible o esperar reparación gratuita, sin detener la transmisión.

## Cómo interactúa la comunidad (etapa inicial, SIN PAGAR)

- Comando `!pico`: mostrar o consultar el pico activo del equipo sin editar archivos del juego.
- `!madera`, `!piedra`, `!oro`, `!diamante`, `!netherita`: votar **qué pico utilizará el equipo** cuando esté desbloqueado. Un voto por usuario y ventana, antispam.
- Likes acumulados: además de cargar la TNT comunitaria definida en el diseño principal, contribuir a un **medidor de mejora de equipo** que puede dar Eficiencia durante unos segundos. No recompensar cada like con una operación de minería individual.
- Comentarios o objetivos de ronda: activar mejoras temporales, reponer durabilidad o recibir un pico dorado ultrarrápido limitado.
- Nuevo follow verificado: agradecimiento visual discreto y aporte al medidor comunitario; no excluir a quienes no sigan.
- Las interacciones pueden pertenecer a un equipo DARK/LIGHT; ambos conservan caminos equivalentes a mejoras mediante acciones gratuitas.

En modo DEMO, todos los comandos, votaciones, encantamientos y efectos deben probarse desde un simulador, sin depender de eventos reales de TikTok.

## Eventos destructivos existentes y nuevos

**Mantener TNT, lluvias, meteoritos y la NUKE** como mecánicas visuales espectaculares del juego. Las herramientas de minería y las explosiones tienen **roles distintos**:

| Evento | Impacto previsto | Acceso en crecimiento |
| --- | --- | --- |
| TNT comunitaria | Radio pequeño, rompe un conjunto de bloques | Umbral de likes / temporizador |
| Lluvia de TNT | Varios impactos repartidos | Evento gratuito periódico |
| Meteorito | Golpe localizado con partículas | Votación / evento periódico |
| **NUKE** | **Explosión masiva**, ondas, cráter visible y transición de cámara | **Evento especial raro gratuito** durante el MVP |
| Megaexcavación | Mineros de ambos bandos con turbo temporal | Objetivo comunitario |
| Fiebre del oro | Pico de oro ultrarrápido durante pocos segundos | Objetivo / evento gratuito |
| Modo DESCOMUNAL | Pico encantado, excavación a velocidad extrema | Evento raro / hito de likes |

La NUKE **no debe terminar el LIVE ni bloquear las rondas**; tras la explosión el mapa debe regenerarse o continuar de manera coherente. Se requiere enfriamiento global, protección contra superposición con TNT/meteoritos y un modo visual de movimiento reducido.

### Futura etapa de regalos (DESACTIVADA inicialmente)

Cuando la cuenta sea elegible, se podrán **asociar efectos cosméticos y acontecimientos especiales a regalos verificados**: por ejemplo, una NUKE de celebración o un turbo breve. No introducirlos como requisito para usar picos ni hacer que donaciones sean la única manera de activar el contenido interesante; mantener efectos equivalentes gratuitos, sin presionar para gastar.

## Requisitos técnicos y pruebas

1. Representar cada pico como configuración `{ id, baseSpeed, durability, appearance, unlockRule }`, con modificadores independientes y estado temporal; ninguna tabla de atributos debe estar fija en el render.
2. La velocidad extrema debe procesarse por **acumulación de progreso y lotes de daño/excavación por tick**, no una animación/DOM/partícula por bloque. Límite configurable de bloques por actualización y cola acotada.
3. Durabilidad, cambios de pico, encantamientos temporales y eventos explosivos deben ser deterministas en DEMO con semilla; pruebas unitarias del balance, agotamiento y reinicios.
4. Probar pausas, cambios de equipo, reconexiones, muchos likes y explosiones simultáneas, garantizando que ninguna rompe el HUD, el puntaje ni la continuidad de la ronda.
5. Mostrar velocidad comparativa en un panel de prueba (p. ej., madera normal vs oro encantado), medir FPS y consumo de memoria y permitir reducir partículas.
6. Los eventos de TikTok son **fuentes externas no confiables**. Validarlos, deduplicarlos, aplicar cooldowns y distinguir simulación de señales reales.
7. No escribir código ni alterar funciones de Serpiente Infinita como parte de esta especificación; implementar posteriormente en PR separado si procede.

## Criterio de éxito

El espectador reconoce sin explicación que **madera es lenta**, **oro puede ser absurdamente rápido**, **diamante/netherita soportan minería prolongada** y **Eficiencia V / DESCOMUNAL transforman radicalmente el ritmo**. La TNT y la NUKE siguen ofreciendo momentos memorables, pero **el juego permanece entretenido y totalmente participativo sin regalos pagados**.
