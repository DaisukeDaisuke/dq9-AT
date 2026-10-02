// Isolated source-derived clock producer. Does not predict upstream tick intervals,
// VBlank scheduling, or certify a world/AT lower bound.
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
export function deriveFrameClock({elapsedLow,elapsedHigh,scaleWord,pendingFrames},{maxUnits,unitsPerDelta,scaleDivisor,frameDivisor}){
 if(![maxUnits,unitsPerDelta,scaleDivisor,frameDivisor].every(x=>Number.isFinite(x)&&x>0))return {resolved:false,reason:'ROM-bound clock constants required'};
 if(![elapsedLow,elapsedHigh,scaleWord,pendingFrames].every(uint))return {resolved:false,reason:'Original producer argument/word widths required'};
 const scale=(scaleWord<<16)>>16;
 if(scale<0)return {resolved:false,reason:'Negative signed time scale outside this checked primitive'};
 const capped=elapsedHigh!==0||elapsedLow>maxUnits?maxUnits:elapsedLow;
 const rawDelta=Math.floor(capped/unitsPerDelta);
 const scaledDelta=Math.trunc(Math.fround(Math.fround(rawDelta)*Math.fround(Math.fround(scale)/scaleDivisor)))>>>0;
 const ratioQ12=Math.trunc(Math.fround(Math.fround(scaleDivisor)*Math.fround(Math.fround(scaledDelta)/frameDivisor)))|0;
 return {resolved:true,rawDelta,scaledDelta,phase:Math.min(pendingFrames,3),pendingFramesAfter:0,ratioQ12,scale,cappedUnits:capped,worldResolved:false,bootProof:false};
}
