// Pixel-only detector for the DQ9 brown, gold-bordered map-name panel.
// It does not identify the name, infer a screen from canvas size, or resolve an area.
// Input must already be a detected/manual upper DS screen normalized to 256x192.
export function detectMapNameROI(image){
 const fail=reason=>({resolved:false,reason,roi:null});
 if(image?.width!==256||image?.height!==192||image?.data?.length!==256*192*4)return fail('native-upper-screen-required');
 const {data}=image;
 const brown=(x,y)=>{const k=(y*256+x)*4,r=data[k],g=data[k+1],b=data[k+2];return r>=35&&r<155&&r>g*1.05&&g>b*1.1;};
 const run=y=>{let right=253;while(right>=249&&!brown(right,y))right--;if(right<249)return null;let left=right;while(left>80&&brown(left-1,y))left--;return {left,right,length:right-left+1};};
 const top=run(2),bottom=run(13);
 if(!top||!bottom||Math.min(top.length,bottom.length)<38||Math.abs(top.left-bottom.left)>3)return fail('panel-interior-not-found');
 const left=Math.max(top.left,bottom.left),right=Math.min(top.right,bottom.right);
 let border=0,gold=0;
 for(let x=left+2;x<right-2;x++){border+=Number(brown(x,0))+Number(brown(x,15));for(const y of [1,14]){const k=(y*256+x)*4;gold+=Number(data[k]>150&&data[k]>data[k+1]*1.08&&data[k+1]>data[k+2]*1.15);}}
 const samples=Math.max(1,(right-left-4)*2);
 if(border/samples<.8||gold/samples<.65)return fail('panel-border-not-confirmed');
 // Exclude the frame and leave internal dark padding; do not crop by white pixels.
 const x=left,y=2,w=right-left+1,h=12;
 let white=0;for(let yy=3;yy<13;yy++)for(let xx=x;xx<x+w;xx++){const k=(yy*256+xx)*4;white+=Number(Math.min(data[k],data[k+1],data[k+2])>150);}
 if(white<12)return fail('panel-text-absent');
 return {resolved:true,reason:'pixel-panel-border',roi:{x:x/256,y:y/192,w:w/256,h:h/192},pixels:{x,y,w,h},evidence:{topRun:top,bottomRun:bottom,borderFraction:border/samples,goldFraction:gold/samples,whitePixels:white},confidenceCalibrated:false};
}
