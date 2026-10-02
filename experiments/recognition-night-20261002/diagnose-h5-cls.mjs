// Diagnostic only. H5 has already been observed; never call this fresh validation.
import fs from 'node:fs/promises';import sharp from 'sharp';import {pythonBackend} from './python-backend.mjs';import {cropRGBA} from '../sources/dq9-AT-main/web/monster-roi-descriptor.mjs';import {cosineSimilarity} from '../sources/dq9-AT-main/web/monster-dinov2.mjs';
const root='/workspace/scratch/4d4d74ad4379/work7-night-recognition-20261002',manifest=JSON.parse(await fs.readFile(root+'/H5_SAMPLING_MANIFEST.json')),input=JSON.parse(await fs.readFile(root+'/H5_RAW_PREDICTIONS.json')),bank=JSON.parse(await fs.readFile('../private-inputs/work1/vision-comparison/references/BANK.json')),backend=await pythonBackend(),rows=[];
try{for(const rec of input.records){const f=manifest.frames.find(x=>x.frame_id===rec.frame_id),{data,info}=await sharp(f.image_path).ensureAlpha().raw().toBuffer({resolveWithObject:true}),image={width:info.width,height:info.height,rgba:new Uint8ClampedArray(data)};
 for(const p of rec.revised.proposals){const b=p.roi,vector=await backend.encode(cropRGBA(image,b.x,b.y,b.w,b.h)),rankings=[];
 for(const modelId of ['z019b','z021a','z064a','z000c'])rankings.push({modelId,score:Math.max(...bank.images.filter(x=>x.modelId===modelId).map(x=>cosineSimilarity(vector,new Float32Array(x.vector))))});rankings.sort((a,b)=>b.score-a.score);const score=rankings[0].score,margin=score-rankings[1].score;
 rows.push({frame_id:rec.frame_id,nativeROI:p.nativeROI,rankings,score,margin,passes_existing_Work1_B0_gate:score>=.45&&margin>=.05});}
}
 await fs.writeFile(root+'/H5_V3_CLS_DIAGNOSTIC.json',JSON.stringify({status:'known regression diagnostic, not adopted',gate:'existing Work1 B0 D1 score.45 margin.05 reused, not tuned to H5',actual_provider:'ORT CPU',GT_used:false,rows},null,2)+'\n');console.log(JSON.stringify(rows));
}finally{await backend.dispose();}
