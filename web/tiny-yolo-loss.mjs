// New vectorized DQ9 training objective over the pretrained Tiny YOLOv2 output.
// Uses TensorFlow.js autograd. No per-box Tensor.get/set, predicted-box CPU reads, or custom GPU kernels.
export const LOSS_VERSION='dq9-yolo-anchor-loss-v1';
export const COCO_ANCHORS=Object.freeze([[.57,.68],[1.87,2.06],[3.34,5.47],[7.88,3.53],[9.77,9.17]]);
const need=(x,m)=>{if(!x)throw Error(m);};
export function targetArrays(samples,{inputSize,classes,anchors=COCO_ANCHORS}={}){
 need(Number.isInteger(inputSize)&&inputSize>=32&&inputSize<=640&&inputSize%32===0,'Input size must be32..640 in multiples of32');need(Number.isInteger(classes)&&classes>=1&&classes<=512,'Invalid class count');need(Array.isArray(samples)&&samples.length>=1&&samples.length<=16,'Batch must contain1..16 samples');need(anchors.length>=1&&anchors.length<=9&&anchors.every(a=>a.length===2&&a.every(x=>Number.isFinite(x)&&x>0)),'Invalid anchors');
 const grid=inputSize/32,count=samples.length*grid*grid*anchors.length,pos=new Float32Array(count),xy=new Float32Array(count*2),wh=new Float32Array(count*2),oneHot=new Float32Array(count*classes),assignments=[];
 samples.forEach((sample,batch)=>{need(sample.exhaustive===true&&Array.isArray(sample.boxes),'Training requires exhaustive boxes or explicitly enemy-free images');for(const box of sample.boxes){const{x,y,w,h,label}=box;need([x,y,w,h].every(Number.isFinite)&&w>0&&h>0&&x>=0&&y>=0&&x+w<=1+1e-7&&y+h<=1+1e-7&&Number.isInteger(label)&&label>=0&&label<classes,'Invalid normalized ground truth');const cx=(x+w/2)*grid,cy=(y+h/2)*grid,column=Math.min(grid-1,Math.floor(cx)),row=Math.min(grid-1,Math.floor(cy)),gw=w*grid,gh=h*grid;
  const ranking=anchors.map(([aw,ah],anchor)=>{const inter=Math.min(aw,gw)*Math.min(ah,gh);return{anchor,iou:inter/(aw*ah+gw*gh-inter)};}).sort((a,b)=>b.iou-a.iou||a.anchor-b.anchor);const match=ranking.find(({anchor})=>pos[((batch*grid+row)*grid+column)*anchors.length+anchor]===0);need(match,'Too many overlapping objects for cell anchors; label collision is not silently dropped');const index=((batch*grid+row)*grid+column)*anchors.length+match.anchor,[aw,ah]=anchors[match.anchor];pos[index]=1;xy.set([cx-column,cy-row],index*2);wh.set([Math.log(gw/aw),Math.log(gh/ah)],index*2);oneHot[index*classes+label]=1;assignments.push({batch,row,column,anchor:match.anchor,index,label,box});
 }});
 return{pos,xy,wh,oneHot,assignments,count,classes,grid,batch:samples.length,anchors:anchors.length,positiveCount:assignments.length,lossVersion:LOSS_VERSION};
}
export function makeTargets(tf,arrays){const tensors={pos:tf.tensor1d(arrays.pos),xy:tf.tensor2d(arrays.xy,[arrays.count,2]),wh:tf.tensor2d(arrays.wh,[arrays.count,2]),oneHot:tf.tensor2d(arrays.oneHot,[arrays.count,arrays.classes])};return{...arrays,...tensors,dispose(){for(const t of Object.values(tensors))t.dispose();}};}
export function detectorLoss(tf,raw,t,{coordinateScale=1,objectScale=5,noObjectScale=1,classScale=1}={}){
 need(raw.shape.length===4&&raw.shape[0]===t.batch&&raw.shape[1]===t.grid&&raw.shape[2]===t.grid&&raw.shape[3]===t.anchors*(5+t.classes),'Output/target shape mismatch');
 return tf.tidy(()=>{const z=raw.reshape([t.count,5+t.classes]),xy=tf.sigmoid(z.slice([0,0],[t.count,2])),wh=z.slice([0,2],[t.count,2]),objectness=tf.sigmoid(z.slice([0,4],[t.count,1]).reshape([t.count])),logClass=tf.logSoftmax(z.slice([0,5],[t.count,t.classes]),1),negative=tf.sub(1,t.pos),positiveDen=Math.max(1,t.positiveCount),negativeDen=Math.max(1,t.count-t.positiveCount);
 const coordinateLoss=tf.sum(tf.mul(t.pos,tf.add(tf.sum(tf.square(tf.sub(xy,t.xy)),1),tf.sum(tf.square(tf.sub(wh,t.wh)),1)))).mul(coordinateScale/positiveDen);
 const objectLoss=tf.sum(tf.mul(t.pos,tf.square(tf.sub(objectness,1)))).mul(objectScale/positiveDen);
 const noObjectLoss=tf.sum(tf.mul(negative,tf.square(objectness))).mul(noObjectScale/negativeDen);
 const classLoss=tf.neg(tf.sum(tf.mul(t.oneHot,logClass))).mul(classScale/positiveDen);
 return{coordinateLoss,objectLoss,noObjectLoss,classLoss,totalLoss:tf.addN([coordinateLoss,objectLoss,noObjectLoss,classLoss])};});
}
export function referenceLoss(raw,t,{coordinateScale=1,objectScale=5,noObjectScale=1,classScale=1}={}){
 const sigmoid=x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));let coordinateLoss=0,objectLoss=0,noObjectLoss=0,classLoss=0;const posDen=Math.max(1,t.positiveCount),negDen=Math.max(1,t.count-t.positiveCount),stride=5+t.classes;
 for(let i=0;i<t.count;i++){const at=i*stride,p=sigmoid(raw[at+4]);if(t.pos[i]){for(let q=0;q<2;q++)coordinateLoss+=coordinateScale/posDen*((sigmoid(raw[at+q])-t.xy[i*2+q])**2+(raw[at+2+q]-t.wh[i*2+q])**2);objectLoss+=objectScale/posDen*(p-1)**2;let max=-Infinity,sum=0,target=0;for(let c=0;c<t.classes;c++){max=Math.max(max,raw[at+5+c]);if(t.oneHot[i*t.classes+c])target=raw[at+5+c];}for(let c=0;c<t.classes;c++)sum+=Math.exp(raw[at+5+c]-max);classLoss+=classScale/posDen*(Math.log(sum)+max-target);}else noObjectLoss+=noObjectScale/negDen*p*p;}
 return{coordinateLoss,objectLoss,noObjectLoss,classLoss,totalLoss:coordinateLoss+objectLoss+noObjectLoss+classLoss};
}
