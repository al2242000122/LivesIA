'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const files=fs.readdirSync('tests').filter(file=>file.endsWith('.test.cjs')).sort().map(file=>`tests/${file}`);
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error){console.error(result.error.message);process.exit(1);}
process.exit(result.status??1);
