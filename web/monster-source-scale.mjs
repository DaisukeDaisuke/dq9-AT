// Source-derived scale candidates for the ordinary natural field creator.
// This is not a live actor scale, a projection constraint, or an enemy decision.
const need=(value,message)=>{if(!value)throw Error(message);};
const word=(image,address)=>{const bytes=image.read(address,4);return new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true);};
const expect=(image,address,words)=>{words.forEach((expected,index)=>need(word(image,address+index*4)===(expected>>>0),'Unsupported natural actor scale source at '+(address+index*4).toString(16)));};
const signed16=value=>(value<<16)>>16;
export function readNaturalMonsterScaleRule({sdk,fieldOverlay}){
 need(sdk?.read&&fieldOverlay?.read&&fieldOverlay.id===17,'ROM ARM9 SDK image and field overlay17 required');
 // The source numeric argument becomes a signed16 fx12 value, with zero
 // replaced by1.0. Float multiplication/truncation matches the existing
 // convertCreatorScale implementation; neither value is fitted to video.
 expect(sdk,0x0209d828,[0xe1a01000,0xe59f005c,0xebfdbb98,0xebfdbb21,0xe1cd00b2,0xea000005,0xe3500001,0x1a000003,0xe2840008,0xebfe4b7c,0xe1a00600,0xe1cd00b2,0xe1dd00f2,0xe28d2000,0xe3500000,0x03a00a01,0x01cd00b2]);
 need(word(sdk,0x0209d890)===0x45800000,'Unsupported source scale conversion constant');
 // Signed64 product plus0x800, arithmetic shift12, then store low halfwords.
 expect(fieldOverlay,0x021a2d94,[0xe59d0004,0xe59f109c,0xe1a02fc0,0xe0835190,0xe0233192,0xe2955b02,0xe2a30000,0xe1a01625,0xe1811a00,0xe1a00008,0xe1a02001,0xe1a03001]);
 const call=word(fieldOverlay,0x021a2dc4),target=(0x021a2dc4+8+((call<<8)>>6))>>>0;
 need((call>>>24)===0xeb&&target===0x02036f3c,'Unsupported actor scale setter binding');
 expect(sdk,0x02036f3c,[0xe1c015bc,0xe1c025be,0xe1c036b0,0xe12fff1e]);
 // A supported direct actor draw sends these signed fx12 values unchanged
 // to GX_MTX_SCALE. Other dispatch paths and later writers remain unknown.
 expect(sdk,0x02035abc,[0xe1d036f0,0xe1d025fe,0xe1d015fc,0xe59f000c,0xe5801000,0xe5802000,0xe5803000,0xe12fff1e,0x0400046c]);
 const numerator=word(fieldOverlay,0x021a2e3c)|0;
 return {kind:'ordinary-natural-actor-scale-rule',numerator,denominator:4096,roundingBias:2048,actorOffsets:[0x5c,0x5e,0x60],source:{conversion:0x0209d7e8,creator:0x021a2d94,setter:target,directDraw:0x02035abc,gxRegister:0x0400046c},liveStateProven:false,projectionProven:false};
}
export function convertNaturalScaleArgument(argument){
 need(argument&&[1,2].includes(argument.type)&&Number.isFinite(argument.value),'Numeric ROM encounter scale required');let value;
 if(argument.type===1){need(Number.isInteger(argument.value)&&argument.value>=-2147483648&&argument.value<=2147483647,'Integer encounter scale outside signed32');value=argument.value<<12;}
 else{value=Math.trunc(Math.fround(Math.fround(argument.value)*4096));need(value>=-2147483648&&value<=2147483647,'Float encounter scale outside signed32');}
 const result=signed16(value);return result===0?4096:result;
}
export function applyNaturalMonsterScale(itemScale,rule){
 need(Number.isInteger(itemScale)&&itemScale>=-32768&&itemScale<=32767,'Signed16 source table scale required');
 need(rule?.kind==='ordinary-natural-actor-scale-rule'&&Number.isInteger(rule.numerator)&&rule.denominator===4096&&rule.roundingBias===2048,'Verified ordinary scale rule required');
 return signed16(Number((BigInt(itemScale)*BigInt(rule.numerator)+2048n)>>12n));
}
export function naturalMonsterScaleCandidates(encounter,rule,{mapIds,speciesIds}){
 need(Array.isArray(mapIds)&&mapIds.length&&mapIds.every(Number.isInteger)&&Array.isArray(speciesIds)&&speciesIds.length&&speciesIds.every(Number.isInteger),'Explicit retained map and species candidate IDs required');
 need(Array.isArray(encounter?.tables)&&Array.isArray(encounter.groups),'Decoded ROM encounter stream required');
 const maps=new Set(mapIds),species=new Set(speciesIds),candidates=[];
 for(const table of encounter.tables){const group=encounter.groups[table.mapGroupIndex];if(!group||!maps.has(group.mapId))continue;
  for(const row of table.rows){if(!species.has(row.speciesId))continue;const itemScale=convertNaturalScaleArgument(row.scaleArgument),actorScaleFx=applyNaturalMonsterScale(itemScale,rule);candidates.push({mapId:group.mapId,conditions:structuredClone(group.conditions),tableId:table.tableId,tableFlags:table.flagsRaw,speciesId:row.speciesId,sourceOffset:row.sourceOffset,scaleArgument:structuredClone(row.scaleArgument),itemScale,actorScaleFx,modelWorldScale:actorScaleFx/4096});}
 }
 // Keep the creator's missing-table/missing-species default. The current
 // table, actor origin and natural-vs-scripted dispatch have not been observed.
 const defaultScaleFx=applyNaturalMonsterScale(4096,rule);
 return {kind:'ordinary-natural-scale-candidates',candidates,creatorDefault:{itemScale:4096,actorScaleFx:defaultScaleFx,modelWorldScale:defaultScaleFx/4096},sourceRule:structuredClone(rule),selectedCandidate:null,liveScaleProven:false,physicalPlacementProven:false,scope:'Raw source table union plus creator default only. No runtime writer, model-variant, animation phase, 3D position, camera, or occlusion proof; never use this alone to reject a body or infer absence.'};
}
