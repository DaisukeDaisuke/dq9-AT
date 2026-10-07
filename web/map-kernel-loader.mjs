// Map-render/registration kernels only. The scalar artifact remains the existing
// compatibility path; DINO precision/provider and AT-only loading are unrelated.
const selections=new WeakMap();
const failure=(stage,error)=>({stage,reason:error?.message??String(error)});
function retain(result,selection){
 const exports=result.instance.exports;
 selections.set(exports,{memory:exports.memory,registration:exports.map_registration,selection:structuredClone(selection)});
 return result;
}
export function mapRegistrationKernelMetadata(exports){
 const record=selections.get(exports);
 return record&&record.memory===exports.memory&&record.registration===exports.map_registration?structuredClone(record.selection):null;
}
export async function loadMapKernel({readBytes,scalarURL,simdURL,wasm=WebAssembly}){
 if(typeof readBytes!=='function'||typeof scalarURL!=='string'||typeof simdURL!=='string')throw Error('Explicit map kernel source URLs and reader required');
 let fallback=null,stage='validation',simdValidationPassed=false;
 if(typeof wasm.validate==='function'){
  try{
   stage='fetch';const bytes=await readBytes(simdURL);
   stage='validation';if(!wasm.validate(bytes))throw Error('SIMD artifact is unsupported or invalid');
   simdValidationPassed=true;stage='instantiation';const result=await wasm.instantiate(bytes,{}),exports=result.instance?.exports;
   if(!exports?.memory||typeof exports.map_registration!=='function')throw Error('SIMD map kernel exports are incomplete');
   return retain(result,{kind:'map-registration-kernel-selection-v1',selected:'wasm-simd128',artifact:simdURL,simdValidationPassed:true,simdPath:'guarded-contiguous-sample1',otherSamplingOrBoundsUseScalar:true,fallback:null});
  }catch(error){fallback=failure(stage,error);}
 }else fallback={stage:'validation',reason:'WebAssembly.validate unavailable'};
 // Scalar read/instantiation exceptions are deliberately not replaced: callers
 // keep their original fetch error messages and scalar failure handling.
 const result=await wasm.instantiate(await readBytes(scalarURL),{});
 return retain(result,{kind:'map-registration-kernel-selection-v1',selected:'wasm-scalar',artifact:scalarURL,simdValidationPassed,fallback});
}
