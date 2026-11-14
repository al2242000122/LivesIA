'use strict';
const { startYouTubeAuthorization } = require('../lib/youtube-oauth-setup');
(async()=> {
 const args=process.argv.slice(2);
 if(args.length < 2 || args.length > 3 || (args[2] && args[2] !== '--overwrite')) throw new Error('youtube_auth_usage');
 const flow=await startYouTubeAuthorization({clientFile:args[0],authFile:args[1],overwrite:args[2]==='--overwrite'});
 console.log(`Abre esta página local en tu navegador: ${flow.localUrl}`);
 await flow.done;
 console.log('Autorización privada guardada.');
})().catch(()=>{console.error('No se completó la configuración OAuth. Verifica rutas, cliente Desktop y autorización.');process.exitCode=1;});
