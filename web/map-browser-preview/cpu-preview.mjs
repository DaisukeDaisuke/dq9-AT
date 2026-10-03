// Portable diagnostic rasterizer. Float64 clip/interpolation and RGBA8888 output.
// This is NOT the DS fixed-point raster, native depth24, fog or pixel parity.
const W=256,H=192;
const transform=(m,v)=>Array.from({length:4},(_,r)=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
const plane=[v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2]];
function clip(poly){for(const distance of plane){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),ina=da>=0,inb=db>=0;if(ina)out.push(a);if(ina!==inb){const t=da/(da-db);out.push(a.map((x,k)=>x+t*(b[k]-x)));}}poly=out;if(!poly.length)break;}return poly;}
const edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
function texelIndex(v,n,repeat,flip){let i=Math.floor(v);if(!repeat)return Math.max(0,Math.min(n-1,i));const period=flip?n*2:n;i=((i%period)+period)%period;return i<n?i:period-1-i;}
export function rasterizePreviewPackets(packets,{view,projection,clearRGBA}){
 if(![view,projection].every(m=>Array.isArray(m)&&m.length===16&&m.every(Number.isFinite)))throw Error('Explicit view/projection16 required');
 if(!Array.isArray(clearRGBA)||clearRGBA.length!==4||clearRGBA.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Explicit diagnostic clear RGBA required');
 const rgba=new Uint8ClampedArray(W*H*4),depth=new Float64Array(W*H);depth.fill(Infinity);for(let i=0;i<W*H;i++)rgba.set(clearRGBA,i*4);
 const stats={submittedPackets:packets.draws.length,acceptedPackets:0,sourceTriangles:0,clippedTriangles:0,fragments:0,rejected:[]};
 for(const p of packets.draws){let reason=null;if(p.polygonMode!==0)reason='Only modulation mode0 implemented';else if(p.alpha===0)reason='Wireframe not implemented';else if(p.polygonAttribute&0x4000)reason='Equal-depth comparison not implemented';else if(p.texture&&(p.texture.output!=='8888'||p.texture.pixels.length!==p.texture.width*p.texture.height*4))reason='RGBA8888 texture required';
  if(reason){stats.rejected.push({instanceId:p.instanceId,shapeIndex:p.shapeIndex,reason});continue;}stats.acceptedPackets++;
  const face=p.polygonAttribute>>>6&3;if(!face)continue;const texture=p.texture??{width:1,height:1,pixels:new Uint8Array([255,255,255,255])};
  for(let at=0;at<p.vertices.length;at+=24){stats.sourceTriangles++;const input=[];for(let k=0;k<3;k++){const v=Array.from(p.vertices.slice(at+k*8,at+k*8+8));input.push([...transform(projection,transform(view,[...v.slice(0,3),1])),...v.slice(3)]);}
   const polygon=clip(input);for(let k=1;k+1<polygon.length;k++){const tri=[polygon[0],polygon[k],polygon[k+1]];if(tri.some(v=>!v.every(Number.isFinite)||v[3]===0))continue;
    const screen=tri.map(v=>[(v[0]/v[3]+1)*W/2,(1-v[1]/v[3])*H/2,v[2]/v[3],1/v[3]]),[a,b,c]=screen,area=edge(a,b,c[0],c[1]);if(!area)continue;const front=area<0;if((face===1&&front)||(face===2&&!front))continue;stats.clippedTriangles++;
    const x0=Math.max(0,Math.ceil(Math.min(...screen.map(v=>v[0]))-.5)),x1=Math.min(W-1,Math.floor(Math.max(...screen.map(v=>v[0]))-.5)),y0=Math.max(0,Math.ceil(Math.min(...screen.map(v=>v[1]))-.5)),y1=Math.min(H-1,Math.floor(Math.max(...screen.map(v=>v[1]))-.5));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const weights=[edge(b,c,x+.5,y+.5)/area,edge(c,a,x+.5,y+.5)/area,edge(a,b,x+.5,y+.5)/area];if(weights.some(w=>w<0))continue;const z=(weights.reduce((s,w,i)=>s+w*screen[i][2],0)+1)/2,index=y*W+x;if(z>=depth[index])continue;const invW=weights.reduce((s,w,i)=>s+w*screen[i][3],0);if(!invW)continue;const attr=offset=>weights.reduce((s,w,i)=>s+w*tri[i][offset]*screen[i][3],0)/invW;
     const sx=texelIndex(attr(7),texture.width,p.sampler.repeatS,p.sampler.flipS),sy=texelIndex(attr(8),texture.height,p.sampler.repeatT,p.sampler.flipT),t=(sy*texture.width+sx)*4,alpha=texture.pixels[t+3]/255*p.alpha;if(alpha===0)continue;const dest=index*4;
     for(let ch=0;ch<3;ch++)rgba[dest+ch]=Math.round(texture.pixels[t+ch]*attr(4+ch)*alpha+rgba[dest+ch]*(1-alpha));rgba[dest+3]=Math.round(255*alpha*alpha+rgba[dest+3]*(1-alpha));if(p.alpha===1||(p.polygonAttribute&0x800))depth[index]=z;stats.fragments++;
    }
   }
  }
 }
 return {width:W,height:H,rgba,previewDepth:depth,stats,scope:'CPU diagnostic pixels only. Float64 raster/interpolation, no DS pixel/depth/fog parity. Do not feed previewDepth into native fog.'};
}
