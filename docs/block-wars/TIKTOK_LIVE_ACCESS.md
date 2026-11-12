# TikTok LIVE: solicitud y montaje local

Registro del 2026-11-12. **Solicitud de acceso en revisión; LIVE Studio instalado, sesión iniciada por el propietario y estado «Sin acceso» comprobado en la aplicación.** No se ha transmitido ni validado una conexión de eventos reales.

## Acceso solicitado

Con autorización explícita del propietario se envió el formulario de acceso de TikTok usando YouTube como plataforma y el canal público [Mina Infinita LIVE](https://www.youtube.com/channel/UCRJQkWn3h-uh8LCu6WERU2Q). Se adjuntó una sola captura del canal con controles de propietario; el correo opcional quedó vacío y se aceptaron las condiciones indicadas en el formulario.

Se comprobó la confirmación **Access under review / LIVE Studio / Under review**, el 12 de noviembre de2026 a las10:41, hora de Ciudad de México. La interfaz indicó respuesta en **3 días hábiles**. Es el plazo mostrado por TikTok, no una fecha de aprobación garantizada. El canal de YouTube es nuevo; no se presentó historial de transmisiones inexistente.

La evidencia local está en `artifacts/first-live/tiktok-live-under-review.png`, excluida de Git. No guardar en commits la URL privada del trámite, identificadores de solicitud, correo, teléfono, cookies o códigos.

## Instalación comprobada

- Descarga iniciada desde la [página oficial de TikTok](https://www.tiktok.com/studio/download?lang=es). Bootstrap de4101888bytes, SHA256 `f993ac107328a20ea010871fd0c4d1eee22842799b7bd88b2bec533bfe4248c6`.
- Firma Authenticode del bootstrap: **Valid**, TikTok Pte. Ltd. El propietario autorizó ejecutarlo e instalar; después confirmó que la instalación terminó.
- Windows registra **TikTok LIVE Studio1.39.6**, en `C:/Program Files/TikTok LIVE Studio`. Se comprobaron firmas **Valid / TikTok Pte. Ltd.** del lanzador y del ejecutable instalado. Esto comprueba la firma, no constituye una auditoría de malware.
- Se abrió la aplicación, versión1.39.6. El propietario completó personalmente el inicio de sesión. Después se comprobó la pantalla «¿Qué tipo de contenido LIVE vas a crear?», con el estado **«Sin acceso»** junto al avatar. No se introdujeron credenciales mediante automatización.
- La aplicación sólo expone la ventana raíz en accesibilidad. Un clic automático en **LIVE de gaming** no cambió la pantalla; el propietario avanzó manualmente al paso2de4. Allí se observaron cámara y micrófono activos en la vista previa local, con estado **«Sin acceso»**. Se solicitó desactivar ambos mediante los selectores o volver atrás si no existe esa opción. No se guardó la captura de esa vista previa ni se inició una emisión. No dar por configurada una escena sin cámara y micrófono hasta comprobarla.
- El propietario informó que los selectores no permiten desactivar los dispositivos y volvió atrás. Se comprobó el regreso a la selección del tipo de LIVE, sin vista previa de cámara, todavía con **«Sin acceso»**. El asistente queda sin completar; se conserva OBS como entorno de ensayo sin cámara/micrófono.

## Siguiente comprobación

Completar los pasos iniciales de gaming que la aplicación permita y volver a leer el estado de acceso. El estado observado es «Sin acceso» y la solicitud web sigue pendiente de resolución; conservar el montaje local de OBS sin intentar eludir la restricción. No asumir disponibilidad de RTMP ni de una clave de transmisión.

Cuando la cuenta lo permita, revisar las fuentes admitidas por esta versión para la mina vertical720×1280, audio de la página y ausencia de cámara/micrófono. OBS Virtual Camera sólo transporta video; el audio requiere una ruta comprobada. Mantener el panel de control fuera de la captura.

TikFinity aún no está instalado ni sus eventos reales verificados. La mina, sus controles simulados y el acceso a LIVE son comprobaciones distintas. ElevenLabs real, mezcla de audio, ensayoOBS120min, derechos de recursos y revisión previa a publicación permanecen pendientes. Regalos pagados de Block Wars continúan deshabilitados.

## Reproducir y revertir

Consultar **Aplicaciones instaladas** para la versión y abrir TikTok LIVE Studio. Verificar firma desde las propiedades del ejecutable o `Get-AuthenticodeSignature`, sin ejecutar descargas de terceros. No publicar claves ni datos de sesión como evidencia.

Este cambio sólo documenta observaciones; no cambia código, perfiles ni configuración de emisión. Para detener la preparación, cerrar LIVE Studio y mantener las grabaciones/perfiles locales. No borrar archivos del propietario ni cancelar el trámite sin su indicación.

Verificación de esta revisión documental: `git diff --check`, `npm test` (**176 aprobadas**) y `npm run check` (**45 archivos**). Son pruebas locales del proyecto y no acreditan acceso a TikTok.
