// ROM maplist -> ordinary field-camera shoulder-input gate.
// Native instructions, not map-name or camera-preset heuristics.
import {parseCalls,decodeNumber} from './vendor/call-stream.mjs';
import {mapCameraRecord} from './native/map-camera-record.mjs';
import {readArm9Overlay} from './rom-overlay.mjs';

const verified=new WeakMap();
function verifySource(project,rom){
 const old=verified.get(rom);if(old?.sdk===project.sdk)return old;
 const overlay=readArm9Overlay(rom,17),regions=[
  ['sdk',0x0209b32c,0x290,0xadde74aa], // opcode67 map-record byte writers
  ['sdk',0x0209b684,0x3c,0x33754b0c], // map-ID lookup returns actual record
  ['sdk',0x020a4618,0x24,0x21e95c28], // camera+244 set/clear flags
  ['sdk',0x020a3f40,0x40,0x2aa2c9ba], // input masks suppressed by flags/gates
  ['overlay17',0x0219ed24,0x5c,0x475b0ba9], // map byte0c -> camera flags
  ['overlay17',0x0219e3dc,0x14,0xf68b723b], // selected record r8 -> argument r3
  ['overlay17',0x0219de0c,0x10,0x1bb918b6], // lookup result -> selected record r8
 ];
 for(const [kind,address,length,expected] of regions){
  let value=2166136261;for(const byte of (kind==='sdk'?project.sdk:overlay).read(address,length))value=Math.imul(value^byte,16777619)>>>0;
  if(value!==expected)throw Error('ROM camera-input source differs at '+address.toString(16));
 }
 const proof={sdk:project.sdk,regions:regions.map(([segment,address,length,fingerprint])=>({segment,address,length,fingerprint}))};verified.set(rom,proof);return proof;
}

/** A source map-level permission, not the current input/camera state.
 * false removes shoulder endpoint hypotheses from an ordinary initial preview.
 * true still leaves area, menu/script and current yaw/transition gates unresolved.
 * An absent/ambiguous record is unresolved, never assumed rotatable or yaw0.
 */
export function readRomMapCameraInputGate(project,rom,record){
 const unresolved=reason=>({ready:false,reason,mapAllowsShoulderInput:null,currentYawCertified:false,minimumProvenATCalls:0});
 if(!project?.sdk||!project?.nfs||!(rom instanceof Uint8Array))return unresolved('ROM project/bytes unavailable');
 if(!Number.isInteger(record?.mapId)||!Number.isInteger(record?.source?.callIndex)||!Number.isInteger(record?.source?.callOffset))return unresolved('Exact source map-record identity unavailable');
 try{
  const proof=verifySource(project,rom),bytes=new Uint8Array(project.nfs.readFile('data/map/maplist9.bin'));
  const matches=parseCalls(bytes).filter(c=>c.index===record.source.callIndex&&c.offset===record.source.callOffset);
  if(matches.length!==1)return unresolved('Source map-record call is absent or ambiguous');
  const call=matches[0],decoded=mapCameraRecord(call,decodeNumber);
  if(!decoded?.supported)return unresolved(decoded?.reason??'Source call is not maplist opcode67');
  if(decoded.mapId!==record.mapId)return unresolved('Selected map ID differs from source record');
  const mapType=decoded.recordByte0c&15,rotationBit=(decoded.recordByte0c>>>7)&1,mapAllowsShoulderInput=mapType!==0&&rotationBit!==0;
  return {ready:true,recordKey:record.key,mapId:record.mapId,recordByte0c:decoded.recordByte0c,mapType,rotationBit,mapAllowsShoulderInput,
   initialCandidatePolicy:mapAllowsShoulderInput?'initial-and-source-L-R-endpoints':'initial-only',
   source:{path:'data/map/maplist9.bin',callIndex:call.index,callOffset:call.offset,arguments:{mapType:{index:3,value:decodeNumber(call.args[3])},rotation:{index:12,value:decodeNumber(call.args[12])}},producer:0x0209b32c,mapIdLookup:0x0209b684,mapGate:0x0219ed24,disabledFlagWrites:[0x0219ed60,0x0219ed6c],allowedFlagClear:0x0219ed78,inputConsumer:0x020a3f40,regions:proof.regions},
   unresolved:['Current yaw and script/transition history are not observed','A source type4 camera region may separately suppress input at the player position','Menu/controller/runtime camera gates are not reconstructed'],
   intermediateYawExplored:false,currentYawCertified:false,minimumProvenATCalls:0,
   scope:'Ordinary initial-preview candidates from the supplied ROM map record. Map-level shoulder permission is not proof that the live camera currently accepts input or remains at yaw0.'};
 }catch(error){return unresolved(error.message);}
}
