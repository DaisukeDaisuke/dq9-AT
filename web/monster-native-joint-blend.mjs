// Source 020b5678. Explicit one/two-clip, ordinary mapping/callback subset.
// No actor clip, phase, blend weight, model visibility or scene state is guessed.
import {sampleNativeRate0Animation} from './monster-native-animation.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import {fieldNativeNormalize} from './field-preferred-node.mjs';
import {createNativeScalingContext,evaluateNativeNodeScale} from './map-browser-preview/native/native-node-pose.mjs';
const need=(x,m)=>{if(!x)throw Error(m);},i32=x=>Number(BigInt.asIntN(32,BigInt(x))),valid=x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647,xyz=a=>Array.isArray(a)&&a.length===3&&a.every(valid);
const unit=()=>[4096,4096,4096],id=()=>[4096,0,0,0,4096,0,0,0,4096],zero=()=>[0,0,0];
const cross=(a,b)=>[i32((BigInt(a[1])*BigInt(b[2])-BigInt(a[2])*BigInt(b[1])+2048n)>>12n),i32((BigInt(a[2])*BigInt(b[0])-BigInt(a[0])*BigInt(b[2])+2048n)>>12n),i32((BigInt(a[0])*BigInt(b[1])-BigInt(a[1])*BigInt(b[0])+2048n)>>12n)];
const SPANS=[[34297244, 2496, 1979388537], [34359552, 132, 1326092461], [34359780, 280, 1733261378], [34321656, 64, 1926030562], [34324060, 540, 4009020004], [34298676, 560, 149051087], [34358976, 64, 3788227831], [34359080, 204, 493607908]];
const checksum=b=>{let h=0x811c9dc5;for(const x of b)h=Math.imul(h^x,0x1000193)>>>0;return h;};
export function verifyNativeJointBlendSource(sdk){need(sdk?.read,'Original SDK reader required');return{kind:'source-native-joint-blend-v1',spans:SPANS.map(([address,length,hash])=>{const bytes=sdk.read(address,length);need(bytes.length===length&&checksum(bytes)===hash,'Joint blend source mismatch');return{address,length,checksum:hash};})};}
function canonical(p){return{...p,translationFx12:p.flags&4?zero():p.translationFx12.slice(),rotationFx12:p.flags&2?id():p.rotationFx12.slice(),scaleFx12:p.flags&1?unit():p.scaleFx12.slice(),compensationScaleFx12:p.flags&8?unit():p.compensationScaleFx12.slice(),compensationInverseScaleFx12:p.flags&16?unit():p.compensationInverseScaleFx12.slice()};}
/** Callback-result blend, including per-term rounding and joint-scale result
 * triples. These inputs must be results of the explicit source scaling context,
 * not independently blended raw matrices. Degenerate native scratch fallbacks
 * remain unresolved rather than replacing them with a guessed identity. */
export function blendNativeJointResults(source,terms){
 need(source?.kind==='source-native-joint-blend-v1'&&Array.isArray(terms)&&[1,2].includes(terms.length),'Explicit one/two source callback results required');
 for(const t of terms){need(t&&Number.isInteger(t.weightFx)&&t.weightFx>=0&&t.weightFx<=4096&&t.pose&&Number.isInteger(t.pose.flags)&&t.pose.flags>=0&&t.pose.flags<=31,'Supported weight and callback flags required');const p=t.pose;for(const[k,mask]of[['translationFx12',4],['scaleFx12',1],['compensationScaleFx12',8],['compensationInverseScaleFx12',16]])need((p.flags&mask)||xyz(p[k]),'Complete active callback scale/translation result required');need((p.flags&2)||(Array.isArray(p.rotationFx12)&&p.rotationFx12.length===9&&p.rotationFx12.every(valid)),'Complete active callback rotation result required');}
 // Source single-link fast path ignores blend weight and calls through directly.
 if(terms.length===1)return{resolved:true,pose:canonical(terms[0].pose),singleClipPreserved:true,effectiveWeights:[4096]};
 const sum=terms.reduce((s,t)=>s+t.weightFx,0);if(!sum)return{resolved:false,reason:'Original multi-link blender returns0 for zero total weight; no replacement pose',nativeReturn:0};
 const weights=terms.map(t=>sum===4096?t.weightFx:Number((((BigInt(t.weightFx)<<32n)/BigInt(sum))+524288n)>>20n)),p={flags:31,translationFx12:zero(),rotationFx12:Array(9).fill(0),scaleFx12:zero(),compensationScaleFx12:zero(),compensationInverseScaleFx12:zero()};
 for(let n=0;n<terms.length;n++){if(!terms[n].weightFx)continue;const q=canonical(terms[n].pose),weight=weights[n];p.flags&=q.flags;
  for(const[k,mask]of[['scaleFx12',1],['compensationScaleFx12',8],['compensationInverseScaleFx12',16]])for(let j=0;j<3;j++)p[k][j]=(p[k][j]+((q.flags&mask)?weight:(Math.imul(q[k][j],weight)>>12)))|0;
  if(!(q.flags&4))for(let j=0;j<3;j++)p.translationFx12[j]=i32(BigInt(p.translationFx12[j])+((BigInt(q.translationFx12[j])*BigInt(weight))>>12n));
  if(q.flags&2){p.rotationFx12[0]=(p.rotationFx12[0]+weight)|0;p.rotationFx12[4]=(p.rotationFx12[4]+weight)|0;}else for(let j=0;j<6;j++)p.rotationFx12[j]=(p.rotationFx12[j]+(Math.imul(q.rotationFx12[j],weight)>>12))|0;
 }
 const rawFirst=p.rotationFx12.slice(0,3),rawSecond=p.rotationFx12.slice(3,6),rawThird=cross(rawFirst,rawSecond),first=fieldNativeNormalize(rawFirst),third=fieldNativeNormalize(rawThird);
 if(!first||!third)return{resolved:false,reason:'Degenerate original blend reaches scratch-dependent first-result fallback; explicit fallback context not admitted',nativeReturn:null};
 p.rotationFx12=[...first,...cross(third,first),...third];return{resolved:true,pose:p,effectiveWeights:weights,sourceWeightSum:sum,singleClipPreserved:false};
}
/** Ordered SBC node callbacks, one shared native scale context and explicit
 * clips/phases/weights. Node masks/remaps, custom callbacks and unbound initial
 * scale caches are outside this admitted ordinary sequential binding. */
export function planNativeJointBlend(source,{nodeInfo,sbc,terms,defaultCallbackBinding}){
 need(source?.kind==='source-native-joint-blend-v1'&&nodeInfo?.declaredCountMatches&&[0,2].includes(nodeInfo.scalingRule)&&Array.isArray(sbc?.commands)&&sbc.terminated===true&&Array.isArray(sbc.unresolved)&&sbc.unresolved.length===0&&Array.isArray(terms)&&[1,2].includes(terms.length),'Explicit native nodes/SBC and one/two source clips required');
 need(Number.isInteger(nodeInfo.count)&&nodeInfo.count>0&&nodeInfo.count<=64&&Array.isArray(nodeInfo.nodes)&&nodeInfo.nodes.length===nodeInfo.count&&nodeInfo.nodes.every((n,i)=>n&&n.index===i),'Complete source model node sequence required');
 need(defaultCallbackBinding===true,'Explicit ordinary source callback/mapping admission required');
 const sampled=terms.map(t=>{need(Number.isInteger(t.weightFx)&&t.weightFx>=0&&t.weightFx<=4096,'Weight outside source subset');const sample=sampleNativeRate0Animation(t.animation,t.phaseFx);need(sample.nodes.length>=nodeInfo.count,'Clip does not bind every model node');return sample;});
 const context=createNativeScalingContext(),results=[],seen=new Set();for(const c of sbc.commands){if(c.opcode!==6)continue;const d=c.nodeDescription;need(d&&d.flags===0&&[0,32,64,96].includes(c.option)&&Number.isInteger(d.nodeIndex)&&d.nodeIndex>=0&&!seen.has(d.nodeIndex)&&d.nodeIndex<nodeInfo.count&&Number.isInteger(d.parentIndex)&&d.parentIndex>=0&&d.parentIndex<nodeInfo.count,'Unsupported repeated, remapped or segment-scale node callback');seen.add(d.nodeIndex);const callbacks=[];
  for(let i=0;i<terms.length;i++){if(terms.length===2&&terms[i].weightFx===0){callbacks.push(null);continue;}const channel=sampled[i].nodes[d.nodeIndex],node={...nodeInfo.nodes[d.nodeIndex],...channel},pose=evaluateNativeNodeScale(node,d.nodeIndex,d.parentIndex,nodeInfo.scalingRule,context);callbacks.push(pose);}
  const blendTerms=callbacks.map((pose,i)=>({weightFx:terms[i].weightFx,pose:pose??{flags:31}})),blend=blendNativeJointResults(source,blendTerms);need(blend.resolved,blend.reason);
  results.push({offset:c.offset,nodeIndex:d.nodeIndex,parentIndex:d.parentIndex,rule:nodeInfo.scalingRule,pose:{...blend.pose,nodeIndex:d.nodeIndex,parentIndex:d.parentIndex,rule:nodeInfo.scalingRule},callbacks,effectiveWeights:blend.effectiveWeights});
 }
 return{kind:'source-native-ordered-joint-blend-plan-v1',results,terms:terms.map((t,i)=>({phaseFx:t.phaseFx,weightFx:t.weightFx,clip:t.animation.parsed.name,clampedPhaseFx:sampled[i].clampedPhaseFx,resourceFlags:sampled[i].resourceFlags,integerFrame:sampled[i].frame,fractionFx:sampled[i].fraction,nextFrame:sampled[i].nextFrame,interpolationEnabled:sampled[i].interpolationEnabled})),scope:'Explicit source J0AC/default-scaling/no-remap one/two-clip result plan only; live clip, visibility, material and user callback state remain unknown',liveStateKnown:false};
}
