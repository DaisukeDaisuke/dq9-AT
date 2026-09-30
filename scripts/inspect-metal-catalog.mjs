import fs from 'node:fs/promises';
const enc=JSON.parse(await fs.readFile(new URL('../web/data/enc.json',import.meta.url),'utf8')).main;
const found=new Map();for(const[t,table]of Object.entries(enc))for(const m of table.data||[])if([3,27,76,181,242,294,295,297].includes(Number(m.monsterId))){const key=m.monsterId+':'+m.monsterName;if(!found.has(key))found.set(key,{...m,tables:[]});found.get(key).tables.push(Number(t));}console.log(JSON.stringify([...found.values()].map(({start,end,tables,...m})=>({...m,tableCount:tables.length,firstTables:tables.slice(0,8)})),null,2));
