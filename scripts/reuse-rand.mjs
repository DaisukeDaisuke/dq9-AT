import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../web/vendor/rand.js',import.meta.url),'utf8');
const ar=source.match(/function ARand\(seed\)\{[\s\S]*?\n\}/)?.[0];
const shift=source.match(/function rightShift\(num, shift\) \{[\s\S]*?\n\}/)?.[0];
if(!ar||!shift)throw Error('Existing rand.js function boundaries changed');
await fs.writeFile(new URL('../web/vendor/arand-reference.mjs',import.meta.url),'// ARand and rightShift copied verbatim from supplied rand.js; build/runtime reference.\n'+ar+'\n'+shift+'\nexport {ARand};\n');
console.log('Copied existing ARand without changing its specification');
