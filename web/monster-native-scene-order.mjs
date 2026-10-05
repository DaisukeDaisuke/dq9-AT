/* Source-backed ordinary field ordering, independent of model/map ID.
 * This is a conditional draw route, not proof that a live actor took it. */
const need=(v,m)=>{if(!v)throw Error(m);};
export function readNaturalBodySceneOrder({sdk,fieldOverlay}){
 const word=(s,a)=>{const b=s.read(a,4);return new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);},call=(s,a,t)=>need(word(s,a)===(0xeb000000|((t-a-8)>>2)&0xffffff)>>>0,'Natural field draw-order call differs at '+a.toString(16));
 // Both ordinary map calls precede actor dispatch within this function. Branches
 // may skip drawing, but there is no backwards edge from actor dispatch to map.
 const spans=[[fieldOverlay,0x02196784,0x30c,0xa9591ef6],[fieldOverlay,0x02196f60,0x98,0x03378516],[fieldOverlay,0x021a2828,0x2bc,0x8ae93e7a],[sdk,0x02077b08,0xcc,0x1119b8e5]];
 const evidence=[];for(const[s,address,length,expected]of spans){let fnv=2166136261;for(const b of s.read(address,length))fnv=Math.imul(fnv^b,16777619)>>>0;need(fnv===expected,'Natural field draw-order source span differs at '+address.toString(16));evidence.push({address,length,fnv});}
 call(fieldOverlay,0x021967ec,0x02016614);call(fieldOverlay,0x021968b8,0x02016614);call(fieldOverlay,0x021969a8,0x02196f60);call(fieldOverlay,0x02196fcc,0x021a2828);call(fieldOverlay,0x021a2a18,0x02077b08);call(sdk,0x02077b34,0x02032b14);
 return{kind:'source-ordinary-map-before-natural-body-v1',source:evidence,mapCalls:[0x021967ec,0x021968b8],actorDispatch:0x021969a8,naturalDrawCall:0x021a2a18,ordinaryActorWrapper:0x02077b34,currentRouteObserved:false,scope:'Ordinary field main/secondary map submission precedes natural field actor wrapper. Conditional isolated actor only: other actors, callbacks, shadows, scripted effects and MSE overlap are not reconstructed.'};
}
