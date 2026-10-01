// View-dependent Nitro SBC matrix state. BB preserves translation and scale;
// BBY preserves its Y-axis projection. Expressions also preserve descendants
// and stack restores following a billboard, rather than freezing one camera.
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mul=(a,b)=>Array.from({length:16},(_,i)=>{let v=0;for(let k=0;k<4;k++)v+=a[k*4+i%4]*b[(i>>2)*4+k];return v;});
export function evaluateBillboardTransform(expression,{yaw=0,pitch=0}={}){
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch))throw Error('Finite billboard view required');
 if(expression.matrix)return expression.matrix;
 const source=evaluateBillboardTransform(expression.source,{yaw,pitch});
 if(expression.multiply)return mul(source,expression.multiply);
 if(!['full','y'].includes(expression.billboard))throw Error('Invalid billboard expression');
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),rotation=[cy,sp*sy,-cp*sy,0,0,cp,sp,0,sy,-sp*cy,cp*cy,0,0,0,0,1],inverse=[cy,0,sy,0,sp*sy,cp,-sp*cy,0,-cp*sy,sp,cp*cy,0,0,0,0,1],camera=mul(rotation,source),result=identity(),scale=[0,1,2].map(c=>Math.hypot(camera[c*4],camera[c*4+1],camera[c*4+2]));
 if(expression.billboard==='y'){
  const norm=a=>{const n=Math.hypot(...a);if(!n)throw Error('Degenerate Y billboard axis');return a.map(v=>v/n);};
  if(Math.abs(camera[5])+Math.abs(camera[6])>1e-12){const y=norm(camera.slice(4,7));result[4]=y[0];result[5]=y[1];result[6]=y[2];result[9]=-y[2];result[10]=y[1];}
  else{const z=norm(camera.slice(8,11));result[8]=z[0];result[9]=z[1];result[10]=z[2];result[5]=z[2];result[6]=-z[1];}
 }
 for(let c=0;c<3;c++){for(let r=0;r<3;r++)result[c*4+r]*=scale[c];result[12+c]=camera[12+c];}return mul(inverse,result);
}
export function inverseAffine(m){
 const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],g=m[2],h=m[6],i=m[10],det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
 if(!Number.isFinite(det)||Math.abs(det)<1e-12)throw Error('Singular billboard base matrix');const out=[(e*i-f*h)/det,(f*g-d*i)/det,(d*h-e*g)/det,0,(c*h-b*i)/det,(a*i-c*g)/det,(b*g-a*h)/det,0,(b*f-c*e)/det,(c*d-a*f)/det,(a*e-b*d)/det,0,0,0,0,1];
 for(let r=0;r<3;r++)out[12+r]=-(out[r]*m[12]+out[4+r]*m[13]+out[8+r]*m[14]);return out;
}
export function orientMonsterVertices(model,view={}){
 if(!model.billboards?.length)return model.vertices;const out=model.vertices.slice();
 for(const {firstVertex,vertexCount,expression,inverseBase} of model.billboards){
  if(!Number.isInteger(firstVertex)||!Number.isInteger(vertexCount)||firstVertex<0||vertexCount<0||(firstVertex+vertexCount)*11>out.length)throw Error('Invalid billboard range');
  const m=mul(evaluateBillboardTransform(expression,view),inverseBase);
  for(let i=firstVertex;i<firstVertex+vertexCount;i++){const at=i*11,x=out[at],y=out[at+1],z=out[at+2];for(let r=0;r<3;r++)out[at+r]=m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r];}
 }return out;
}
export function orderedMonsterDrawCalls(model,vertices,viewMatrix){
 const opaque=[],translucent=[];
 for(const call of model.drawCalls){if(!model.materials[call.materialId].translucent){opaque.push(call);continue;}let z=0;
  for(let i=call.firstIndex;i<call.firstIndex+call.indexCount;i++){const p=model.indices[i]*11;z+=viewMatrix[2]*vertices[p]+viewMatrix[6]*vertices[p+1]+viewMatrix[10]*vertices[p+2]+viewMatrix[14];}
  translucent.push({call,z:z/call.indexCount});
 }
 translucent.sort((a,b)=>b.z-a.z);return [...opaque,...translucent.map(x=>x.call)];
}

export function templateBoundsForViews(model,views){
 const base=model.templateBounds??model.bounds;if(!model.billboards?.length)return base;
 const bounds={min:base.min.slice(),max:base.max.slice()};for(const view of views){const vertices=orientMonsterVertices(model,view);for(let i=0;i<vertices.length;i+=11)for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],vertices[i+k]);bounds.max[k]=Math.max(bounds.max[k],vertices[i+k]);}}return bounds;
}
