// Sparse conditional AT-output constraints. Never turns a video sighting into a
// certified spawn, assigns an unknown gap, or enumerates elapsed draws.
import {monsterForRandom} from './at-core.mjs';
const M=1n<<31n,A=0x41c64e6dn,C=0x3039n;
function floorSum(n,m,a,b){let result=0n;for(;;){if(a>=m){result+=(n-1n)*n*(a/m)/2n;a%=m;}if(b>=m){result+=n*(b/m);b%=m;}const y=a*n+b;if(y<m)return result;n=y/m;b=y%m;[m,a]=[a,m];}}
function below(n,a,b,y){if(y<=0n)return 0n;if(y>=M)return n;return n-(floorSum(n,M,a,b+M-y)-floorSum(n,M,a,b));}
function affine(count){let am=1n,ac=0n,mul=A,add=C;while(count){if(count&1n){ac=(ac*mul+add)%M;am=am*mul%M;}add=add*(mul+1n)%M;mul=mul*mul%M;count>>=1n;}return{mul:am,add:ac};}

/** State is AFTER the weighted draw, modulo2^31; each class has two uint32 states.
 * Union table hypotheses. An unavailable table preserves an unconstrained branch.
 */
export function weightedStateConstraint(tables,tableIds,monsterId){
 if(!Array.isArray(tableIds)||!tableIds.length||!tableIds.every(Number.isInteger)||!Number.isInteger(monsterId))throw Error('Explicit table candidates and monster ID required');
 const ids=[...new Set(tableIds)],unknown=ids.filter(id=>!tables[String(id)]),ranges=[];let start=null;
 for(let r=0;r<=32768;r++){
  const match=r<32768&&(unknown.length>0||ids.some(id=>Number(monsterForRandom(tables[String(id)],r).monster?.monsterId)===monsterId));
  if(match&&start===null)start=r;
  if(!match&&start!==null){ranges.push({first:start*65536,last:r*65536-1});start=null;}
 }
 const classes=ranges.reduce((n,r)=>n+r.last-r.first+1,0);
 return{kind:'conditional-weighted-state-constraint',stateBoundary:'immediately-after-weighted-draw-not-current-video-time',modulus:2147483648,tableIds:ids,monsterId,ranges,outputEquivalenceClasses:classes,fullUint32States:classes*2,unresolvedTables:unknown,conditional:true,naturalPathCertified:false,spawnTimeKnown:false};
}

/** Count exact affine interval intersections in O(ranges^2 log2^31).
 * An exact gap is a caller assumption, NOT measured from timestamps or frames.
 */
export function countGivenExactATGap(first,second,gap){
 if(!first?.ranges||!second?.ranges||first.modulus!==Number(M)||second.modulus!==Number(M))throw Error('Expected modulo2^31 state constraints');
 if((typeof gap!=='bigint'&&(!Number.isSafeInteger(gap)||gap<0))||BigInt(gap)<0n)throw Error('Gap must be a nonnegative integer');
 const{mul,add}=affine(BigInt(gap)%M);let count=0n;
 for(const x of first.ranges)for(const y of second.ranges){
  for(const r of [x,y])if(!Number.isInteger(r.first)||!Number.isInteger(r.last)||r.first<0||r.last<r.first||r.last>=Number(M))throw Error('Invalid state interval');
  const n=BigInt(x.last-x.first+1),b=mul*BigInt(x.first)+add;
  count+=below(n,mul,b,BigInt(y.last)+1n)-below(n,mul,b,BigInt(y.first));
 }
 return{kind:'conditional-exact-gap-count',assumedExactATGap:String(gap),outputEquivalenceClasses:Number(count),fullUint32States:Number(count*2n),gapCertified:false,currentStateRecovered:false,uniqueFullState:false};
}

/** Store an unresolved edge without replacing its missing maximum by a search cap. */
export function unresolvedObservationRelation({from,to,minimumCalls=0,generationOrderKnown=false}){
 if(!from||!to||from===to||!Number.isSafeInteger(minimumCalls)||minimumCalls<0)throw Error('Distinct observation IDs and nonnegative minimum required');
 return{kind:'unresolved-AT-observation-relation',from,to,minimumCalls,maximumCalls:null,generationOrderKnown,latentOffscreenEventsPossible:true,newSpawnCertified:false,minimumProvenCalls:0};
}
