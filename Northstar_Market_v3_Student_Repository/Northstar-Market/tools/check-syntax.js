const fs=require('node:fs');
const path=require('node:path');
const { execFileSync }=require('node:child_process');
const directories=['.','lib','routes','public'];
let total=0;
for(const dir of directories){
  for(const item of fs.readdirSync(path.join(__dirname,'..',dir))){
    if(!item.endsWith('.js'))continue;
    const file=path.join(__dirname,'..',dir,item);
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
    total++;
  }
}
console.log(`Checked ${total} JavaScript files`);
