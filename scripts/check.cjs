'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const files=['server.js','game.js','control.js'];
function collect(directory){
  if(!fs.existsSync(directory))return;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const name=path.join(directory,entry.name);
    if(entry.isDirectory())collect(name);else if(/\.c?js$/.test(name))files.push(name);
  }
}
for(const folder of ['integrations','games','scripts','tests'])collect(folder);
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(1);
}
console.log(`Sintaxis correcta: ${files.length} archivos`);
