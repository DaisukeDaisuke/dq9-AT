export const MODEL_SHA256='b1a6aa26c56b7838b02c2b5fa66d312deee1295095ea5e85f5679a6f41eee855';
export const MODEL_BYTES=175421119;
export const MODEL_CANDIDATES=Object.freeze([{sha256:MODEL_SHA256,bytes:MODEL_BYTES,classes:80,identity:'community-coco-80'},{sha256:'150d395686234079f2109cafb8373448af46c4c245a0f05ed35d09f47df87a29',bytes:171753666,classes:4,identity:'four-class-untrained-export'}]);
export function requireModel(bytes,sha256){const m=MODEL_CANDIDATES.find(m=>m.bytes===bytes&&m.sha256===sha256);if(!m)throw Error('Model differs from verified candidate');return m;}
export const INPUT_SHAPE=Object.freeze([1,3,640,640]);
export const INPUT_VALUES=3*640*640;
export function requireInput(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==INPUT_VALUES*4)throw Error('Expected exact float32 NCHW [1,3,640,640] input');
 const values=new Float32Array(buffer);let min=Infinity,max=-Infinity;
 for(const x of values){if(!Number.isFinite(x)||x<0||x>1)throw Error('Input must contain finite rescaled RGB values in [0,1]');min=Math.min(min,x);max=Math.max(max,x);}
 return{values,min,max};
}
export function summarizeTensor(tensor,expected){
 if(tensor.type!=='float32'||JSON.stringify(tensor.dims)!==JSON.stringify(expected))throw Error('Unexpected model output type/shape');
 const data=tensor.data;if(!(data instanceof Float32Array)||data.length!==expected.reduce((a,b)=>a*b,1))throw Error('Output data size mismatch');
 let min=Infinity,max=-Infinity,sum=0;for(const x of data){if(!Number.isFinite(x))throw Error('Nonfinite output');min=Math.min(min,x);max=Math.max(max,x);sum+=x;}
 return{type:tensor.type,shape:[...tensor.dims],values:data.length,min,max,sum,firstValues:Array.from(data.subarray(0,12))};
}
