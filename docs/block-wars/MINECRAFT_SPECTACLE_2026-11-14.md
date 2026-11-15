# Efectos y composición de la mina — 2026-11-14

## Referencias y decisiones

Se revisaron las cinco capturas 1000105980, 5982, 5984, 5986 y 5988: inventario vertical izquierdo con iconos/cifras, profundidad debajo, menú estrecho derecho, cielo azul y nubes pixeladas en la excavación, grietas de bloques, picos de materiales mezclados y TNT giratoria con autor. La cuarta y quinta muestran la concentración de picos al activarse un evento; la segunda y tercera permiten distinguir tamaño y rotación de TNT.

La mina elimina DARK VS LIGHT y los eslóganes CHAT=TNT/CHAT=GRATIS. Los ocho contadores corresponden a bloques realmente destruidos por material, no a puntos; diamante suma también el material crystal heredado. La profundidad indica metros máximos alcanzados por el pico durante la sesión. Reiniciar explícitamente borra ambos; los ciclos internos de votos no lo hacen. No se copian la interfaz de YouTube/TikTok, nombres, métricas, ofertas monetarias ni animaciones ajenas de suscripción.

Los niveles 1–4 expresan intensidad visual, sin vinculación económica. TNT es una carga, MEGA una carga mayor, NUKE tres cargas oro/cian/violeta con radio mayor. Los cuerpos tienen gravedad, giro, colisión lateral, techo/suelo y rebote limitado; la mecha arranca al primer contacto y sigue durante el rebote. Una carga demasiado ancha puede quedar sobre la entrada: conserva un indicador de autor, variante y mecha, sin atravesar roca para llegar al pico. No se afirma replicar la física del cliente Minecraft desde imágenes estáticas.

RAIN cambia en endless a ocho picos físicos que minan y rebotan; sus diez segundos incluyen el escalonado. Sus alias históricos se conservan. La acción interna tnt_rain mantiene TNT explosiva para compatibilidad; arena y shaft conservan el catálogo anterior. No se altera Snake.

## Recursos y comprobación

El importador local añade ocho iconos originales de objetos a los 41 PNG anteriores (49 total). Descarga oficial fijada, verificación y respaldo; recursos fuera de Git. Se conservan los sonidos locales de Minecraft y la pista musical independiente. El código y las pruebas no contienen claves ni nombres reales.

Se ejecutaron comprobación de sintaxis, suite completa, seis horas virtuales de endless y 30 minutos virtuales de comentarios cada medio segundo. La revisión adicional detectó y corrigió penetración de techos al rebotar y una prueba de colores insuficiente. Capturas de vista previa se conservan localmente en artifacts/minecraft-energy/spectacle-*.png (ignoradas por Git). La suite final pasó 310/310 con concurrencia de pruebas limitada a2; en una ejecución masiva anterior el lanzador PowerShell agotó su plazo de15s, y pasó aislado sin cambios. Los diagnósticos IDE se sustituyeron por node --check (65 archivos). Revisiones independientes de seguridad, lógica y calidad: PASS tras correcciones. Estas pruebas no acreditan seis horas reales de OBS ni monetización, likes o suscriptores reales.

## Reproducir y revertir

1. npm ci --ignore-scripts; python scripts/import_minecraft.py.
2. npm run check; npm test; npm run test:endless-soak; node tests/live-cadence-soak.cjs.
3. npm start; abrir /block-wars?platform=youtube y el panel /block-wars/control. Ensayar RAIN, TNT, MEGA y NUKE con identidades ficticias; comprobar atribución, contadores, pausa y limpieza.
4. OBS: fuente 720×1280, 60 FPS, sin cámara/micrófono; activar audio desde Interactuar. No iniciar una nueva emisión por este procedimiento.

Reversión: volver al commit ffc130d (rama codex/minecraft-live-energy), reiniciar el servidor propio y recargar la fuente del navegador. Conservar credenciales y recursos locales; los ocho PNG adicionales no impiden usar la versión anterior. Este PR depende del PR17, sin modificar main.
