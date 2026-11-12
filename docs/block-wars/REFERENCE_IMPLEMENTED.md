# Excavación vertical: resultado implementado para ensayo local

Fecha: 2026-11-11. Rama `codex/block-wars-reference`; no sustituye la validación presencial de OBS/CEF ni una conexión LIVE real.

## Referencia y decisiones

Se analizaron las diez capturas del propietario en [VISUAL_REFERENCE_ANALYSIS.md](VISUAL_REFERENCE_ANALYSIS.md). Se aplican el mundo completo de 720 × 1280, ocho columnas grandes contando la pared lateral, túnel de cielo y nubes, un pico visible, DARK vs LIGHT, menú compacto de 18 comandos a la derecha, cuenta regresiva y banner de evento. El chat de YouTube y sus márgenes negros no forman parte del juego.

Las capturas muestran estados, no prueban sus físicas ni el origen de sus eventos. El motor implementa una excavación descendente con semilla, cámara siguiendo el frente, colisiones lógicas por celdas, grietas y entidades con mecha/impacto. Los nombres del [catálogo](CATALOG.md) tienen comportamientos propios verificables; no se presentan como una reproducción exacta de código ajeno. `CHAT=EVENTOS` comunica participación gratuita; no se usa `SUB=NUKE` como promesa de una suscripción pagada.

La app usa `layout:'shaft',width:7,height:40`, timestep de 50 ms, hasta cinco pasos por frame y recuperación acotada. El modo `arena` anterior se conserva para compatibilidad y pruebas. La ronda shaft termina al alcanzar el piso, evitando regresar a paredes viejas arriba y dejar al pico fuera de la cámara. Se conserva el resumen y la siguiente ronda automática. La pausa congela el motor; emergencia cancela efectos y crédito diferido antes de reanudar.

## Recursos originales solicitados

Por instrucción expresa del propietario se importan 24 PNG de Minecraft 26.3 desde el cliente oficial, con verificación de manifiesto y archivo. Están en `assets-local/minecraft/`, fuera de Git. Incluyen minerales, piedra/rocas, bedrock, cinco picos y TNT. El render amplía sin suavizado y recorta el primer cuadro 16 × 16 de las tiras animadas, sin aplastarlas. Las variantes de TNT usan la textura original; tamaños, banners y efectos las distinguen. Nubes, partículas, grietas y efectos de eventos siguen siendo gráficos del proyecto.

Se carga el catálogo completo o se conserva el arte de respaldo con aviso visible. El juego no se detiene si falta la descarga. [Importación, procedencia y límites de uso](MINECRAFT_ASSETS.md). Este es un juego independiente con recursos importados, no una captura del cliente Minecraft; no se ha acreditado permiso comercial para esa reutilización.

## Verificación reproducible

```powershell
python scripts/import_minecraft.py
npm test
npm run check
$env:SOAK_HOURS='6'
npm run test:block-soak
Remove-Item Env:SOAK_HOURS
npm start
```

Las pruebas verifican contratos, regresiones de Snake, 18 alias, duplicados, enfriamientos, pausa, presupuesto de trabajo, fin del shaft, cámara, recorte de PNG, importación y acceso HTTP. El ensayo acelerado ejecuta ambos layouts, las 18 acciones y los cinco picos, con GC forzado para observar memoria del motor. No mide GPU, navegador, TikFinity ni OBS durante seis horas reales.

En navegador se comprobó la carga del catálogo original y el lienzo CSS/Canvas de 720 × 1280, con captura local en `artifacts/` (ignorada por Git). La etiqueta del relay no afirma LIVE verificado. El panel permanece separado de la captura. No se importan sonidos ni se habilitan regalos pagados.

Pendientes de lanzamiento: revisión visual del propietario, sesión real prolongada de OBS/CEF, eventos reales y versión instalada de TikFinity, moderación y comprobación de derechos/elegibilidad antes de monetizar. Los ensayos no acreditan crecimiento de audiencia ni ingresos.
