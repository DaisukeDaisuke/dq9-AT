import {backwards} from './rom-arm9.mjs';
export function readArm9Overlay(rom,id){
 const d=new DataView(rom.buffer,rom.byteOffset,rom.byteLength),word=o=>{if(o<0||o+4>rom.length)throw Error('NDS header/table span');return d.getUint32(o,true);};
 const table=word(0x50),length=word(0x54),fat=word(0x48),fatLength=word(0x4c);if(length%32||table+length>rom.length)throw Error('Overlay table span');
 const matches=[];for(let o=table;o<table+length;o+=32)if(word(o)===id)matches.push(o);if(matches.length!==1)throw Error('Overlay ID missing/duplicate');
 const o=matches[0],address=word(o+4),ramSize=word(o+8),fileId=word(o+24),flags=word(o+28);if(fileId*8+8>fatLength)throw Error('Overlay FAT index');
 const start=word(fat+fileId*8),end=word(fat+fileId*8+4);if(end<start||end>rom.length)throw Error('Overlay file span');
 const raw=rom.subarray(start,end),bytes=(flags>>>24&1)?backwards(raw):raw.slice();if(bytes.length!==ramSize)throw Error('Overlay runtime length mismatch');
 return {id,address,ramSize,read(at,size){if(at<address||size<0||at-address+size>bytes.length)throw Error('Overlay address outside initialized bytes');return bytes.subarray(at-address,at-address+size);}};
}
export function readInitialFieldPlayerHeight(rom){
 const overlay=readArm9Overlay(rom,17),at=0x02190078,b=overlay.read(at,12),d=new DataView(b.buffer,b.byteOffset,b.byteLength),w=d.getUint32(0,true),call=d.getUint32(8,true);
 if(((w&0xfffff000)>>>0)!==0xe3a01000)throw Error('Field player height initializer differs');
 if((call>>>24)!==0xeb)throw Error('Height setter call differs');const displacement=(call<<8)>>6,target=(at+8+8+displacement)>>>0;if(target!==0x02037210)throw Error('Unexpected height setter target');
 const n=w&255,r=(w>>>8&15)*2;return {heightFx:((n>>>r)|(n<<(32-r)))>>>0,source:{overlay:17,initializer:at,setter:target},scope:'Normal field entity initial height; later script/follow-subject changes remain separate'};
}
