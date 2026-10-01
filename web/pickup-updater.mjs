// Reached 0208f588 AT/countdown slice. Motion phases and invocation scheduling
// remain external. Refill branches stop before their first possible AT draw.
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const need=(p,m)=>{if(!p)throw Error(m);};
const view=new DataView(new ArrayBuffer(4));
export function floatFromBits(bits){need(uint(bits),'float bits must be uint32');view.setUint32(0,bits,true);return view.getFloat32(0,true);}
export function floatBits(value){view.setFloat32(0,value,true);return view.getUint32(0,true);}
export function stepPickupUpdater(state,input){
 let next={cursor:state?.cursor,accumulatorBits:state?.accumulatorBits,words:{...state?.words}},group=null;
 const done=(resolved,reason,extra={})=>({resolved,reason,consumed:0,minimumConsumed:0,state:next,group,...extra,worldResolved:false,motionResolved:false});
 try{
  need(uint(next.cursor,99)&&uint(next.accumulatorBits),'initial cursor/accumulator unknown');
  const previous=floatFromBits(next.accumulatorBits);need(Number.isFinite(previous)&&previous>=0&&previous<=60,'bounded finite accumulator required');
  need(input?.reached===true,'updater reachability unknown');
  need(input.motionCannotMutateATInputs===true,'preceding motion/global alias effects unresolved');
  if(input.networkBlocked===true)return done(true,'network gate');
  need(input.networkBlocked===false,'network gate unknown');
  need(uint(input.scaledDelta,50),'scaled delta0..50 required');
  // Native soft-float int conversion, division by 1000.0f, then float addition.
  const accumulated=Math.fround(previous+Math.fround(input.scaledDelta/1000));
  next.accumulatorBits=floatBits(accumulated);
  if(accumulated<60&&next.cursor===0)return done(true,'minute not due');
  if(accumulated>=60)next.accumulatorBits=0;
  group=next.cursor;
  need(Object.hasOwn(next.words,group)&&uint(next.words[group]),'selected initial/derived group word unknown');
  let word=next.words[group],skip=(word>>>31)===0,type=(word>>>29)&3;
  if(type===2||type===3){const key=type===2?1944:1942;need(typeof input.eventFlags?.[key]==='boolean','selected group story gate unknown');skip||=!input.eventFlags[key];}
  if(skip){next.cursor=(group+1)%100;return done(true,'inactive or gated group',{beforeWord:word,afterWord:word});}
  const mask=(word>>>17)&255,count=(word>>>9)&15,popcount=mask.toString(2).replaceAll('0','').length,countdown=word&511;
  if(countdown===0)return done(false,'refill branch reached before its AT calls',{beforeWord:word,enabledCount:popcount,capacity:count});
  if(popcount!==count||group>=98)word=((word&0xfffffe00)|((countdown-1)&511))>>>0;
  next.words[group]=word;next.cursor=(group+1)%100;
  return done(true,'positive countdown group',{beforeWord:state.words[group],afterWord:word,enabledCount:popcount,capacity:count});
 }catch(error){return done(false,error.message);}
}
