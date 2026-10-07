// A component ID/count/SSE is not a mask identity. Bind the actual recovered
// selected mask; never recover a same-numbered component in another branch.
import {unpackBackgroundMask} from './map-browser-preview/background-branch-support.mjs?v=native-scene-link-20261007-0354';
const packedOwners=new WeakMap(),sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function originalComponentMaskSHA256(s){
 if(s?.kind!=='original-residual-component-support-v1'||s.ready!==true)return null;
 try{
  if(s.mask instanceof Uint8Array){if(s.mask.length!==49152||s.mask.some(v=>v!==0&&v!==1))return null;return sha(s.mask);}
  const p=s.packedMask;if(p?.encoding!=='bitset-lsb0-base64'||p.width!==256||p.height!==192||p.length!==49152||typeof p.data!=='string')return null;
  // Packed data is an immutable string. A changed encoding/dimension/data
  // cannot reuse a cached hash. Raw mutable masks are always hashed afresh.
  const prior=packedOwners.get(s);if(prior?.data===p.data)return prior.sha256;
  const hash=await sha(unpackBackgroundMask(p));packedOwners.set(s,{data:p.data,sha256:hash});return hash;
 }catch{return null;}
}
