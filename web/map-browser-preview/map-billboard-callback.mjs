// DQ9-specific BBY callback020e4b60 -> common020e48f4 mode0.
// Separate from the SDK default BBY handler, which this callback suppresses.
import{fxNormalize}from'./native/native-camera-fx.mjs';
export function buildMapYBillboardCallback({mode,modelViewFx,previousTemplate,dirtyFlag,contextFlags}){
 if(mode!==0)throw Error('Only observed map Y-billboard callback mode0 accepted');
 if(!Array.isArray(modelViewFx)||modelViewFx.length!==16||modelViewFx.some(v=>!Number.isInteger(v)||v< -2147483648||v>2147483647))throw Error('Explicit post-projection-identity native model-view required');
 if(!(previousTemplate instanceof Uint8Array)||previousTemplate.length!==72||!Number.isInteger(dirtyFlag)||!Number.isInteger(contextFlags))throw Error('Preserved72byte template and native flags required');
 const packet=previousTemplate.slice(),d=new DataView(packet.buffer);if(d.getUint32(0,true)!==0x1b171012||d.getInt32(4,true)!==1||d.getInt32(8,true)!==2)throw Error('Unrecognized callback template');
 const contextFlagsAfter=(contextFlags|0x40)>>>0;if(contextFlags&0x100)return{emitted:false,packet,nextTemplate:packet.slice(),dirtyFlagAfter:dirtyFlag,contextFlagsAfter};
 for(let k=0;k<3;k++)d.setInt32(0x30+k*4,modelViewFx[12+k],true);
 let dirtyFlagAfter=dirtyFlag,normalizedY=false;if((modelViewFx[5]!==0||modelViewFx[6]!==0)&&dirtyFlag!==0){const n=fxNormalize(modelViewFx.slice(4,7));n.forEach((v,k)=>d.setInt32(0x18+k*4,v,true));d.setInt32(0x28,-d.getInt32(0x20,true),true);d.setInt32(0x2c,d.getInt32(0x1c,true),true);dirtyFlagAfter=0;normalizedY=true;}
 return{emitted:true,packet,nextTemplate:packet.slice(),dirtyFlagAfter,contextFlagsAfter,normalizedY,scope:'Observed callback mode0 packet math. Requires actual model-view/template/dirty state; scene integration and mode1 remain separate.'};
}
