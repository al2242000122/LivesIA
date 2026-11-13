# Verificación de los 14 comandos Minecraft

Estado: ensayo local. Rama `codex/minecraft-comment-experience`, sobre la preparación de acceso de TikTok; `main` permanece intacto. No se inició una transmisión.

## Evidencia ejecutada

| Comprobación | Resultado |
| --- | --- |
| Baseline antes de editar | 176 pruebas aprobadas; sintaxis de 45 archivos. |
| Suite final, copia del árbol staged sin `assets-local` | **215 pruebas aprobadas**, 0 fallos; sin instalar dependencias ni descargar recursos durante los tests. Es otra carpeta en esta misma PC, no otra máquina/OS. |
| `npm run check`, misma copia | **49 archivos** válidos; sustituye diagnósticos IDE no disponibles. |
| `npm run test:endless-soak` | **6 horas virtuales**, 432000 pasos, 2587 reciclados del buffer, daño en las siete columnas, 360 pausas y 72 emergencias. Pico de trabajo combinado22/24; partículas160/160 y daño32/40 por paso. Movimiento reducido conserva el mismo estado físico. |
| `npm run test:block-soak` | **2 horas virtuales** en arena y shaft; 170/430 rondas, catálogo20 y cinco picos ejercitados. |
| `npm run test:soak` | Snake: **2 horas virtuales**, 106 rondas; regresión sin eliminar funcionalidades. |
| Importador real | **41 PNG**,26.3, cliente SHA1 `e877b6a07acd633fb3bb475002175cec036e7b87`; segunda ejecución `local-checksums-verified`. Recursos y respaldo anterior ignorados por Git. |
| Navegador, panel → servidor/SSE/adaptador → juego | **14/14 activaciones** muestran efecto correcto, identidad ficticia «Minera Ana» y «PRUEBA». Un intento inmediato de STORM tras RAIN indica enfriamiento y conserva al autor de RAIN. |
| Inspección visual | Lluvia de TNT, lluvia/clima, tarjeta de autor y cuenta atrás de NUKE sobre una entrada estrecha comprobados. Canvas720×1280; evidencia de página completa en `artifacts/minecraft-commands/`, ignorada por Git. |
| Audio del navegador | Se activó mediante gesto; interfaz «SONIDOS ACTIVOS · VOZ PENDIENTE», sin errores/warnings en la captura final. No se midió mezcla/volumen ni se escuchó ElevenLabs real. |
| Revisión de seguridad | PASS; listas permitidas, origen simulado, importador y nombres revisados. |
| Revisión de lógica | PASS después de corregir IDs automáticos tras reset, tamaño físico de cargas, centros de explosión y visibilidad de la carga fuera del encuadre. |
| Revisión de calidad | PASS después de centralizar tuning y fortalecer pruebas de empuje/determinismo. |

La primera integración completa tuvo dos fallos de pruebas: el fixture de HTTP excedía el límite real de30peticiones/s tras añadir dos acciones; se separaron casos sin debilitar la guarda. Otra prueba fijaba18claves y se amplió explícitamente a20. Las regresiones del nombre visible y de IDs automáticos se reprodujeron en pruebas fallidas antes de corregirse.

## Límites de aceptación

La mina y sus respuestas se calcularon en vivo localmente; «tikfinity» en fixtures no representa conexión a TikTok. Siguen pendientes comentarios reales de la plataforma, ElevenLabs real, revisión visual del propietario y OBS/CEF durante120min con la configuración nueva. Ningún soak virtual ni indicador de audio acredita esos puntos.

Los sonidos de esta fase son sintetizados propios, no archivos de sonido de Minecraft. Los PNG originales son locales y no se redistribuyen. Condiciones y alcance en [MINECRAFT_ASSETS.md](MINECRAFT_ASSETS.md). No se habilitaron regalos ni suscripciones pagadas.

Reproducir: comandos de [MINECRAFT_COMMANDS.md](MINECRAFT_COMMANDS.md). Revertir el commit de la fase y recargar el servidor/fuente; preservar texturas, respaldos y grabaciones del propietario.
