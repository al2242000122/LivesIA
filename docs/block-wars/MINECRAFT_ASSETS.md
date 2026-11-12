# Importación local de texturas de Minecraft

Fecha de comprobación: 2026-11-11. Por petición explícita del propietario se añadió este paquete local; esta excepción sustituye la preferencia anterior por arte propio para estas 24 imágenes. No convierte Block Wars en un producto oficial de Minecraft y no incorpora una licencia de Mojang al código de LivesIA.

## Fuente y resultado real

El importador usa exclusivamente las dos URLs HTTPS fijadas en [la configuración](../../configs/minecraft-assets.json):

- Versión **26.3**; [manifiesto oficial](https://piston-meta.mojang.com/v1/packages/9f67e10ed013deeaad20ac3c800652765d493408/26.3.json), SHA1 `9f67e10ed013deeaad20ac3c800652765d493408`.
- [Archivo cliente oficial](https://piston-data.mojang.com/v1/objects/e877b6a07acd633fb3bb475002175cec036e7b87/client.jar), SHA1 `e877b6a07acd633fb3bb475002175cec036e7b87`, **41 483 720 bytes**.

Se ejecutó la descarga y extracción local: **34 PNG**, 6 472 bytes en total, bajo `assets-local/minecraft/`, junto con `provenance.json`. Son 23 imágenes de 16×16; `magma.png` es una tira de 16×48 con tres cuadros de 16×16. El render puede tomar el primer cuadro; no debe deformar la tira completa para representar un bloque cuadrado. El JAR se eliminó al cerrar el directorio temporal y **nunca se ejecutó**.

El identificador local `diamond` contiene `diamond_ore.png`; `crystal` es un alias del frontend a esa misma imagen, no una descarga adicional. Los PNG y el manifiesto local están excluidos de Git; el repositorio conserva sólo el importador, la configuración y las pruebas.

## Whitelist exacta

`stone`, `soil` (dirt), `coal`, `iron`, `gold`, `redstone`, `lapis`, `emerald`, `diamond`, `copper`, `granite`, `diorite`, `andesite`, `moss` (mossy cobblestone), `obsidian`, `magma`, `bedrock`, `tnt` (lado), `tnt_top`, `wood_pickaxe`, `stone_pickaxe`, `gold_pickaxe`, `diamond_pickaxe`, `netherite_pickaxe` y `destroy_stage_0` a `destroy_stage_9` (diez etapas originales de grietas).

Las rutas internas exactas están en `configs/minecraft-assets.json` y se comparan contra la whitelist incluida en el importador. No se extraen clases Java, sonidos, fuentes, otros recursos, enlaces simbólicos ni archivos fuera de esa lista. No se utiliza `extractall()`.

## Réplica y controles técnicos

```powershell
python scripts/import_minecraft.py
node --test tests/minecraft-import.test.cjs
```

Python usa únicamente la biblioteca estándar. El importador verifica el SHA1 del manifiesto, compara su ID y los datos del cliente contra los pines, verifica tamaño y SHA1 completos del cliente, y después abre el ZIP como datos. Rechaza redirecciones y cualquier otra URL. La extracción verifica CRC del ZIP y CRC de cada chunk PNG; exige firma/IHDR PNG, ancho 16 y alto múltiplo de 16 entre 16 y 1 024, con máximo 1 MiB por imagen. Entradas duplicadas, cifradas, ausentes o que sean enlaces se rechazan.

Primero escribe en un directorio temporal propio y sólo renombra el directorio terminado. No sustituye ni elimina un directorio de destino existente. Si ya existe una instalación válida, el comando comprueba sus imágenes contra `provenance.json` y devuelve `local-checksums-verified`; no vuelve a descargar. Si falla esa comprobación, conserva los archivos existentes y termina con error. Para una instalación nueva en ese caso, el propietario puede mover manualmente la carpeta anterior fuera del destino y repetir el comando.

`provenance.json` tiene `schemaVersion:1`, los seis campos de fuente de la configuración, `importedAt` UTC y `textures`. Cada entrada incluye `archivePath`, `file`, `sha256`, `size`, `width` y `height`. No contiene cookies, cuentas, tokens ni rutas personales. Los hashes locales detectan discrepancias con ese inventario; este JSON local **no es una firma de Mojang** ni demuestra por sí solo autenticidad frente a una alteración conjunta de imágenes y manifiesto.

Las pruebas offline crean su propio ZIP sintético, sin descargar recursos: verifican pines y whitelist, instalación completa, procedencia/hash por imagen, rechazo por tamaño/SHA1, CRC ZIP, cabeceras/dimensiones PNG y preservación del destino ante errores. No ejecutan el JAR.

## Grietas y composici�n

Las diez etapas se extrajeron sin redibujarlas ni modificarlas. Son de 16�16. La inspecci�n de los p�xeles originales encontr� los pares gris/alfa `(255,1)` para el fondo casi transparente, `(61,255)` para grietas oscuras y `(155,255)` para grietas claras. La etapa 0 usa gris+alfa de 8 bits; la 9 usa paleta de 2 bits y `tRNS`. Se comprob� el mismo conjunto de colores/alfa en las diez.

Un overlay Canvas `multiply`, recortado al bloque y restaurando despu�s el estado de Canvas, conserva el color de la textura subyacente y oscurece las grietas; `source-over` reemplaza los p�xeles opacos de grieta por gris. Esto documenta datos y una composici�n local elegida: importar los mismos PNG no demuestra que el renderer Canvas reproduzca exactamente el shader, la iluminaci�n ni la temporizaci�n de Minecraft.

## Derechos y alcance

Las imágenes de Minecraft conservan sus derechos y condiciones originales. La [EULA oficial](https://www.minecraft.net/en-us/eula) establece condiciones sobre software y contenido de Minecraft y remite a las [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) para permisos adicionales. Ambas páginas se consultaron el 2026-11-11; pueden cambiar.

No se interpreta el apartado de videos/transmisiones de Minecraft como una exención general para integrar texturas en un videojuego independiente. Esta importación documenta el uso local solicitado, no una autorización de redistribución de assets, de comercialización, de emisión del juego derivado ni de uso de marcas. No se incluyen las imágenes en commits, paquetes públicos o un PR. La revisión de procedencia técnica no sustituye revisar las condiciones aplicables a cada uso externo.
