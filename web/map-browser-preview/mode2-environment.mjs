// Source-derived YDQJ rev0 mode2 selection and two-light writes. No live time defaults.
// This module does not alter a scene, evaluate fog, or replace the mode1 renderer.
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,decodeNumber,readPoolString,u32} from './vendor/call-stream.mjs';
import {nativeAsciiNameCandidates} from './native/native-file-name.mjs';
import {fxNormalize} from './native/native-camera-fx.mjs';
const fields=['field40','field8c','field8e','field42','field44','field46','field48'];
const f=x=>{const y=Math.fround(x);if(!Number.isFinite(y)||(y!==0&&Math.abs(y)<2**-126))throw Error('MODE2_FLOAT_SUBSET: nonfinite/subnormal operation is unproved');return y;};
const finiteInput=x=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.fround(x)!==x)throw Error('Explicit finite float32 input required');return f(x);};
const integer=(x,lo,hi,label)=>{if(!Number.isInteger(x)||x<lo||x>hi)throw Error(label+' outside supported range');return x;};
const clone=x=>({...x,direction:x.direction.slice()});
function reader(sdk){
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);};
 const float=a=>{const b=sdk.read(a,4);return finiteInput(new DataView(b.buffer,b.byteOffset,4).getFloat32(0,true));};
 const expect=(a,w)=>{if(word(a)!==(w>>>0))throw Error('Mode2 source instruction differs at '+a.toString(16));};
 const string=a=>{const b=sdk.read(a,96),n=b.indexOf(0);if(n<0||b.subarray(0,n).some(x=>x>127))throw Error('Unsupported environment request string');return new TextDecoder().decode(b.subarray(0,n));};
 return {word,float,expect,string};
}
export function readNativeMode2Rules(sdk){
 const r=reader(sdk),{word,float,expect}=r;
 // Pin implemented instruction graphs, not ROM data values or map names.
 const spans=[[0x0207c5b4,0x1a8,0x81c84271],[0x02051974,0x22c,0xf7669fe4],[0x020520f0,0x4fc,0xbef98ca4],[0x02052620,0xf4,0x325d814f],[0x020531f8,0x518,0x2caf48fb],[0x02053714,0xf4,0x3eb98016],[0x020b537c,0x38,0x3535d648],[0x020b53b8,0x14,0x01615a20],[0x0200bf4c,0x5c,0x315ff3e3],[0x0200be88,0x5c,0x8fef68c3],[0x020c49e4,0x118,0x674f7842],[0x020e6678,0x88,0x16479beb],[0x020008a8,0x28,0x37301c05],[0x0200ec8c,0x28,0x43d9a4dc]];
 for(const[a,n,want]of spans){let h=2166136261;for(const b of sdk.read(a,n))h=Math.imul(h^b,16777619)>>>0;if(h!==want)throw Error('Mode2 native code differs at '+a.toString(16));}
 const table=word(0x0207c7c0);if(word(table)!==0x64||word(table+4)!==0x0207c104||word(table+48)!==0x6a||word(table+52)!==0x0207c5b4)throw Error('Mode2 callback dispatch differs');
 // 020008a8 clears the SDK static BSS. 02000910 calls the constructor walker,
 // whose ROM list includes020e6678. The latter builds the time boundaries.
 expect(0x02000910,0xeb0038dd);const module=word(0x02000940),bssStart=word(module+12),bssEnd=word(module+16),target=word(0x020e6704);
 if(target<bssStart||target+20>bssEnd||word(0x020525e4)!==target)throw Error('Time-table initial zero is not source BSS');
 const ctorStart=word(0x0200ecb4),constructors=[];let terminated=false;
 for(let i=0;i<256;i++){const a=word(ctorStart+i*4);if(!a){terminated=true;break;}constructors.push(a);}
 if(!terminated||constructors.filter(a=>a===0x020e6678).length!==1)throw Error('Time initializer not unique in native startup list');
 const constants=word(0x020e6700);if(word(0x020525e8)!==constants)throw Error('Mode2 interpolation duration source differs');
 const duration=float(constants),periods=[1,2,3,4].map(i=>float(constants+i*4));if(duration<=0||periods.some(x=>x<=0))throw Error('Mode2 nonpositive time intervals unsupported');
 const total=f(periods[0]+f(periods[1]+f(periods[2]+periods[3]))),slot0=f(0+periods[3]),slot1=f(slot0+periods[2]),slot2=f(slot1+periods[1]);
 const directionScale=float(0x02053700),directionUpper=word(0x02053704);
 expect(0x02052b38,0xe3a00a01);expect(0x02052b3c,0xe1c402b0);expect(0x02052b48,0xe3a00000);expect(0x02052b4c,0xe1c402b6);
 if(directionScale!==4096||directionUpper!==4087)throw Error('Mode2 direction conversion outside verified subset');
 return {kind:'native-mode2-rules',duration,timeBoundaries:[slot0,slot1,slot2,total],initialIntensityFx:4096,directionScale,directionUpper,
  evidence:{lower:0x0207c5b4,inherit:0x02051974,select:0x020520f0,rgbLerp:0x02052620,update:0x020531f8,lightWrite:0x02053714,compareCarry:[0x0200bf4c,0x0200be88],timeInitializer:0x020e6678,constructorList:ctorStart,timeTable:target,bssStart,bssEnd,constants,spans}};
}
// callback6a stores args6..10 at the FIRST light and args1..5 at the SECOND.
// First-light inheritance carries all seven color fields; second-light inheritance
// carries only its own RGB/direction. Preserve both specified flags.
export function lowerMode2EnvironmentCalls(calls){
 const modes=calls.filter(c=>c.opcode===0x64||c.opcode===0x67);
 if(modes.length!==1||modes[0].opcode!==0x64||modes[0].argumentCount!==1||modes[0].args[0]?.type!==2)throw Error('Mode2 callback64 float argument required');
 finiteInput(decodeNumber(modes[0].args[0]));
 if(calls.some(c=>![0x64,0x65,0x69,0x6a].includes(c.opcode)))throw Error('Unimplemented mode2 callback (including legacy66)');
 if(calls.some(c=>c.opcode===0x65&&c.argumentCount!==0))throw Error('Mode2 callback65 shape unresolved');
 const records=Array(7).fill(null),sources=[];
 for(const c of calls){if(c.opcode!==0x6a)continue;const types=[1,1,2,2,2,1,1,2,2,2,1,1,1,1,1,1,1,1];
  if(c.argumentCount!==18||c.args.length!==18||c.args.some((a,i)=>a.type!==types[i]))throw Error('Mode2 callback6a requires exact typed18 arguments');
  const a=c.args.map(decodeNumber),i=integer(a[0],0,6,'Mode2 record index');if(records[i])throw Error('Repeated mode2 record requires source ordering review');
  a.forEach((x,j)=>types[j]===2?finiteInput(x):integer(x,-2147483648,4294967295,'Integer argument'));
  records[i]={lights:[{specified:a[6]!==0,color555:a[10]&65535,direction:a.slice(7,10)},{specified:a[1]!==0,color555:a[5]&65535,direction:a.slice(2,5)}],field40:a[13]&65535,field8c:a[11]&65535,field8e:a[12]&65535,field42:a[14]&65535,field44:a[15]&65535,field46:a[16]&65535,field48:a[17]&65535};sources.push({index:i,callIndex:c.index,callOffset:c.offset});
 }
 if(records.some(x=>!x))throw Error('All seven explicit mode2 records required; constructor fallback not substituted');
 const inherited=records.map(x=>({...x,lights:x.lights.map(clone)})),copies=[];
 for(let light=0;light<2;light++){
  if(!records.slice(0,4).some(r=>r.lights[light].specified))throw Error('MODE2_NO_SPECIFIED_LIGHT: no-specified inheritance is unproved here');
  for(let i=0;i<4;i++){if(records[i].lights[light].specified)continue;let source=null;for(let n=1;n<=3;n++){const k=(i-n+4)&3;if(records[k].lights[light].specified){source=k;break;}}
   if(source===null)throw Error('Mode2 inheritance predecessor absent');inherited[i].lights[light]={...clone(inherited[source].lights[light]),specified:false};if(light===0)for(const k of fields)inherited[i][k]=inherited[source][k];copies.push({light,destination:i,source});
  }
 }
 return {kind:'native-mode2-records',mode:2,records,inherited,copies,sources,fogEvaluated:false};
}
export function readRomMode2Environment(project,record){
 const rules=readNativeMode2Rules(project.sdk),r=reader(project.sdk),bytes=new Uint8Array(project.nfs.readFile('data/map/maplist9.bin')),pool=u32(bytes,4);
 const matches=parseCalls(bytes).filter(c=>c.opcode===0x67&&c.args[0]?.type===1&&(decodeNumber(c.args[0])&65535)===record.mapId);
 if(matches.length!==1)throw Error('Native map-ID environment definition absent/repeated');const call=matches[0];
 if(call.index!==record.source.callIndex||call.offset!==record.source.callOffset||call.args[11]?.type!==0)throw Error('ROM map record identity or environment argument differs');
 const name=readPoolString(bytes,pool,call.args[11]);if(!name||!/^[A-Za-z0-9_]+$/.test(name))throw Error('Environment name outside supported native ASCII subset');
 const format=r.string(r.word(0x020149c8)),directory=r.string(r.word(0x020149cc)),memberFormat=r.string(r.word(0x02014ae0));if(format!=='%s/ats_%c.ambl'||memberFormat!=='%s.bats')throw Error('Native environment request format differs');
 const archive=format.replace('%s',directory).replace('%c',name[0]),member=memberFormat.replace('%s',name),z=Narc.load(new Uint8Array(project.nfs.readFile(archive))),found=nativeAsciiNameCandidates(z.files.map((_,index)=>({name:z.fnt.getFilenameOf(index),index})),member);
 if(found.length!==1)throw Error('Native mode2 resource absent/ambiguous');const raw=z.files[found[0].index],data=raw[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw;
 return {...lowerMode2EnvironmentCalls(parseCalls(data)),rules,source:{archive,member:found[0].name,archiveIndex:found[0].index,maplistArgument:11,callIndex:call.index,callOffset:call.offset,consumer:0x0201c374}};
}
export function interpolateMode2Rgb555(a,b,coefficient){
 integer(a,0,65535,'Source color');integer(b,0,65535,'Next color');finiteInput(coefficient);if(coefficient<0||coefficient>1)throw Error('MODE2_FACTOR_SUBSET: coefficient outside0..1');
 const c=[0,5,10].map(s=>{const x=a>>>s&31,y=b>>>s&31;return Math.trunc(f(f(x)+f(f(y-x)*coefficient)));});return c[0]|c[1]<<5|c[2]<<10;
}
/** Pure evaluation of020520f0 and the direction/color write subset of020531f8.
 * Required selector is native manager+90. For selector0 supply timeIndex (+98),
 * timeFloat (+94), and timeOverrideIndex: null when the actual overlay predicate
 * is false, otherwise its returned byte0..3. Never infer that predicate from a map.
 * intensityFx is the explicit POST-transition manager+20 value. Its writer/time
 * stepping is outside this function; rules.initialIntensityFx is an initial profile.
 */
export function evaluateMode2Environment(environment,inputs){
 if(environment?.kind!=='native-mode2-records'||environment.rules?.kind!=='native-mode2-rules'||!inputs)throw Error('Source mode2 environment/rules and explicit inputs required');
 const rules=environment.rules,selector=integer(inputs.selector,0,6,'Explicit selector'),intensity=integer(inputs.intensityFx,0,4096,'Explicit post-transition intensityFx');
 let index=selector,next=selector,coefficient=null,selection='forced-selector';
 if(selector===0){
  index=integer(inputs.timeIndex,0,3,'Explicit timeIndex');const time=finiteInput(inputs.timeFloat);
  if(!Object.hasOwn(inputs,'timeOverrideIndex'))throw Error('Explicit timeOverrideIndex null or0..3 required; live overlay predicate is unknown');
  // 0200bf4c returns CY=1 for finite a>=b; MOVCC/BCC clamps negative delta.
  const delta=f(time-f(rules.timeBoundaries[index]-rules.duration));coefficient=delta<0?0:f(delta/rules.duration);
  if(inputs.timeOverrideIndex!==null){index=integer(inputs.timeOverrideIndex,0,3,'Explicit timeOverrideIndex');coefficient=0;selection='overlay-time-override';}else selection='ordinary-time';
  if(coefficient>1)throw Error('MODE2_FACTOR_SUBSET: timeIndex/timeFloat produce extrapolation; no upper clamp invented');next=(index+1)&3;
 }
 const a=environment.inherited[index],b=environment.inherited[next];if(!a||!b)throw Error('Source selected records absent');
 const selected={};for(const k of fields)selected[k]=selector?a[k]:interpolateMode2Rgb555(a[k],b[k],coefficient);
 const lights=a.lights.map((l,i)=>({color555:selector?l.color555:interpolateMode2Rgb555(l.color555,b.lights[i].color555,coefficient),direction:l.direction.map((x,k)=>selector?finiteInput(x):f(x+f(f(b.lights[i].direction[k]-x)*coefficient)))}));
 const writes=lights.map((light,id)=>{
  if(light.color555>32767)throw Error('MODE2_COLOR_SUBSET: forced light color with bit15 set requires signed setter review');
  // 0200be88 CY=1,Z=0 exactly for finite positive input; BLS chooses -0.5
  // for <=0. Truncation is0200c4c0; zero becomes trunc(-0.5)==0.
  const beforeNormalize=light.direction.map(x=>{const scaled=f(x*rules.directionScale),rounded=f(scaled+(x>0?0.5:-0.5));if(rounded< -2147483648||rounded>=2147483648)throw Error('MODE2_DIRECTION_SUBSET: signed conversion overflow');return Math.trunc(rounded)||0;});
  if(beforeNormalize.every(x=>x===0))throw Error('MODE2_ZERO_DIRECTION: hardware divide/sqrt zero branch unproved');
  const squared=beforeNormalize.reduce((s,x)=>s+BigInt(x)*BigInt(x),0n);if(squared*4n>0x7fffffffffffffffn)throw Error('MODE2_DIRECTION_SUBSET: native64-bit square overflow');
  const directionFx=fxNormalize(beforeNormalize).map(x=>Math.min(rules.directionUpper,x));
  const channels=[0,5,10].map(s=>Math.trunc(f(f(light.color555>>>s&31)*f(intensity/rules.directionScale)))),color555=intensity===4096?light.color555:(channels[0]|channels[1]<<5|channels[2]<<10)&65535;
  const directionWord=(((directionFx[0]>>3)&1023)|((directionFx[1]>>3)&1023)<<10|((directionFx[2]>>3)&1023)<<20|id<<30)>>>0;
  return {id,sourceColor555:light.color555,color555,directionFloat:light.direction,beforeNormalize,directionFx,directionWord,colorWord:(color555|id<<30)>>>0};
 });
 return {ready:true,mode:2,source:environment.source??null,selection:{kind:selection,selector,index,next,coefficient,timeIndex:selector?null:inputs.timeIndex,timeFloat:selector?null:inputs.timeFloat},selected,lights:writes,materialWrites:{diffuseAmbient:selected.field46},intensityFx:intensity,
  unmodifiedLightIds:[2,3],fogParameters:null,fogEvaluated:false,evidence:rules.evidence,
  scope:'Conditional native mode2 color and lights0/1 evaluator. Caller supplies current selector/time/overlay result and post-transition intensity. No current-state discovery, scene replay, fog, global light2/3 replacement or native pixel acceptance.'};
}
