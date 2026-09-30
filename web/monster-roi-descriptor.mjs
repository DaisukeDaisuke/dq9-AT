// Deterministic, small ROM-only color descriptor. Experimental, uncalibrated scores.
const need=(v,m)=>{if(!v)throw Error(m);};
export function validateRGBA(image,maxPixels=1024*1024){need(image&&Number.isInteger(image.width)&&Number.isInteger(image.height)&&image.width>0&&image.height>0&&image.width*image.height<=maxPixels,'画像範囲が大きすぎるか不正です');need(image.rgba instanceof Uint8Array||image.rgba instanceof Uint8ClampedArray,'RGBA画素が必要です');need(image.rgba.length===image.width*image.height*4,'RGBAの長さが一致しません');return image;}
function hsv(r,g,b){const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=((h/6)%1+1)%1;}return[h,max?d/max:0];}
export function cropRGBA(image,x,y,width,height){validateRGBA(image,4096*4096);need([x,y,width,height].every(Number.isInteger)&&x>=0&&y>=0&&width>0&&height>0&&x+width<=image.width&&y+height<=image.height,'切り抜き範囲が不正です');const rgba=new Uint8ClampedArray(width*height*4);for(let row=0;row<height;row++)rgba.set(image.rgba.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+x+width)*4),row*width*4);return{width,height,rgba};}
export function colorDescriptor(input,{template=false}={}){
 validateRGBA(input);let x0=0,y0=0,x1=input.width,y1=input.height;
 if(template){x0=input.width;y0=input.height;x1=0;y1=0;for(let y=0;y<input.height;y++)for(let x=0;x<input.width;x++)if(input.rgba[(y*input.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}if(x1<=x0||y1<=y0)return{values:new Float64Array(24),foregroundPixels:0,empty:true};}
 const width=Math.max(1,Math.round((x1-x0)*48/Math.max(x1-x0,y1-y0))),height=Math.max(1,Math.round((y1-y0)*48/Math.max(x1-x0,y1-y0)));let selected=[],fallback=[];
 // Explicit bilinear sampling, independent of canvas implementation.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const fx=Math.max(x0,Math.min(x1-1,x0+(x+.5)*(x1-x0)/width-.5)),fy=Math.max(y0,Math.min(y1-1,y0+(y+.5)*(y1-y0)/height-.5)),ix=Math.floor(fx),iy=Math.floor(fy),jx=Math.min(x1-1,ix+1),jy=Math.min(y1-1,iy+1),dx=fx-ix,dy=fy-iy;
  const channel=k=>(input.rgba[(iy*input.width+ix)*4+k]*(1-dx)*(1-dy)+input.rgba[(iy*input.width+jx)*4+k]*dx*(1-dy)+input.rgba[(jy*input.width+ix)*4+k]*(1-dx)*dy+input.rgba[(jy*input.width+jx)*4+k]*dx*dy)/255;
  const r=channel(0),g=channel(1),b=channel(2),alpha=channel(3);if(alpha<.5)continue;const v=hsv(r,g,b);fallback.push(v);if(template||(b-r<.065&&g-r<.12&&Math.max(r,g,b)>.08))selected.push(v);
 }
 const foregroundPixels=selected.length;if(selected.length<5)selected=fallback;const values=new Float64Array(24);for(let i=0;i<16;i++)values[i]=1e-8;let hueSum=16e-8;
 for(const[h,s]of selected){values[Math.min(15,Math.floor(h*16))]+=s;hueSum+=s;values[16+Math.min(7,Math.floor(s*8))]++;}
 for(let i=0;i<16;i++)values[i]=Math.sqrt(values[i]/hueSum);for(let i=16;i<24;i++)values[i]=Math.sqrt(values[i]/Math.max(1,selected.length));
 return{values,foregroundPixels,sampledPixels:width*height,empty:fallback.length===0,mask:'fixed blue/teal exclusion; uncalibrated scene-specific heuristic',resize:'explicit bilinear to max48px'};
}
export function descriptorDistance(a,b){need(a.values?.length===24&&b.values?.length===24,'24成分の記述子が必要です');let d=0;for(let i=0;i<24;i++){const v=a.values[i]-b.values[i];d+=v*v;}return d;}
