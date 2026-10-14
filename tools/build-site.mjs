import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const check=spawnSync(process.execPath,['tools/validate-unlocks.mjs'],{stdio:'inherit'});
if(check.status!==0)process.exit(check.status||1);
const source=path.resolve('site'),destination=path.resolve('dist');
await fs.mkdir(destination,{recursive:true});
// The deployment allowlist contains only the frontend; no saves/reports are copied.
for(const entry of await fs.readdir(destination))await fs.rm(path.join(destination,entry),{recursive:true,force:true});
await fs.cp(source,destination,{recursive:true,filter:name=>!['.DS_Store'].includes(path.basename(name))});
console.log(`Static site ready: ${destination}`);
