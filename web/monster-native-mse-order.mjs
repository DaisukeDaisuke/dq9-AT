import{readNaturalBodySceneOrder}from'./monster-native-scene-order.mjs';
// Submission proof only. Native opaque sorting is unchanged; manual translucent
// lists retain map -> actor -> MSE order after the complete opaque depth pass.
export function readNaturalBodyMseOrder({sdk,fieldOverlay}){
 const ordinary=readNaturalBodySceneOrder({sdk,fieldOverlay}),spans=[];
 for(const[address,length,expected]of[[0x021965e8,0x190,0xdd6ac536],[0x02196c80,0x2e0,0x666c2e2b]]){let fnv=2166136261;for(const b of fieldOverlay.read(address,length))fnv=Math.imul(fnv^b,16777619)>>>0;if(fnv!==expected)throw Error('Ordinary field actor/MSE source differs');spans.push({address,length,fnv});}
 for(const[address,target]of[[0x021966c4,0x02196784],[0x02196754,0x02196c80],[0x02196f20,0x0207ba90]]){const b=fieldOverlay.read(address,4),word=new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);if(word!==((0xeb000000|((target-address-8)>>2)&0xffffff)>>>0))throw Error('Ordinary actor/MSE call differs');}
 return{kind:'source-ordinary-map-actor-MSE-order-v1',ordinary,spans,worldActorCall:0x021966c4,uiMseCall:0x02196754,mseCall:0x02196f20,currentRouteObserved:false,scope:'Conditional ordinary submission order; opaque native sorting/depth first, then manual map/actor/MSE translucency. Other intervening actors/UI/effects and current enable/fade/offsets remain unknown.'};
}
