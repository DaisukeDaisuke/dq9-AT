/* SPDX-License-Identifier: GPL-2.0-or-later
 * Position-matrix bridge for the original YDQJ SBC BB/BBY handlers.
 * Packet math remains in native-billboard.mjs. No map callback is substituted.
 */
import {buildDefaultBillboardPacket} from './map-browser-preview/native-billboard.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
const i32=v=>Number(BigInt.asIntN(32,v));
const matrix=m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
const affine=m=>matrix(m)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===4096;
const slot=n=>Number.isInteger(n)&&n>=0&&n<31;
function checkTemplate(t){need(t instanceof Uint8Array&&t.byteLength===72,'Preserved native BB/BBY 72-byte template required');const d=new DataView(t.buffer,t.byteOffset,t.byteLength);need(d.getUint32(0,true)===0x1b171012&&d.getInt32(4,true)===1&&d.getInt32(8,true)===2,'Native billboard packet header differs');return t;}
/** ROM initialization is an available starting state, not evidence of live
 * template/flag/callback state. Callers must supply the latter explicitly. */
export function readNativeBodyBillboardSource(sdk){
 need(typeof sdk?.read==='function','Explicit source SDK reader required');
 const word=a=>{const b=sdk.read(a,4);need(b.byteLength===4,'Truncated billboard source word');return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const expect=(a,w)=>need(word(a)===w,'Native billboard instruction differs at '+a.toString(16));
 for(const [a,w]of [[0x020b6bb8,0xe92d47f0],[0x020b6bcC,0xe3100c02],[0x020b6e08,0xe59f00ac],[0x020b6e0c,0xe3a02048],[0x020b6ec0,0xe92d4ff8],[0x020b6ed4,0xe3100c02],[0x020b707c,0xe3510000],[0x020b7084,0x03500000],[0x020b7094,0xeb003652],[0x020b70b8,0xeb003649],[0x020b716c,0xe59f00ac],[0x020b7170,0xe3a02048]])expect(a,w);
 const fullAddress=word(0x020b6ebc),yAddress=word(0x020b7220),globalAddress=word(0x020b6ea4);
 need(word(0x020b720c)===globalAddress,'BB and BBY globals differ');
 need(word(0x020b6e94)===fullAddress+48&&word(0x020b6e98)===fullAddress+60,'BB packet update offsets differ');
 need(word(0x020b71f8)===yAddress+48&&word(0x020b71fc)===yAddress+60&&word(0x020b7200)===yAddress+12,'BBY packet update offsets differ');
 return {kind:'source-default-body-billboard',handlers:{full:0x020b6bb8,y:0x020b6ec0},templateAddresses:{full:fullAddress,y:yAddress},globalAddress,initialTemplates:{full:checkTemplate(sdk.read(fullAddress,72)).slice(),y:checkTemplate(sdk.read(yAddress,72)).slice()},scope:'Original default SBC7/8 handlers only. Initial ROM templates do not certify live callback, flags or prior-call state.'};
}
export function createNativeBodyBillboardState(source,{globalFlags,contextFlags,callbackOverride,templates}={}){
 need(source?.kind==='source-default-body-billboard','Source billboard rules required');
 need(Number.isInteger(globalFlags)&&Number.isInteger(contextFlags)&&callbackOverride===false,'Explicit source flags and callback absence required');
 need(!(globalFlags&3)&&!(contextFlags&0x300),'Inverse camera/object or suppressed billboard branch unsupported');
 return {kind:'source-default-body-billboard-state',globalFlags,contextFlags,callbackOverride,templates:{full:checkTemplate(templates?.full).slice(),y:checkTemplate(templates?.y).slice()},calls:0};
}
/** GX MTX_LOAD_4x3 followed by MTX_SCALE, not a float-facing replacement. */
export function nativeBodyBillboardPacketMatrix(packet){
 checkTemplate(packet);const d=new DataView(packet.buffer,packet.byteOffset,packet.byteLength),w=i=>d.getInt32(4*i,true),out=[w(3),w(4),w(5),0,w(6),w(7),w(8),0,w(9),w(10),w(11),0,w(12),w(13),w(14),4096];
 for(let c=0;c<3;c++)for(let r=0;r<3;r++)out[c*4+r]=i32(BigInt(out[c*4+r])*BigInt(w(15+c))>>12n);
 return out;
}
/** `current` and stack entries are the actual camera-space model-view state
 * immediately before this SBC operation. Restore is before readback; store is
 * after load/scale. `camera` is required to make the coordinate contract explicit.
 * No state or stack is changed when validation or packet construction fails. */
export function executeNativeBodyBillboard(command,{current,stack,camera,state}){
 need(command&&(command.opcode===7||command.opcode===8)&&[0,32,64,96].includes(command.option),'Unsupported source billboard command or option');
 const b=command.billboard;need(b&&Number.isInteger(b.nodeIndex)&&b.nodeIndex>=0&&b.nodeIndex<256,'Decoded source billboard node required');
 need((b.storeSlot!==null)===(command.option===32||command.option===96)&&(b.restoreSlot!==null)===(command.option===64||command.option===96),'Source billboard option/slots disagree');
 need((b.storeSlot===null||slot(b.storeSlot))&&(b.restoreSlot===null||slot(b.restoreSlot)),'Source billboard matrix slot outside geometry stack');
 need(stack instanceof Map&&affine(current)&&affine(camera?.viewFx)&&matrix(camera?.projectionFx),'Source camera-space affine matrix/stack and explicit camera required');
 need(state?.kind==='source-default-body-billboard-state','Explicit persistent source billboard state required');
 let input=current;if(b.restoreSlot!==null){need(stack.has(b.restoreSlot),'Uninitialized source billboard restore');input=stack.get(b.restoreSlot);need(affine(input),'Invalid source billboard restored matrix');}
 const axis=command.opcode===7?'full':'y',result=buildDefaultBillboardPacket({axis,modelViewFx:input,previousTemplate:state.templates[axis],globalFlags:state.globalFlags,contextFlags:state.contextFlags,callbackOverride:state.callbackOverride}),output=nativeBodyBillboardPacketMatrix(result.packet);
 state.templates[axis]=result.nextTemplate;state.calls++;if(b.storeSlot!==null)stack.set(b.storeSlot,output.slice());
 return {current:output,packet:result.packet,branch:result.branch,input:input.slice(),scaleFx:result.scaleFx,translationFx:result.translationFx,axis,nodeIndex:b.nodeIndex,restoreSlot:b.restoreSlot,storeSlot:b.storeSlot};
}
