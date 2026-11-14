'use strict';
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '../.env.local');

// Runtime entry only: tests import/start server.js directly and never load real local credentials.
if (fs.existsSync(envFile)) {
  if (typeof process.loadEnvFile !== 'function') {
    console.error('La configuración local de voz requiere Node.js 20.12 o posterior.');
    process.exit(1);
  }
  try {
    process.loadEnvFile(envFile);
  } catch (_) {
    console.error('No se pudo cargar la configuración local. No compartas su contenido ni credenciales.');
    process.exit(1);
  }
}
require('../server.js');
