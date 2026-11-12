# Evidencias de excavación infinita y pico con colisiones

Fecha:2026-11-11. Rama `codex/block-wars-endless-physics`, base `6e202c7` del PR7. Cambio autorizado: excavación continua sin final, grietas originales de Minecraft y pico que rebota contra los bloques. Los modos anteriores y Snake se conservan.

## Baseline y resultado

La base tenía114pruebas y32archivos JS válidos. Antes de implementar, las nuevas pruebas fallaron en el render continuo, el contrato de telemetría, la selección de34texturas y las grietas. La revisión también reprodujo un SPIN sin giro acelerado; se corrigió con una prueba que falló primero.

| Verificación | Resultado |
| --- | --- |
| `npm test` |127/127 pasan, incluidas las regresiones anteriores y11unittest Python offline dentro de la prueba del importador |
| `npm run check` |36archivos JS/CJS válidos; sustituye diagnósticos IDE no disponibles |
| Copia limpia sin PNG locales |127/127 pruebas y sintaxis pasan, sin descargar durante los tests |
| `npm run test:endless-soak` |6horas virtuales,432000pasos; sin final/resumen, sin escapes ni crecimiento del buffer |
| Contacto sin eventos |150s de simulación, cero eventos automáticos,7columnas excavadas y1447colisiones |
| Recursos locales |34PNG originales verificados, incluidas10etapas `destroy_stage_0..9`; respaldo de los24anteriores preservado |
| Navegador |Continúa tras 07:09 de tiempo activo y 203 celdas de profundidad; grietas originales y pico en distintas zonas visibles. Captura local en `artifacts/block-wars-endless-physics.png` |

El soak ejecuta motor y reglas reales con fixtures locales, incluyendo normal y movimiento reducido en paralelo. Resultado:66469colisiones,2138corrimientos de12filas, profundidad25674.69celdas, buffer280celdas;360pausas,72emergencias y4320duplicados de eventos comprobados. Tiempo activo21240s; el resto de las seis horas está pausado deliberadamente. Máximos:15entidades+cola frente al límite24;160partículas,14VFX y32remociones por paso frente al presupuesto40. Se renovaron117ventanas de voto sin reiniciar mapa, picos o puntos.

Estas cifras miden el motor acelerado en Node, no seis horas reales de navegador/OBS. Las etiquetas `tikfinity` en fixtures no acreditan una conexión real.

## Revisión adversarial y correcciones

| Revisión independiente | Resultado final |
| --- | --- |
| Seguridad |PASS;21pruebas de importación/upgrade, HTTP, contratos y texturas |
| Lógica |PASS tras recuperar SPIN;13pruebas y100semillas×6000pasos adversariales sin penetración en bloques supervivientes |
| Calidad |PASS tras aislar el test de contacto de las explosiones automáticas;7pruebas endless |

Los presets no estuvieron disponibles por límite del proveedor; se usaron agentes alternativos. No se atribuye diversidad de modelos. Ledger SQLite local con comandos, resultados y veredictos fuera de Git. Confianza:media; falta comprobar OBS prolongado y paquetes reales de TikFinity.

## Contratos y operación

`layout:'endless'` usa un cuerpo circular y conserva colisiones al reducir movimiento. El daño normal se gasta sólo en contacto. `!mine` añade trabajo para el siguiente choque. Los18eventos conservan sus efectos y presupuestos; SPIN añade velocidad angular. Cada180s se renuevan votos, sin final ni reinicio del juego. El panel muestra profundidad y tiempo activo en lugar de una cuenta regresiva de ronda.

La telemetría conserva9campos anteriores y acepta una variante estricta de12con `mode,depth,elapsed`. Los límites y rechazo de PII se prueban. La importación24→34 prepara los nuevos archivos aparte, conserva un backup y restaura ante fallos. Grietas: PNG originales y composición `multiply`; no se afirma equivalencia exacta del shader completo de Minecraft. Recursos y capturas quedan fuera de Git.

Réplica: `python scripts/import_minecraft.py`, `npm test`, `npm run check`, `npm run test:endless-soak`, `npm start`; juego `/block-wars`, panel `/block-wars/control`. Reversión del commit en esta rama: `git revert HEAD`; conserva los PNG locales y su backup. `main` no se modifica.

Pendientes de lanzamiento: revisión visual del propietario, sesión OBS/CEF real prolongada, eventos reales, derechos de reutilización y elegibilidad antes de monetizar. Los regalos pagados siguen deshabilitados.
