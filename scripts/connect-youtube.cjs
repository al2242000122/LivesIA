'use strict';
const { startYouTubeAuthorization } = require('../lib/youtube-oauth-setup');

const SAFE_SETUP_CODES = new Set([
  'youtube_auth_usage', 'youtube_auth_path', 'youtube_auth_client',
  'youtube_auth_exists', 'youtube_auth_denied', 'youtube_auth_setup',
  'youtube_auth_timeout', 'youtube_auth_cancelled', 'youtube_auth_listener'
]);

function diagnosticCode(error) {
  return SAFE_SETUP_CODES.has(error?.code) ? error.code : 'youtube_auth_setup';
}

async function main(args = process.argv.slice(2)) {
  if (args.length < 2 || args.length > 3 || (args[2] && args[2] !== '--overwrite')) {
    throw Object.assign(new Error('youtube_auth_usage'), {code: 'youtube_auth_usage'});
  }
  const flow = await startYouTubeAuthorization({
    clientFile: args[0], authFile: args[1], overwrite: args[2] === '--overwrite'
  });
  console.log(`Open this local page in your browser: ${flow.localUrl}`);
  await flow.done;
  console.log('Private authorization saved.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`OAuth setup did not complete (${diagnosticCode(error)}). Check paths, Desktop client and authorization.`);
    process.exitCode = 1;
  });
}
module.exports = {diagnosticCode, main};
