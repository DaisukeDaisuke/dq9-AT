export function readNativeModelInfo(bytes){
 if(!(bytes instanceof Uint8Array))throw new Error('Uint8Array required');const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),require=(at,n)=>{if(!Number.isInteger(at)||at<0||at+n>bytes.length)throw new Error('Native model span outside file');},magic=at=>String.fromCharCode(...bytes.subarray(at,at+4));
 require(0,16);if(magic(0)!=='BMD0'||d.getUint16(4,true)!==0xfeff)throw new Error('Observed little-endian BMD0 required');
 const count=d.getUint16(14,true);require(16,count*4);const blocks=[];
 for(let i=0;i<count;i++){const offset=d.getUint32(16+4*i,true);require(offset,8);const length=d.getUint32(offset+4,true);require(offset,length);blocks.push({offset,bytes:length,magic:magic(offset)});}
 const mdl=blocks.find(b=>b.magic==='MDL0');if(!mdl)throw new Error('No MDL0');const dict=mdl.offset+8;require(dict,8);const models=d.getUint8(dict+1),entryOffset=d.getUint16(dict+6,true);require(dict+entryOffset,4);const unitSize=d.getUint16(dict+entryOffset,true);if(unitSize!==4)throw new Error('Unsupported MDL0 dictionary entry width');require(dict+entryOffset+4,models*4);
 const records=[];for(let i=0;i<models;i++){const offset=mdl.offset+d.getUint32(dict+entryOffset+4+i*4,true);require(offset,64);const size=d.getUint32(offset,true);require(offset,size);const r={index:i,offset,size,sbcOffset:d.getUint32(offset+4,true),materialOffset:d.getUint32(offset+8,true),shapeOffset:d.getUint32(offset+12,true),envelopeOffset:d.getUint32(offset+16,true),rawInfo14:[...bytes.subarray(offset+0x14,offset+0x1c)],positionScale:d.getInt32(offset+0x1c,true),inversePositionScale:d.getInt32(offset+0x20,true),rawCounts24:[...bytes.subarray(offset+0x24,offset+0x2c)],bounding:[0,1,2,3,4,5].map(k=>d.getInt16(offset+0x2c+k*2,true)),boundingScale:d.getInt32(offset+0x38,true),inverseBoundingScale:d.getInt32(offset+0x3c,true)};
 if(!(64<=r.sbcOffset&&r.sbcOffset<=r.materialOffset&&r.materialOffset<=r.shapeOffset&&r.shapeOffset<=r.size))throw new Error('Unsupported native model section ordering');
 records.push(r);}
 return {fileBytes:bytes.length,declaredFileBytes:d.getUint32(8,true),blocks,modelCount:models,models:records};
}
export function nativeBoundingBoxFx(model){
 const multiply=n=>Number(BigInt.asIntN(32,(BigInt(n)*BigInt(model.boundingScale)+0x800n)>>12n));
 return {min:model.bounding.slice(0,3).map(multiply),extent:model.bounding.slice(3,6).map(multiply)};
}
export function nativeSbcPositionScale(model,option,stateFlags=0){
 // Native SBC low opcode0x0b, high bits0 use pos scale; other options use inverse.
 if(!Number.isInteger(option)||option<0||option>224||option%32)throw new Error('Native SBC option high bits required');if(stateFlags&0x300)return null;
 const scale=option===0?model.positionScale:model.inversePositionScale;return [scale,scale,scale];
}
