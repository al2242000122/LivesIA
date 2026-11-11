# Especificación técnica — Block Wars LIVE

**Estado:** arquitectura objetivo, no código ya implementado. Preservar el prototipo de serpiente.

## Arquitectura evolutiva

```text
[TikTok LIVE / TikFinity] ----+
                             v
[Simulador de eventos] -> [Adaptador normalizado] -> [Bus con límites y deduplicación]
                                                  |              |
                                                  v              v
                                           [Block Wars]     [Snake existente]
                                                  |
                                                  v
                                          [Canvas / HUD OBS]
                                                  |
                                       [Panel privado de creador]
```

Fase inicial: mantener Node.js + JavaScript/Canvas 2D + HTTP localhost + SSE y WS ya existentes. No es obligatorio introducir framework ni cambiar estructura de carpetas completa. La nueva implementación puede añadirse bajo `games/block-wars/` y `integrations/`; extraer el adaptador compartido en PR independiente y con pruebas.

## Modelo de eventos propuesto

```js
{
  type: "like" | "comment" | "follow" | "subscribe_paid" | "gift" | "viewer_count",
  source: "simulator" | "tikfinity",
  id: "event-id-or-derived-key",
  receivedAt: 0,
  actor: { displayName: "sanitized", stableHash: "ephemeral" },
  data: { delta: 1, text: "!dark", giftId: null, count: 1 }
}
```

- El esquema es **interno** y no se presenta como formato oficial TikTok/TikFinity.
- En `viewer_count` se exige un agregado confiable y se identifica si es una estimación. No sintetizar eventos `user_joined` basados en contadores.
- Cada adaptador debe conservar metadatos mínimos de procedencia para depurar, sin guardar mensajes crudos ni PII innecesaria.
- Deduplicar por `source + id` con ventana de expiración; gestionar contador de likes acumulado sin duplicar ráfagas.
- Validar tipos, longitud de nombres/texto, números finitos y tasas; descartar entradas malformadas y registrar contadores agregados.

## Separación de dominios

- **Engine**: mapa procedural, daño por bloque, colisiones, efectos, puntuación y duración de ronda; puro/testeable donde sea posible.
- **Gameplay rules**: configuración explícita de `likeThreshold`, comentarios, follow bonus, cooldown y temporizador.
- **Transport**: WebSocket a TikFinity y SSE/HTTP de prueba local, con reconexión y estado conectado/sin eventos verificados.
- **Render**: lienzo vertical 720 × 1280, accesible, tasa de frames predecible y efectos limitados.
- **Control**: botones de pruebas, cambio de modo, ajustes, pausa y botón de emergencia; sólo accesible desde loopback.

El panel no debe exponerse a Internet. Proteger peticiones de control frente a sitios externos, añadir comprobaciones de origen/CSRF o token local, y mantener `127.0.0.1` como valor predeterminado.

## Especificación de herramientas de minería y grandes explosiones

Los cinco picos, sus velocidades base, durabilidades, encantamientos, modo de velocidad DESCOMUNAL y eventos **TNT / NUKE** se definen en [PICKAXES_AND_EVENTS.md](PICKAXES_AND_EVENTS.md). Codex debe modelar estadísticas y modificadores por configuración, aplicar acumulación fraccional y excavación por lotes para velocidades extremas, y limitar partículas/daño por actualización durante explosiones masivas. Incluir pruebas reproducibles de diferencias de velocidad, desgaste, Eficiencia V, eventos concurrentes y reinicio seguro. El acceso inicial es gratuito por diseño; ningún regalo es requisito para los picos.

## Calidad y antispam

- Cola de eventos con presupuesto por frame y máximo por tipo; agrupar likes en contadores.
- Como ejemplo, un bloque de 25 likes programa 1 TNT; el motor no debe instanciar 1 explosión por cada like individual.
- Cooldowns por actor/acción, límite de efectos simultáneos, máximo de partículas y liberación de recursos.
- `requestAnimationFrame` para render; timestep fijo o semi-fijo para la simulación (reanudación segura después de suspensión).
- Reconexión con backoff, indicadores LIVE/DEMO/OFFLINE verificables, manual override de emergencia.
- Parámetros configurables sin alterar la lógica principal ni almacenar tokens en repositorio.

## Interfaz OBS y modo demo

- URL de juego separada de URL de control: por ejemplo `/block-wars` y `/control`; **no se afirma que ya existan**.
- Overlay vertical 720 × 1280; dejar márgenes seguros para UI superpuesta de TikTok.
- Mostrar claramente `DEMO` cuando la fuente sea simulada; nunca fingir regalos reales.
- Un loop de video solo podría decorar el fondo; la simulación debe funcionar en vivo.
- La emisión y elegibilidad LIVE deben verificarse mediante configuración de la cuenta y políticas vigentes.

## Pruebas previstas

1. Unitarias: excavación, daño, generación determinista, victoria/empate, cooldown y umbrales de likes.
2. Integración: comentarios válidos/incorrectos, eventos duplicados, desconexión de WS, normalización de rachas y controles locales.
3. Carga: ráfagas de likes/comentarios, gestión de memoria, partículas limitadas, recuperación sin bloqueo.
4. OBS: legibilidad en teléfono, cambios de escena, overlay no cortado, 30/60 FPS según equipo.
5. Regresión: serpiente, panel existente, `node server.js`, puerto loopback y eventos simulados mantienen su funcionamiento.

## Riesgos conocidos

Un adaptador no oficial de terceros puede cambiar sin aviso y no sustituye permisos de TikTok. La precisión/disponibilidad de vistas, viewers, follows, subs de pago y regalos varía por cuenta y proveedor. Marcar cada métrica como verificada/no disponible. Revisar licencias de imágenes, sonidos y bibliotecas. Evitar guardar información personal de espectadores y nunca publicar credenciales.
