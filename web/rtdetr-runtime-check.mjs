import{MODEL_CANDIDATES,INPUT_SHAPE,requireModel,requireInput,summarizeTensor}from'./rtdetr-runtime-check-core.mjs';
const $=id=>document.getElementById(id),cdn='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';let busy=false,output=null,lastReport=null;
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
function show(r){lastReport=r;$('status').textContent=r.phase;$('report').textContent=JSON.stringify(r,null,2);}
function controls(){for(const id of['model','pixels','wasm','webgpu'])$(id).disabled=busy;$('download').disabled=busy||!output;}
async function run(provider){
 if(busy)return;busy=true;output=null;controls();let session,inputTensor;
 const report={phase:'validating-local-inputs',provider,modelSource:'onnx-community/rtdetr_r50vd',runtime:'onnxruntime-web@1.21.0',inputShape:INPUT_SHAPE,localFilesTransmitted:false,scope:'Runtime/numerical test only; not DQ9 detector accuracy or browser training',runs:[]};show(report);
 try{
  const mf=$('model').files[0],pf=$('pixels').files[0];if(!mf||!MODEL_CANDIDATES.some(m=>m.bytes===mf.size)||!pf||pf.size!==3*640*640*4)throw Error('Select the exact verified model and preprocessed input files');
  const[mb,pb]=await Promise.all([mf.arrayBuffer(),pf.arrayBuffer()]);report.modelSHA256=await hash(mb);const model=requireModel(mb.byteLength,report.modelSHA256);report.modelIdentity=model.identity;report.outputClasses=model.classes;report.dq9QualityVerified=false;
  const input=requireInput(pb);report.inputSHA256=await hash(pb);report.inputRange=[input.min,input.max];
  if(provider==='webgpu'){if(!navigator.gpu)throw Error('WebGPU API is not available in this browser');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU adapter is available');report.adapterFeatures=Array.from(adapter.features).sort();report.adapterInfo=adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description}:null;report.fullGPUExecutionVerified=false;}
  report.phase='loading-runtime';show(report);const ort=await import(cdn+'ort.webgpu.min.mjs');ort.env.wasm.wasmPaths=cdn;ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const began=performance.now();session=await ort.InferenceSession.create(new Uint8Array(mb),{executionProviders:provider==='webgpu'?['webgpu','wasm']:['wasm'],graphOptimizationLevel:'all'});report.sessionCreateMs=performance.now()-began;report.inputNames=session.inputNames;report.outputNames=session.outputNames;
  if(JSON.stringify(session.inputNames)!==JSON.stringify(['pixel_values'])||!session.outputNames.includes('logits')||!session.outputNames.includes('pred_boxes'))throw Error('Unexpected inference schema');
  inputTensor=new ort.Tensor('float32',input.values,[...INPUT_SHAPE]);const feeds={pixel_values:inputTensor};
  for(let i=0;i<3;i++){
   report.phase='running-'+(i+1);show(report);const start=performance.now();let result;
   try{
    result=await session.run(feeds);const elapsedMs=performance.now()-start,ls=summarizeTensor(result.logits,[1,300,model.classes]),bs=summarizeTensor(result.pred_boxes,[1,300,4]);
    const logits=new Float32Array(result.logits.data),boxes=new Float32Array(result.pred_boxes.data);
    report.runs.push({index:i,elapsedMs,logits:ls,boxes:bs,logitsSHA256:await hash(logits.buffer),boxesSHA256:await hash(boxes.buffer)});output={logits,boxes};
   }finally{for(const t of Object.values(result??{}))t.dispose?.();}
  }
  report.phase='passed';report.browserInferenceExecuted=true;show(report);
 }catch(e){output=null;report.phase='blocked';report.error={name:e.name,message:e.message};show(report);}finally{try{await session?.release();inputTensor?.dispose?.();}catch(e){report.cleanupError={name:e.name,message:e.message};show(report);}finally{busy=false;controls();}}
}
$('wasm').onclick=()=>run('wasm');$('webgpu').onclick=()=>run('webgpu');for(const id of['model','pixels'])$(id).onchange=()=>{output=null;show({phase:'inputs-changed'});controls();};
$('download').onclick=()=>{if(!output||busy)return;const metadata=new TextEncoder().encode(JSON.stringify(lastReport)),header=new Uint8Array(16);header.set(new TextEncoder().encode('DQ9ORT01'));const view=new DataView(header.buffer);view.setUint32(8,metadata.byteLength,true);view.setUint32(12,output.logits.byteLength,true);const blob=new Blob([header,metadata,output.logits.buffer,output.boxes.buffer]),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rtdetr-browser-output.bin';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};controls();
