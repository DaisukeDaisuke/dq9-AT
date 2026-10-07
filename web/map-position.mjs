import {mapRegistrationKernelMetadata} from './map-kernel-loader.mjs?v=registration-timing-20261007-0020';
// Pixel-space registration reuses the ROM-composed minimap and camera ROI.
// Scores are similarity, not calibrated probabilities or AT evidence.
function luma(image){const v=new Uint8Array(image.width*image.height),a=new Uint8Array(v.length);for(let i=0;i<v.length;i++){v[i]=(77*image.rgba[i*4]+150*image.rgba[i*4+1]+29*image.rgba[i*4+2])>>8;a[i]=image.rgba[i*4+3];}return {v,a};}
function resize(source,sw,sh,w,h){const out=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.max(0,(x+.5)*sw/w-.5),sy=Math.max(0,(y+.5)*sh/h-.5),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,sw-1),y1=Math.min(y0+1,sh-1),u=sx-x0,v=sy-y0;out[y*w+x]=Math.round((source[y0*sw+x0]*(1-u)+source[y0*sw+x1]*u)*(1-v)+(source[y1*sw+x0]*(1-u)+source[y1*sw+x1]*u)*v);}return out;}
export class MapPositionMatcher {
 constructor(instance){this.e=instance.exports;this.base=Number(this.e.__heap_base.value);if(!this.e.map_registration)throw Error('マップ位置照合WASMがありません');this.reference=null;}
 setReference(image){if(!image||!image.width||!image.height){this.reference=null;return;}this.reference={...image,...luma(image)};}
 match(frame,{scales=[.5],excluded=[],minimumSamples=150,coarseSeeds=6,maxMilliseconds=Infinity,denseTranslation=false,translationSeed=null}={}){
  if(!this.reference)return {resolved:false,reason:'ROM map not selected',candidates:[]};
  if(typeof denseTranslation!=='boolean')throw Error('Dense registration mode must be explicit');
  if(translationSeed!==null&&(!translationSeed||Array.isArray(translationSeed)||!['dx','dy'].every(k=>Number.isSafeInteger(translationSeed[k])&&Math.abs(translationSeed[k])<=2048)||!Number.isFinite(translationSeed.scale)||translationSeed.scale<=0||translationSeed.scale>4))throw Error('Bounded previous translation and scale required');
  if(denseTranslation&&translationSeed!==null)throw Error('Previous translation seed is for coarse registration only');
  coarseSeeds=Math.max(6,Math.min(24,Math.floor(coarseSeeds)||6));const started=performance.now(),deadline=started+Math.max(0,maxMilliseconds);let budgetExhausted=false,budgetReason=null,evaluatedTranslations=0,seededTranslations=0;
  const fw=frame.width,fh=frame.height,values=frame.luma??luma(frame).v,valid=new Uint8Array(fw*fh).fill(1),reference=this.reference,candidates=[];
  for(const box of excluded)for(let y=Math.max(0,Math.floor(box.y));y<Math.min(fh,Math.ceil(box.y+box.h));y++)for(let x=Math.max(0,Math.floor(box.x));x<Math.min(fw,Math.ceil(box.x+box.w));x++)valid[y*fw+x]=0;
  for(const scale of scales){if(budgetExhausted)break;if(performance.now()>=deadline){budgetExhausted=true;budgetReason='time-budget';break;}if(!(scale>0))continue;const rw=Math.round(reference.width*scale),rh=Math.round(reference.height*scale);if(rw<4||rh<4||rw>2048||rh>2048)continue;
   const ref=resize(reference.v,reference.width,reference.height,rw,rh),alpha=resize(reference.a,reference.width,reference.height,rw,rh);
   const xmin=-rw+12,xmax=fw-12,ymin=-rh+12,ymax=fh-12;
   const runBlock=(x0,x1,y0,y1,stride,sample,min)=>{let ptr=this.base;const put=b=>{const p=ptr;ptr=(ptr+b.length+7)&~7;return p;};const rp=put(ref),ap=put(alpha),fp=put(values),vp=put(valid),op=ptr,count=(Math.floor((x1-x0)/stride)+1)*(Math.floor((y1-y0)/stride)+1),end=op+count*16;
    if(denseTranslation&&evaluatedTranslations+count>65536){budgetExhausted=true;budgetReason='translation-budget';return [];}
    if(end>this.e.memory.buffer.byteLength)this.e.memory.grow(Math.ceil((end-this.e.memory.buffer.byteLength)/65536));new Uint8Array(this.e.memory.buffer,rp,ref.length).set(ref);new Uint8Array(this.e.memory.buffer,ap,alpha.length).set(alpha);new Uint8Array(this.e.memory.buffer,fp,values.length).set(values);new Uint8Array(this.e.memory.buffer,vp,valid.length).set(valid);
    const n=this.e.map_registration(rp,ap,rw,rh,fp,vp,fw,fh,x0,x1,y0,y1,stride,sample,min,op),v=new Float32Array(this.e.memory.buffer,op,n*4),out=[];evaluatedTranslations+=n;for(let i=0;i<n;i++)if(v[i*4+2]>-.5)out.push({dx:v[i*4],dy:v[i*4+1],score:v[i*4+2],samples:v[i*4+3],scale});return out.sort((a,b)=>b.score-a.score);};
   const run=(x0,x1,y0,y1,stride,sample,min)=>{if(maxMilliseconds===Infinity&&!denseTranslation)return runBlock(x0,x1,y0,y1,stride,sample,min);const out=[],rowsPerBlock=denseTranslation?1:8;for(let y=y0;y<=y1;y+=stride*rowsPerBlock){if(budgetExhausted)break;if(performance.now()>=deadline){budgetExhausted=true;budgetReason='time-budget';break;}out.push(...runBlock(x0,x1,y,Math.min(y1,y+stride*(rowsPerBlock-1)),stride,sample,min));}return out.sort((a,b)=>b.score-a.score);};
   if(denseTranslation){candidates.push(...run(xmin,xmax,ymin,ymax,1,1,minimumSamples*3));continue;}
   // The prior is a search seed, not an accepted position. Keep the global
   // pass below so distant competing peaks still affect the same margin gate.
   if(translationSeed?.scale===scale){const x0=Math.max(xmin,translationSeed.dx-4),x1=Math.min(xmax,translationSeed.dx+4),y0=Math.max(ymin,translationSeed.dy-4),y1=Math.min(ymax,translationSeed.dy+4);if(x0<=x1&&y0<=y1){const before=evaluatedTranslations;candidates.push(...run(x0,x1,y0,y1,1,1,minimumSamples*3));seededTranslations+=evaluatedTranslations-before;}}
   const coarse=run(xmin,xmax,ymin,ymax,4,2,minimumSamples),seeds=[];
   for(const p of coarse){if(seeds.every(q=>Math.abs(p.dx-q.dx)>6||Math.abs(p.dy-q.dy)>6))seeds.push(p);if(seeds.length>=coarseSeeds)break;}
   for(const p of seeds)candidates.push(...run(Math.max(xmin,p.dx-4),Math.min(xmax,p.dx+4),Math.max(ymin,p.dy-4),Math.min(ymax,p.dy+4),1,1,minimumSamples*3));
  }
  candidates.sort((a,b)=>b.score-a.score);const peaks=[];for(const p of candidates){if(peaks.every(q=>p.scale!==q.scale||Math.abs(p.dx-q.dx)>3||Math.abs(p.dy-q.dy)>3))peaks.push(p);if(peaks.length===12)break;}
  if(performance.now()>=deadline){budgetExhausted=true;budgetReason='time-budget';}
  const best=peaks[0],margin=best&&peaks[1]?best.score-peaks[1].score:0,kernel=mapRegistrationKernelMetadata(this.e);
  return {kind:'video-map-registration',resolved:!budgetExhausted&&!!best&&best.score>=.65&&margin>=.08,search:{...(kernel?{kernel}:{}),method:denseTranslation?'bounded-dense-translation-fallback':'coarse-grid-then-local-refinement',coarseStride:denseTranslation?1:4,coarseSampleStride:denseTranslation?1:2,coarseSeeds,budgetExhausted,budgetReason,planComplete:!budgetExhausted,translationDomainComplete:false,...(denseTranslation?{translationLimit:65536}:{}),evaluatedTranslations,...(translationSeed?{translationSeed:{...translationSeed,radius:4},seededTranslations}:{}),elapsedMilliseconds:performance.now()-started},best,margin,candidates:peaks,mapId:reference.mapId,descriptor:reference.descriptor,imageWidth:reference.width,imageHeight:reference.height,coordinateSpace:'ROM-composed-image-pixels',worldPositionKnown:false,bootProof:false,interpretation:'Image alignment only. No player/world position unless independently observed marker/transform is supplied.'};
 }
}
