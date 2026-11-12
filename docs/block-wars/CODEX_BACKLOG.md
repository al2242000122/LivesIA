# Backlog implementable para Codex — Block Wars LIVE

> Usar `AGENTS.md` de la raíz y las especificaciones de esta carpeta. **No implementar en `main` directamente.** Mantener el modo serpiente intacto.

## Orden de PRs recomendado

### Encargo actual — Experiencia LIVE (PLANNED)

Los PRs de estabilización, modos y excavación infinita ya contienen código para ensayo local; la secuencia histórica de abajo no refleja su estado individual de merge. La siguiente fase está en [LIVE_EXPERIENCE_GOALS.md](LIVE_EXPERIENCE_GOALS.md).

Primer incremento: confirmaciones de acción/rechazo, narración ElevenLabs y sonidos/efectos diferenciados para TNT, NUKE y recompensa de comentario. Sin cámara. Nombres moderados, cola acotada, silencio/emergencia y presupuesto de voz; mantener minería infinita, 18 comandos y Snake. Luego ampliar al catálogo y follows reales. Suscripciones pagadas/regalos requieren sus eventos y elegibilidad verificados.

Aceptación: objetivos O1–O4 y ensayo OBS real de 120 minutos; métricas de audiencia sólo de sesiones reales, sin equiparar el soak acelerado a una transmisión ni declarar integración de voz antes de escucharla en OBS.

### PR 1 — Auditoría de arquitectura y tests del MVP
- Leer y ejecutar el proyecto en modo local.
- Añadir pruebas mínimas a la serpiente y servidor para no romper funcionalidades.
- Documentar errores reproducibles y un plan de migración incremental.
- No instalar grandes frameworks sin justificación.

**Aceptación:** modo serpiente y controles actuales siguen operativos.

### PR 2 — Adaptador de eventos normalizado y simulador
- Separar eventos de TikFinity de la lógica del juego.
- Definir esquema, validación, deduplicación, contadores likes y modo demo.
- Reusar el mismo adaptador desde ambos juegos.
- No declarar soporte de métricas que el proveedor no exponga de forma comprobable.

**Aceptación:** pruebas de duplicados, reconexión, ráfagas y procedencia pasan.

### PR 3 — Motor 2D de bloques con gráficos originales
- Añadir modo alternativo Block Wars (no reemplazar el modo serpiente).
- Mundo procedural, mineros automáticos, destrucción de bloques, puntuación DARK/LIGHT, reinicios.
- HUD vertical y contador de evento periódico.

**Aceptación:** partida completa y automática con cero audiencia; captura OBS 720 × 1280.

### PR 4 — Interacción gratuita en directo
- `!dark`, `!light`, `!mine`; contador global de likes→TNT; follow verificado→bonus; timer→evento.
- Umbrales y cooldowns configurables; antispam y opción de moderación.
- Estadísticas procedentes de fuentes reales o rotuladas sin disponibilidad.

**Aceptación:** acciones demo deterministas, sin regalos, latencia razonable y sin congelamientos por spam.

### PR 5 — Panel, estabilidad y experimentación
- Panel privado de control y diagnósticos, modo ensayo, manejo de desconexiones.
- Métricas por sesión (concurrencia si existe, likes, follows, comandos, duración, FPS, errores), minimizando datos de espectadores.
- Guía OBS/TikTok y checklist de cumplimiento para transmisión auténtica.

**Aceptación:** prueba prolongada, recuperación de errores, logs sin secretos ni PII.

### PR 6 FUTURO — Regalos / suscripciones pagadas opcionales
**Bloqueado por:** elegibilidad de cuenta, cumplimiento, demanda real y validación de eventos.

- Tabla configurable de regalos reales por identificador/alias local validado.
- Límites de efectos, defensa antispam, telemetría diferenciada.
- Eventos gratuitos permanecen disponibles; no comprometer valores económicos.

**Aceptación:** nada se etiqueta como monetización activa sin test con LIVE real autorizado.

## Definition of Done para cada PR

- Describir lo implementado y lo que **NO** se implementó.
- Incluir pruebas ejecutadas, fallos restantes y plan de reversión.
- Ninguna funcionalidad existente se elimina; screenshots si cambia la interfaz.
- No secretos, bots falsos, tasas de ingresos inventadas ni assets ajenos.
- No merge sin revisión y permiso del propietario.

## Primer prompt recomendado para Codex

```text
Lee AGENTS.md y docs/block-wars/README.md, GAME_DESIGN.md,
GROWTH_AND_MONETIZATION.md, TECHNICAL_SPEC.md y CODEX_BACKLOG.md.
Realiza PR 1: audita el MVP actual, añade pruebas de regresión y propón
separación de eventos. Mantén la serpiente funcional y no modifiques main.
No implementes regalos pagados todavía: el foco es crecimiento orgánico
por likes, follows, chat y retención.
```
