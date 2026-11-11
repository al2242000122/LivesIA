# Block Wars LIVE — Diseño y ruta de producto

> **Estado:** concepto y especificación para Codex; **todavía no implementado**. El único prototipo ejecutable en la raíz de LivesIA es Serpiente Infinita LIVE.

## Visión

Crear un juego original de destrucción de bloques estilo **pixel art / voxel 2D** para TikTok LIVE. En vertical (720 × 1280) se muestra un mundo que se mina y destruye **en tiempo real**. Dos equipos —**DARK** y **LIGHT**— compiten mediante participaciones gratuitas. El mundo se regenera en rondas y tiene eventos periódicos para que el LIVE sea atractivo incluso sin regalos.

El objetivo inicial NO es cobrar: **atraer audiencia real, conseguir seguidores, acumular likes, lograr participación en el chat y mejorar la retención**. Los regalos y suscripciones de pago son una fase posterior opcional.

### Plan en una frase

**Gratis primero → comunidad y retención → regalos opcionales**.

## Terminología importante

- **Seguidor / follow:** acción gratuita de seguir al creador.
- **Suscripción de LIVE / sub:** función potencialmente de pago, *distinta* de un follow. No usar “SUB” para referirse ambiguamente a ambas.
- **Likes:** interacciones gratuitas; NO son monedas, ingresos ni espectadores únicos.
- **Espectadores actuales / visualizaciones:** métricas diferentes; no se debe simular, inventar ni asumir disponibilidad en tiempo real.
- **Regalos:** artículos virtuales adquiridos con monedas; el importe gastado por el espectador NO equivale automáticamente al ingreso del creador.

## Documentos de esta modalidad

1. [GAME_DESIGN.md](GAME_DESIGN.md) — universo visual, dinámica, comandos, HUD y flujo de las partidas.
2. [GROWTH_AND_MONETIZATION.md](GROWTH_AND_MONETIZATION.md) — estrategia gratuita, indicadores y posterior monetización.
3. [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) — arquitectura evolutiva, contratos de eventos, pruebas, OBS y seguridad.
4. [CODEX_BACKLOG.md](CODEX_BACKLOG.md) — tareas ordenadas y criterios para aprobar PRs.
5. [PICKAXES_AND_EVENTS.md](PICKAXES_AND_EVENTS.md) — picos y velocidades diferentes; encantamientos, TNT, NUKE y velocidad DESCOMUNAL.

## Prioridades irrevocables

1. Mantener **Serpiente Infinita** funcional: no borrarla ni reescribirla como requisito del nuevo modo.
2. No copiar Minecraft: **no usar marcas, texturas, skins, sonidos, nombres comerciales o assets de Mojang/Microsoft**. “Estilo Minecraft” es solo una referencia conceptual; todo el arte será original.
3. No reproducir una partida grabada como si fuese un LIVE interactivo: las mecánicas y respuestas deben ocurrir **en tiempo real**. Un fondo artístico en loop, si se usa, no sustituye al juego.
4. No fabricar métricas, bots de likes/espectadores, engagement falso, premios canjeables por regalos ni mensajes de presión.
5. Trabajar mediante **rama + pull request**; no cambiar `main` sin revisión del propietario.

## Estado real frente a aspiraciones

| Capacidad | Situación |
| --- | --- |
| Juego de serpiente + simulación de eventos | MVP existente, requiere validación en LIVE real |
| Block Wars LIVE | Documentado; pendiente de implementar |
| Eventos gratuitos reales de TikTok | Adaptador por verificar con eventos reales y permisos |
| Captura OBS vertical | Flujo de referencia definido; prueba presencial pendiente |
| Monetización con regalos | **Fuera del MVP inicial**; depende de elegibilidad y políticas |

**Plataformas y referencias:** [TikTok: recomendaciones del LIVE](https://support.tiktok.com/es/using-tiktok/exploring-videos/how-tiktok-recommends-content), [TikTok: Diamantes](https://support.tiktok.com/es/business-and-creator/video-gifts-on-tiktok/diamonds), [TikTok: política de artículos virtuales](https://t.tiktok.com/legal/page/row/virtual-items/es).
