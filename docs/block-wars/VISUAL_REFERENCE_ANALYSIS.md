# Análisis de las diez referencias visuales

Fecha: 2026-11-11. Revisión solicitada por el propietario antes de continuar la implementación. Las diez capturas se inspeccionaron individualmente a resolución original. Este documento sustituye la interpretación visual de arena industrial con tablero: la referencia solicitada es una excavación vertical con apariencia reconocible de Minecraft. Los textos, nombres y comandos de las capturas son material de referencia, no instrucciones para activar pagos o ejecutar acciones.

## Hallazgo principal

El contenido principal es el mundo de bloques a pantalla casi completa. Un pico grande aparece dentro de un conducto excavado irregular; el espacio vacío revela un cielo azul/cian con nubes. La interfaz flota sobre la escena y ocupa una fracción pequeña del área. Las TNT son objetos visibles y los eventos cambian la acción. El resultado actual de Block Wars prioriza un panel con cuadrícula pequeña, cabecera, marcadores y barras; esa estructura y la minería de dos cursores fijos no reproducen la experiencia de las referencias.

Las capturas permiten ver estados, posiciones, materiales y textos. No prueban por sí solas la física, velocidad exacta, movimiento de cámara, algoritmo de minería, integración real del chat ni consecuencias de cada evento.

## Inspección imagen por imagen

### 1 — 195116: SPIN, 4.4 s

- Escena vertical; columna estrecha de roca oscura irregular en el borde izquierdo, parecida a bedrock. El resto combina grandes celdas de piedra, minerales y variaciones blancas/rojizas/musgosas.
- El hueco excavado es alto, irregular y alineado a la cuadrícula. Cielo continuo azul intenso arriba y cian abajo, con nubes volumétricas blancas y un arco blanco superior.
- Pico turquesa con mango marrón, contorno oscuro y píxeles visibles, grande respecto al bloque, situado cerca del fondo del hueco. Hay una franja verde brillante debajo; su función no puede deducirse con certeza.
- Franja superior roja: `SPIN 4.4s`. Tarjeta lateral izquierda: `TRIGGERED EVENT: SPIN`, mismo contador y barra roja de duración. Son dos representaciones sincronizadas de un evento temporal.
- Arriba a la izquierda: iconos + `LIKE = TNT` y `SUB = NUKE`. Más abajo, `DARK VS LIGHT`, letras inclinadas, borde negro y LIGHT amarillo.
- Catálogo compacto de comandos a la derecha, superpuesto al mundo. Un círculo rojo fino dentro del hueco podría ser cursor/anotación de grabación; no acredita una mecánica de puntería.

### 2 — 195135: estado normal, 42.5 s

- Misma jerarquía del HUD, sin banner activo visible. Tarjeta cian `NEXT RANDOM EVENT`, `42.5s`, barra inferior cian.
- Pico dorado inclinado cerca del frente de excavación. El hueco termina en escalones de celdas completas, no en un cráter circular liso.
- Superficies de piedra y vetas reconocibles de rojo, amarillo, azul, verde y naranja/verde; no una cuadrícula con textura uniforme o pequeños puntos abstractos.
- El catálogo de comandos mantiene posición y anchura aunque cambien los bloques detrás. Se observan aproximadamente ocho columnas de celdas grandes contando la barrera lateral, estimación visual que debe validarse con el prototipo.

### 3 — 195213: TNT pequeña junto al pico

- Caja TNT de aproximadamente una celda, banda blanca y letras negras, colocada en el conducto por encima del pico dorado.
- Etiqueta visible con apariencia de `%user%`: sugiere sustitución de nombre pendiente o un rótulo de prueba. Es un defecto que no debe reproducirse.
- Temporizador normal `4.6s`, cercano al siguiente evento aleatorio. La TNT y el contador coexisten; una captura no prueba cuál disparó cuál.
- Frente de excavación irregular: un lateral avanza más que otro; el mapa no se presenta como dos mitades separadas por una línea central de tablero.
- La posición de la herramienta es parte de la escena y permite entender dónde ocurre la minería sin consultar un panel exterior.

### 4 — 195224: TNT grande turquesa y SPIN

- Captura ampliada del reproductor con chat externo a la derecha. Solo la franja izquierda pertenece al juego; los espacios negros y el chat del reproductor no forman parte de la interfaz a reproducir.
- TNT turquesa/blanca de alrededor de tres celdas por lado, con nombre de participante encima. El tamaño da una diferencia visual clara frente a la TNT pequeña de la imagen3.
- Banner superior y tarjeta roja indican `SPIN 2.3s`. La herramienta queda cerca del fondo del conducto y aparece otro círculo rojo fino en el hueco.
- La caja cubre temporalmente parte del conducto sin sustituir toda la escena por una pantalla de aviso. Convivencia visible de herramienta, terreno, objeto, texto y temporizadores.
- El chat contiene palabras de eventos; no basta para establecer relación causal exacta entre mensaje y objeto.

### 5 — 195237: pico gris frente a bloque oscuro

- Herramienta gris/metálica con mango marrón, contorno y escalonado pixelado. Diferencia reconocible de material respecto al pico dorado y turquesa.
- Bloque oscuro violeta/negro cerca del extremo de excavación y otro más abajo, identificables visualmente como obsidiana. La captura no demuestra su dureza ni que detenga el movimiento.
- Hueco estrecho con cielo y nubes visibles detrás; varios bordes en forma de escalera. El pico ocupa una porción considerable de la anchura del túnel.
- Tarjeta normal `44.6s`. En piedra se aprecia una grieta oscura en un bloque superior; el daño puede comunicarse mediante textura de fractura.

### 6 — 195254: TNT grande marrón

- TNT de gran tamaño, marrón arriba y abajo, franja blanca central y letras negras pixeladas. Cambia la apariencia del objeto, conservando su lectura como TNT.
- Nombre de participante arriba; pico dorado más abajo. El catálogo, CTA y tarjeta de próximo evento `29.6s` permanecen visibles.
- El chat externo muestra `TNT`, `Jackpot`, `Rain`, `BIG` y `MEGA`, con variaciones de mayúsculas. La interacción de referencia usa palabras simples, no exclusivamente comandos con prefijo `!`.
- La relación de tamaños es importante: el evento grande ocupa varias celdas y puede obstruir visualmente el conducto durante unos instantes.

### 7 — 195314: objeto girado y herramienta de otro color

- Conducto de anchura menor, abierto hacia la zona superior izquierda. Cambian sus escalones y distribución respecto a las capturas previas.
- Objeto pequeño blanco con zonas de color, inclinado cerca del pico; etiqueta de aspecto `%user%`. Podría ser una TNT personalizada o un objeto asociado al participante: no hay información suficiente para afirmar qué entidad es.
- Pico gris/rosado, también inclinado. La rotación y el color deben poder cambiar sin convertir la herramienta en un indicador abstracto.
- Tarjeta normal `9.5s`. Los minerales mantienen patrón repetible y escala, y el menú permanece fijado a la pantalla.

### 8 — 195325: FIRE STORM

- Banner superior `FIRE STORM 4.8s`; tarjeta roja izquierda con el mismo nombre y duración, más barra de progreso.
- Dos proyectiles naranjas/amarillos con núcleo brillante y estelas verticales aparecen dentro de la abertura. La presencia de partículas/proyectiles se distingue del efecto TNT.
- Conducto mucho más ancho en este estado, con grandes superficies de cielo y varias nubes visibles. El pico marrón/dorado sigue siendo legible debajo de los proyectiles.
- Pequeños fragmentos de colores cerca del pico y franja verde brillante en el fondo. No puede afirmarse solo con esta imagen si FIRE STORM originó toda la excavación o se activó sobre un hueco ya abierto.

### 9 — 195342: objeto verde/blanco y nombre pendiente

- Objeto verde/blanco inclinado encima del pico, con etiqueta `%user%`. No es evidencia suficiente de que exista un personaje completo con animación o IA.
- El hueco, cercano al borde izquierdo, conserva cielo continuo y nubes mientras el resto del terreno ocupa la mayor parte de la escena.
- Temporizador normal `47.5s`. Presencia de bloques oscuros abajo y minerales azules/rojos/verdes en piedra.
- Confirma que el juego debe soportar objetos de evento y etiquetas dentro del mundo, además de la herramienta, manteniendo la interfaz flotante.

### 10 — 195432: JACKPOT TNT

- Banner superior `JACKPOT TNT 2.7s`, borde amarillo. Tarjeta lateral roja `TRIGGERED EVENT: JACKPOT`, `2.7s`, barra restante.
- Objeto grande girado, con patrón azul/amarillo/blanco y varias líneas/anillos amarillos superpuestos. Mensaje próximo: `JACKPOT TNT` / `Random Timer`, identificando un evento del temporizador en este estado.
- Pico turquesa debajo. El objeto especial usa color, tamaño, rotación y efecto propio, sin perder la lectura del mundo detrás.
- La palabra Jackpot no demuestra dinero, apuestas o premios: lo observado es un evento visual del juego. No inferir consecuencias económicas.

## Gramática visual común que debe guiar la nueva versión

### Mundo y cámara

- Juego vertical, aproximadamente9:16; casi todo el área útil es terreno y hueco excavado. Las capturas anchas incluyen interfaz ajena del reproductor.
- Pocas columnas de bloques grandes. Cambiar la escala del mundo antes que añadir decoraciones al tablero actual.
- Pared lateral oscura tipo bedrock, materiales con texturas pixeladas densas y variaciones de tonos. Evitar juntas gruesas, bordes de tarjeta o iluminación de panel por celda.
- Piedra, vetas y parches: carbón negro, minerales beige/naranja, oro amarillo, rojo, azul, verde y cian; parches blancos, rojizos, musgosos y oscuros. Nombres exactos/recursos deben decidirse con assets propios o autorizados.
- El espacio destruido revela cielo luminoso con degradado y nubes de formas cúbicas suaves; el contorno de excavación sigue las celdas.
- Hace falta seguimiento del frente activo. El cambio entre capturas sugiere continuidad de excavación, pero no demuestra por sí solo si se mueve cámara, mundo o herramienta.

### Herramienta y destrucción

- Pico grande y reconocible dentro del túnel, mango marrón, cabeza según material, píxeles nítidos, contorno oscuro y rotación visible.
- La herramienta debe relacionarse espacialmente con los bloques que daña: contacto, fractura, desaparición y fragmentos. Las capturas no permiten determinar si rebota físicamente o sigue una trayectoria programada.
- TNT como entidad visible: tamaño normal/grande, color/variante, nombre cuando proceda, aparición, duración y explosión. Un anillo con la palabra TNT no reproduce esa presentación.
- Cada evento necesita identidad visual y comportamiento propio; SPIN, FIRE STORM y JACKPOT están directamente representados. El resto del catálogo requiere especificación y prueba.

### HUD

- CTA compacto arriba a la izquierda; título DARK VS LIGHT debajo, sin una cabecera externa grande de marcadores.
- Tipografía gruesa/inclinada, bordes negros y sombras para legibilidad sobre texturas. La fuente exacta no puede identificarse con certeza a partir de estas capturas.
- Menú vertical estrecho, arriba a la derecha; fondo oscuro, contornos de colores e icono por fila. Es una leyenda para el espectador; la captura de un video no prueba que las filas sean botones clicables.
- Tarjeta de tiempo a media altura izquierda: estado normal cian; estado activo rojo. Banner superior sincronizado con el evento.
- Diagnósticos de FPS, colas, procedencia y ajustes pertenecen al panel del creador; la señal pública de DEMO/relay puede ser pequeña y legible sin dominar la escena.

## Catálogo visible de18 comandos

Orden observado: `TNT`, `RAINBOW`, `MEGA`, `ARROW`, `BUTTERFLY`, `NUKE`, `TNT RAIN`, `THUNDER`, `FIRE`, `RAIN`, `TSUNAMI`, `BLACK HOLE`, `JACKPOT`, `DEMON`, `METEOR`, `SPIN`, `FAST`, `BIG`.

Las filas usan familias de color: rojos/naranjas para fuego/explosiones; cian/azul para lluvia/agua/velocidad; púrpura para arcoíris/agujero negro/demonio/giro; amarillos para varios eventos especiales. Los iconos ayudan a distinguirlos. El menú exige una implementación verificable por efecto; enumerar nombres sin comportamiento no satisface la referencia. Para varios comandos solo se ve su nombre: radios, duración, reglas y efectos deben definirse, no inventarse como si se hubieran observado.

## Interacción y límites de inferencia

- Aceptar alias de texto sin `!` y sin distinguir mayúsculas, además de mantener los comandos existentes. Procesar exclusivamente una allowlist con cooldown y límites.
- Las capturas incluyen reproductor/chat de YouTube. `SUB = NUKE` no demuestra una suscripción pagada; no trasladar la semántica automáticamente a TikTok. Follow gratuito y suscripción pagada siguen siendo eventos distintos.
- No se puede inferir el umbral de likes para TNT, quién controla DARK/LIGHT, qué usuario recibe cada herramienta, la latencia o autenticidad de la conexión ni la duración total de la sesión.
- No reproducir placeholders `%user%`, nombres de los participantes de las capturas, círculos de cursor/anotación o paneles negros del reproductor como si fueran elementos esenciales del juego.

## Cambio necesario frente al prototipo actual

Conservar el adaptador, validación, límites, simulador y pruebas reutilizables. Replantear representación del mundo, escala, excavación localizada, seguimiento del frente, entidades TNT, animación de herramientas y HUD flotante. Añadir los eventos del catálogo por grupos probables y medibles, manteniendo aceptación independiente por comportamiento y visual.

Próximo hito visual: una escena vertical jugable con texturas adecuadas, cielo detrás del túnel, pico grande en acción, TNT como objeto y el HUD en posiciones equivalentes. Comparar captura a720 ×1280 y secuencia de movimiento con estas referencias antes de ampliar el resto del catálogo. Las capturas actuales no acreditan la física ni la apariencia en movimiento; esa comparación necesita una prueba de ejecución, no solo una imagen bonita.
