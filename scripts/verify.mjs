import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const directory=mkdtempSync(join(tmpdir(),'smartfarm-tests-'));
try{
 mkdirSync(join(directory,'lib'));mkdirSync(join(directory,'tests'));
 const zod=import.meta.resolve('zod');
 for(const name of ['pump-timing','water-tank','alert-state','original-site-settings','project-state']){
  const runtime=readFileSync(resolve('supabase/functions/smartfarm-fn/lib',name+'.ts'),'utf8').replaceAll('npm:zod@4.6.5',zod);
  writeFileSync(join(directory,'lib',name+'.ts'),runtime);
 }
 const files=readdirSync('tests').filter(name=>name.endsWith('.test.mjs'));
 for(const name of files){
  let test=readFileSync(join('tests',name),'utf8');
  test=test.replaceAll('../src/api-client.js',pathToFileURL(resolve('src/api-client.js')).href);
  writeFileSync(join(directory,'tests',name),test);
 }
 const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...files.map(name=>join(directory,'tests',name))],{stdio:'inherit'});
 if(result.status!==0)process.exitCode=1;
 for(const file of ['src/main.js','src/api-client.js','src/supabase.js','public/site/app.js','public/site/auth.js','public/site/admins.js','public/site/operations.js']){
  const parsed=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(parsed.status!==0)process.exitCode=1;
 }
}finally{rmSync(directory,{recursive:true,force:true});}
