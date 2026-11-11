# Eventos compartidos — contrato interno v1

Implementado en `integrations/events.js` y `transport.js`, sin dependencias. Snake conserva sus reglas; Block Wars usa las reglas gratuitas independientes. Esto no es un esquema oficial de TikTok ni certifica una conexión real.

`createAdapter({now,salt,maxKeys,rateLimit}).normalize(input,source)` recibe objeto JSON o string de hasta 16384 unidades UTF-16. `source` solo puede ser `simulator` o `tikfinity` y se impone desde el transporte, ignorando lo que diga el payload. Devuelve null al rechazar. Salida:

```js
({type:'comment',source:'tikfinity',id:'mensaje',receivedAt:0,
  actor:{displayName:'Nombre público saneado',stableHash:'seudónimo efímero'},
  data:{text:'!dark'}})
```

Tipos: `like` (`delta` incremental, hasta 1000), `comment` (hasta 500 caracteres), `follow`, `subscribe_paid`, `gift` (nombre/ID y count hasta20), `viewer_count` (solo campo explícito `viewerCount`; nunca `totalUser`). `subscribe_paid` es distinto de follow y Block Wars lo ignora. Campos escalares se validan antes de convertir; mensajes crudos y nombres no se guardan en logs.

Se admiten envolturas `event/data`, datos planos del MVP y variantes con `user`/`gift`/`common.msgId`. Rachas `giftType=1` o `gift.type=1` esperan `repeatEnd=true/1`. Un `groupId` no cero distingue el cierre de racha; si falta, se usa msgId combinado con actor, regalo y cantidad. No se inventa ID transaccional: sin ID se asigna un identificador local para circulación, pero **no se garantiza dedupe** de retransmisiones. La compatibilidad exacta debe probarse con la versión instalada de TikFinity y fixtures autorizados.

Dedupe por fuente/tipo/ID con TTL120 s, máximo2048 claves por defecto (configurable32–4096); límite global200 entradas/s por instancia (configurable10–1000). Al llenarse se descarta hasta liberar capacidad. Métricas: accepted/rejected/duplicates/pending/rateLimited/withoutId/dedupeSize, sin payloads. La identidad es un seudónimo salado de sesión para cooldown, no anonimización criptográfica ni autenticación. No se persiste.

`LiveTransport.connect({target,onEvent,onControl,onStatus,adapter})` abre SSE local y WS a127.0.0.1:21213. Eventos válidos llegan por onEvent; controles administrativos por onControl, filtrados por destino (`snake` por defecto, `block-wars` explícito). `stop()` cierra recursos. Reconexión con backoff1–30 s; un SSE en CONNECTING conserva su mecanismo nativo, un CLOSED se recrea con un único timer. Estado `{relay,controls,source,verified:false,metrics}`; ningún estado declara LIVE verificado. Los errores de callback solo incrementan un contador agregado, sin registrar datos.

Pruebas: `node --test tests/events.test.cjs tests/transport.test.cjs tests/game.test.cjs tests/server.test.cjs`. Se normalizan ambas formas, se rechaza JSON malformado, se prueban dedupe/TTL/límites/fuentes y reconexión; 27 regresiones Snake/HTTP permanecen. Fuentes consultadas2026-11-10: [TikFinity Event API](https://tikfinity.zerody.one/tiktok/chatbot), [TikTok LIVE Connector: rachas](https://ttlc.docs.isaackogan.com/guides/gifts/). La documentación técnica no acredita acceso a una cuenta ni recepción de paquetes reales.
