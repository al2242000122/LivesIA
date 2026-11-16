'use strict';
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '../.env.local');

// Runtime entry only: tests import/start server.js directly and never load real local credentials.
if (fs.existsSync(envFile)) {
  if (typeof process.loadEnvFile !== 'function') {
    console.error('Local voice configuration requires Node.js 20.12 or later.');
    process.exit(1);
  }
  try {
    process.loadEnvFile(envFile);
  } catch (_) {
    console.error('Could not load local configuration. Do not share its contents or credentials.');
    process.exit(1);
  }
}
require('../server.js');
