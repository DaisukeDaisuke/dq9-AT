import {templateMatrix} from './monster-webgpu.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};const abort=signal=>{if(signal?.aborted)throw new DOMException('生成を中止しました','AbortError');};const yieldTask=()=>new Promise(r=>setTimeout(r,0));
export class MonsterCPU {
 constructor(){this.disposed=false;this.backendId='cpu-unlit-v1';}
 async createTemplateAtlas(model,{views,tileSize=64,signal,onProgress=()=>{}}={}){
  abort(signal);need(!this.disposed&&[32,64,128].includes(tileSize)&&Array.isArray(views)&&views.length>0&&views.length<=16,'CPUテンプレート設定が不正です');need(model.counts?.triangles<=20000&&model.vertices?.length<=40000*11,'CPU形状予算を超えています');
  const columns=Math.min(4,views.length),width=columns*tileSize,height=Math.ceil(views.length/columns)*tileSize,rgba=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<views.length;i++){abort(signal);if(this.disposed)throw Error('CPU renderer released');const tile=await rasterTile(model,views[i],tileSize,signal);const ox=(i%columns)*tileSize,oy=Math.floor(i/columns)*tileSize;for(let y=0;y<tileSize;y++)rgba.set(tile.subarray(y*tileSize*4,(y+1)*tileSize*4),((oy+y)*width+ox)*4);onProgress({completedViews:i+1,totalViews:views.length});await yieldTask();}
  let destroyed=false;return{width,height,rgba,format:'rgba8unorm',tileSize,byteLength:rgba.byteLength,renderedViews:views.length,views:views.map((v,i)=>({...v,x:(i%columns)*tileSize,y:Math.floor(i/columns)*tileSize})),destroy(){destroyed=true;this.rgba=null;},get destroyed(){return destroyed;}};
 }
 destroy(){this.disposed=true;}
}
export async function rasterTile(model,view,size,signal){
 const m=templateMatrix(model.templateBounds??model.bounds,view.yaw,view.pitch),v=model.vertices,indices=model.indices,p=new Float64Array(v.length/11*8),rgba=new Uint8ClampedArray(size*size*4),depth=new Float64Array(size*size).fill(Infinity);
 for(let i=0;i<v.length/11;i++){const at=i*11,to=i*8,x=v[at],y=v[at+1],z=v[at+2],f=r=>m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r];p[to]=(f(0)+1)*size/2;p[to+1]=(1-f(1))*size/2;p[to+2]=f(2);for(let j=3;j<8;j++)p[to+j]=v[at+j];}
 const cross=(ax,ay,bx,by,x,y)=>(bx-ax)*(y-ay)-(by-ay)*(x-ax);let triangles=0;
 for(const call of model.drawCalls){const mat=model.materials[call.materialId];need(mat&&mat.rgba.length===mat.width*mat.height*4,'Material bounds invalid');for(let i=call.firstIndex;i<call.firstIndex+call.indexCount;i+=3){
  if(++triangles%128===0){abort(signal);await yieldTask();}const aa=indices[i]*8,bb=indices[i+1]*8,cc=indices[i+2]*8,ax=p[aa],ay=p[aa+1],bx=p[bb],by=p[bb+1],cx=p[cc],cy=p[cc+1],area=cross(ax,ay,bx,by,cx,cy);if(!area||(mat.cullBack&&area>=0)||(mat.cullFront&&area<0))continue;
  const loX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),loY=Math.max(0,Math.floor(Math.min(ay,by,cy))),hiX=Math.min(size-1,Math.ceil(Math.max(ax,bx,cx))),hiY=Math.min(size-1,Math.ceil(Math.max(ay,by,cy)));
  for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){const wa=cross(bx,by,cx,cy,x+.5,y+.5)/area,wb=cross(cx,cy,ax,ay,x+.5,y+.5)/area,wc=1-wa-wb;if(wa<0||wb<0||wc<0)continue;const q=y*size+x,z=wa*p[aa+2]+wb*p[bb+2]+wc*p[cc+2];if(z>=depth[q])continue;const f=k=>wa*p[aa+k]+wb*p[bb+k]+wc*p[cc+k];
   const coord=(u,n,axis)=>{const repeat=mat.textureParams&(1<<(16+axis)),mirror=mat.textureParams&(1<<(18+axis));if(repeat){if(mirror){u=((u%2)+2)%2;if(u>1)u=2-u;}else u=((u%1)+1)%1;}return Math.max(0,Math.min(n-1,Math.floor(u*n)));};
   const u=coord(f(3),mat.width,0),t=coord(f(4),mat.height,1),texel=(t*mat.width+u)*4;if(mat.rgba[texel+3]<128)continue;depth[q]=z;rgba[q*4+3]=255;for(let k=0;k<3;k++)rgba[q*4+k]=Math.max(0,Math.min(255,Math.round(mat.rgba[texel+k]*f(5+k))));
  }
 }}abort(signal);return rgba;
}
