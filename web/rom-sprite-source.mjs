// Structural source reader for the custom .spr stream consumed by ARM9 02048960.
// This is not a sprite renderer, cell selector, screen locator or UI/absence mask.
// Source: YDQJ rev0, field-overlay17 table consumer0219c1b0 and loader02048960–02048cf4.
// Payload views are opt-in and caller-owned copies; ordinary metadata contains no pixels.
export function parseRomSpriteSource(bytes,{includePayloads=false}={}){
 if(!(bytes instanceof Uint8Array)||typeof includePayloads!=='boolean')throw Error('Expected source sprite bytes and explicit payload option');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0;
 const span=(offset,length,label)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset>bytes.length||length>bytes.length-offset)throw Error('Truncated/out-of-bounds sprite '+label);return{offset,length,...(includePayloads?{bytes:Uint8Array.from(bytes.subarray(offset,offset+length))}:{})};};
 const take=(length,label)=>{const s=span(at,length,label);at+=length;return s;};
 const u16=label=>{const s=take(2,label);return view.getUint16(s.offset,true);};
 const u32=label=>{const s=take(4,label);return view.getUint32(s.offset,true);};
 const frameCount=u16('frame count'),sourceType=u16('source type'),frames=[];
 // Source allocates8 bytes per frame; each serialized frame header is8 bytes.
 if(frameCount>Math.floor((bytes.length-at)/8))throw Error('Truncated sprite frame headers');
 for(let index=0;index<frameCount;index++){
  const offset=at,widthRaw=u16('frame width'),heightRaw=u16('frame height'),cellCountRaw=u32('frame cell count'),width=widthRaw&255,height=heightRaw&255,cellCount=cellCountRaw&255,cells=[];
  if(cellCount>Math.floor((bytes.length-at)/8))throw Error('Truncated sprite cell headers');
  for(let cellIndex=0;cellIndex<cellCount;cellIndex++){
   const cellOffset=at,xRaw=u16('cell X'),yRaw=u16('cell Y'),widthShiftRaw=u16('cell width shift'),heightShiftRaw=u16('cell height shift');
   // Register-shift/product wrap is not a supported structural hypothesis.
   // Do not reinterpret it as a guessed texture size or silently allocate it.
   if(widthShiftRaw>28||heightShiftRaw>28)throw Error('Unsupported wrapping sprite cell shift');
   const cellWidth=8*2**widthShiftRaw,cellHeight=8*2**heightShiftRaw,area=cellWidth*cellHeight;
   if(!Number.isSafeInteger(area)||area>0xffffffff)throw Error('Unsupported wrapping sprite cell area');
   const payloadBytes=sourceType===3?area/2:area,payload=take(payloadBytes,'cell payload');
   cells.push({index:cellIndex,offset:cellOffset,xRaw,yRaw,widthShiftRaw,heightShiftRaw,width:cellWidth,height:cellHeight,sourcePackedSize:(widthShiftRaw|(heightShiftRaw<<4))&65535,sourcePackedOffset:(xRaw|((height-yRaw-cellHeight)<<8))&65535,payload,payloadLengthRule:sourceType===3?'source-type3-area-divided-by2':'source-other-type-area',pixelInterpretationKnown:false});
  }
  frames.push({index,offset,widthRaw,heightRaw,width,height,cellCountRaw,cellCount,cells});
 }
 const paletteCountOffset=at,paletteCountRaw=u32('palette count'),paletteOffset=at,paletteAdvanceBytes=paletteCountRaw*2,paletteUploadBytes=paletteCountRaw<=16?32:paletteCountRaw<=256?512:paletteCountRaw;
 // Loader02048b20 selects the transfer length separately from its count*2 advance.
 const paletteUpload=span(paletteOffset,paletteUploadBytes,'source palette upload'),palette=take(paletteAdvanceBytes,'palette advance');
 const opaqueLayoutHeader=take(30,'opaque layout header'),layoutCountOffset=at,layoutCount=u32('layout count');
 if(layoutCount>0x7fffffff)throw Error('Unsupported negative source layout count');
 if(layoutCount>Math.floor((bytes.length-at)/34))throw Error('Truncated sprite layout records');
 const layouts=[];for(let index=0;index<layoutCount;index++)layouts.push({index,opaqueRecord:take(30,'opaque layout record')});
 for(const layout of layouts){const countOffset=at,keyCount=u32('layout key count');if(keyCount>Math.floor((bytes.length-at)/12))throw Error('Truncated sprite layout key planes');const planes=[];for(let plane=0;plane<3;plane++)planes.push({plane,...take(keyCount*4,'layout key plane')});Object.assign(layout,{countOffset,keyCount,wordBytes:4,planes,keyMeaningKnown:false});}
 return{kind:'rom-custom-sprite-source-structure-v1',sourceReader:{loader:0x02048960,cellPayloadUpload:0x02048cf4,paletteUpload:0x02048d90,layoutAllocation:0x02048eb0},bytes:bytes.length,frameCount,sourceType,frames,paletteCountOffset,paletteCountRaw,palette,paletteUpload,paletteAdvanceBytes,paletteUploadBytes,opaqueLayoutHeader,layoutCountOffset,layoutCount,layouts,consumedBytes:at,trailingBytes:bytes.length-at,renderingSupported:false,unresolved:['Texture mode/index ordering and transparency are not inferred from payload length.','Opaque30-byte layout records and three word planes retain unknown interpretation.','Current cell/animation and screen-placement state are not observed.','No observed command-HUD association, non-enemy classification, mask or absence proof.']};
}
