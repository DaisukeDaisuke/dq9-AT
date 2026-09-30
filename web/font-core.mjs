import './vendor/font/constants.js';
import './vendor/font/font-parser.js';
import './vendor/font/ttf-writer.js';
import './vendor/gp2.js';
// All glyph pixels and generated font bytes stay in the user's ROM session memory.
export function mineRuntimeFonts(nitro){
 const entries=[],archives=[];
 for(const target of globalThis.NdsFontConstants.GP2_TARGETS){const raw=new Uint8Array(nitro.readFile(target.romPath));const members=globalThis.NdsFontGp2.parseGp2(raw);archives.push({path:target.romPath,members:members.length,bytes:raw.length});for(const member of members)entries.push({path:target.key+'/'+member.path,data:member.data});}
 const parsed=globalThis.NdsFontParser.parseFonts(entries),generated=globalThis.NdsFontTtf.generateFontFiles(parsed.glyphsBySize);
 return {format:'dq9-runtime-fonts',version:1,archives,glyphsBySize:parsed.glyphsBySize,fonts:generated.filter(f=>f.name.endsWith('.ttf')),summary:{parsedSources:parsed.parsed.length,glyphs:Object.fromEntries(Object.entries(parsed.glyphsBySize).map(([size,g])=>[size,g.length])),fontFiles:generated.filter(f=>f.name.endsWith('.ttf')).length},source:'vendor/nds-font-converter; runtime NDS only'};
}
