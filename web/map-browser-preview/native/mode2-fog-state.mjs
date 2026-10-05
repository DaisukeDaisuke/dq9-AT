/* SPDX-License-Identifier: GPL-2.0-or-later
 * ROM source02052714 fog evaluator. No clock, selector or GPU-gate defaults.
 * This pure stage does not discover current state or certify a video match.
 */
import {readFogRecord} from './fog-records.mjs';
const f=x=>{const y=Math.fround(x);if(!Number.isFinite(y)||(y!==0&&Math.abs(y)<2**-126))throw Error('Mode2 fog float subset exceeded');return y;};
const i=(x,lo,hi,label)=>{if(!Number.isInteger(x)||x<lo||x>hi)throw Error('Explicit '+label+' required');return x;};
export function readMode2FogWriterRules(sdk){
 const spans=[[0x02052714,0x338,0xec1ccb91]];
 for(const[a,n,w]of spans){let h=2166136261;for(const b of sdk.read(a,n))h=Math.imul(h^b,16777619)>>>0;if(h!==w)throw Error('Mode2 fog source differs');}
 return{source:0x02052714,spans,writerGate:{address:0x020536bc,managerOffset:0x85},selection:{selectorOffset:0x90,timeFloatOffset:0x94,timeIndexOffset:0x98,intensityOffset:0x20},lightOverrideAffectsFog:false};
}
/** inheritedRecords are the seven56-byte ROM fog records AFTER inheritance.
 * Fog uses the ordinary time pair even when the light-only overlay overrides
 * light selection. A false writer gate means retained GPU fog is unknown here;
 * it does NOT mean disabled fog and is never silently converted to enabled.
 */
export function evaluateMode2FogState({sdk,inheritedRecords,rules,inputs}){
 const evidence=readMode2FogWriterRules(sdk),selector=i(inputs?.selector,0,6,'selector'),intensity=i(inputs?.intensityFx,0,4096,'post-transition intensity');
 if(typeof inputs?.fogWriterEnabled!=='boolean')throw Error('Explicit fog writer gate required');
 let index=selector,next=selector,coefficient=null;
 if(selector===0){index=i(inputs.timeIndex,0,3,'timeIndex');const time=inputs.timeFloat;if(typeof time!=='number'||f(time)!==time)throw Error('Explicit float32 time required');if(rules?.kind!=='native-mode2-rules')throw Error('ROM time rules required');
  const delta=f(time-f(rules.timeBoundaries[index]-rules.duration)),scaled=f(f(intensity/4096)*delta);coefficient=scaled<0?0:f(scaled/rules.duration);if(coefficient<0||coefficient>1)throw Error('Mode2 fog extrapolation outside supported subset');next=(index+1)&3;
 }
 const a=readFogRecord(inheritedRecords,index),b=readFogRecord(inheritedRecords,next);
 for(const r of[a,b]){i(r.alphaOnly,0,1,'fog alphaOnly');i(r.shift,0,10,'fog shift');i(r.offset,0,32767,'fog offset');i(r.rgb555,0,32767,'fog color');i(r.alpha,0,31,'fog alpha');for(const v of r.density)i(v,0,127,'fog density');}
 const lerp=(x,y)=>Math.trunc(f(f(x)+f(f(y-x)*coefficient))),record=selector?{...a,density:a.density.slice()}:{alphaOnly:a.alphaOnly,shift:a.shift,offset:lerp(a.offset,b.offset),rgb555:[0,5,10].reduce((c,s)=>c|(lerp(a.rgb555>>>s&31,b.rgb555>>>s&31)<<s),0),alpha:lerp(a.alpha,b.alpha),density:Uint8Array.from(a.density,(x,k)=>lerp(x,b.density[k]))};
 const selected={selector,index,next,coefficient};
 if(!inputs.fogWriterEnabled)return{ready:false,record,selected,evidence,reason:'Writer skipped: retained GPU fog registers are required; gate false is not fog disabled',currentEnvironmentCertified:false};
 return{ready:true,record,selected,evidence,parameters:{enabled:true,alphaOnly:record.alphaOnly!==0,shift:record.shift,offset:record.offset,color:(record.rgb555|record.alpha<<16)>>>0,density:record.density.slice()},currentEnvironmentCertified:false};
}
