# Evidencia de la presentación vertical y texturas locales

Fecha: 2026-11-11. Rama `codex/block-wars-reference`, dependiente de las fases anteriores. Estado: ensayo local; no lanzamiento comercial. Cambios en motor shaft, presentación, controles, importador y pruebas; Snake sigue disponible.

## Baseline y pruebas

La estabilización previa `c50b681` tenía 27 pruebas verdes. Antes de importar texturas, la presentación tenía 107 pruebas verdes. Las dos pruebas nuevas de carga fallaron por ausencia de `loadOriginals` antes de implementar el cargador. La regresión de explosiones con semilla3 reprodujo el retorno al techo antes de corregirlo.

| Comprobación final | Resultado observado |
| --- | --- |
| `npm test` | 114/114 pasan, incluidas regresiones de Snake y ocho unittest Python del importador dentro de una prueba Node |
| `npm run check` | 32 archivos JS/CJS válidos; sustituye diagnósticos IDE no disponibles |
| Copia limpia del árbol staged, sin assets locales | 114/114 y sintaxis pasan; no descarga durante las pruebas |
| `SOAK_HOURS=6 npm run test:block-soak` | Seis horas virtuales de arena y seis de shaft, con motor/reglas reales y fixtures |
| Importación oficial | 24 PNG; manifiesto y cliente verificados; JAR tratado como datos y eliminado |
| Navegador | Lienzo CSS/Canvas720 ×1280, catálogo original cargado, MEGA/impacto, pausa/emergencia y reanudación comprobados |

Último ensayo del motor tras corregir el piso: arena513 rondas; shaft432000 pasos/1299 rondas,360 pausas,72 emergencias,1440 duplicados y2880 fixtures pagados ignorados. Shaft: entidades+cola máximo19/24, partículas160/160, efectos19/24,32 bloques removidos por paso frente al presupuesto40. Heap con GC forzado y muestras tras calentamiento: arena4.72–4.79MiB, shaft5.16–5.25MiB. No son métricas de navegador/OBS ni una prueba de ausencia de fugas en una emisión real.

## Revisión adversarial

| Revisión | Resultado final |
| --- | --- |
| Seguridad, revisión alternativa | PASS; 13 pruebas de importación/HTTP, sin vulnerabilidades verificables |
| Lógica, revisión alternativa | PASS tras corregir el piso abierto por explosiones; 49 pruebas y50semillas ×3600ticks adicionales |
| Calidad, preset dedicado | PASS tras corregir pruebas de recorte/RGB y añadir documentación faltante; seis pruebas de texturas pasan |

Los presets de seguridad y lógica no pudieron ejecutarse por límite del proveedor; se hicieron revisiones independientes alternativas, sin atribuirles diversidad de modelos. Veredictos y verificaciones registrados en el ledger SQLite local, fuera de Git. Confianza: **media**, dadas las limitaciones de revisión y de validación de transmisión real.

## Operación, límites y reversión

Carga de PNG atómica con timeout y aviso de respaldo; reconexión acotada del relay, sin etiquetar conexión como LIVE verificado. Telemetría local agregada sin nombres. Assets, procedencia local y captura en `artifacts/` están ignorados por Git. No se ejecutan clientes de Minecraft ni se incluyen credenciales.

Pendientes: OBS/CEF prolongado, paquetes reales de TikFinity, revisión visual del propietario y permisos/elegibilidad de monetización. Recursos de Mojang sólo en el ensayo local, sin redistribución en el PR. Reversión del commit de presentación en su rama: `git revert HEAD`; los PNG locales ignorados se conservan. `main` permanece sin modificaciones.
