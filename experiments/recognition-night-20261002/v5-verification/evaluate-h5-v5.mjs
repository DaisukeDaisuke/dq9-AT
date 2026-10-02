import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {pythonBackend} from './python-backend.mjs';
import * as v2 from '../sources/dq9-AT-main/web/monster-local-proposals-v2-frozen.mjs';
import * as v3 from '../sources/dq9-AT-main/web/monster-local-proposals-v5-candidate.mjs';
import {proposeEnemyROIs} from './baseline-source/web/monster-position-proposals.mjs';
const root='/workspace/scratch/4d4d74ad4379/work7-night-recognition-20261002';
const manifest=JSON.parse(await fs.readFile(root+'/H5_SAMPLING_MANIFEST.json','utf8'));
const config=await fs.readFile('CALIBRATION_V5_CANDIDATE.json'), saved=JSON.parse(await fs.readFile('private-evidence/v5-source-bank.json','utf8')),backend=await pythonBackend();
const identity={identity:backend.identity,romEpoch:1,romSHA256:'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7'},bank2=v2.indexLocalBank(saved.references,identity),bank3=v3.indexLocalBank(saved.references,identity),records=[];
const strip=({trackingFrame,...x})=>x;
try{for(const f of manifest.frames){
 const {data,info}=await sharp(f.image_path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(createHash('sha256').update(data).digest('hex')!==f.rgba_sha256)throw Error('Frame hash mismatch');
 const image={width:info.width,height:info.height,rgba:new Uint8ClampedArray(data)},stamp={sourceId:f.video_id,sourceEpoch:1,timelineSegment:0,frameSerial:records.length,romEpoch:1,sourceFrame:{width:info.width,height:info.height},videoTime:f.actual_pts_seconds,timestampBasis:'decoded-original-PTS',featureMethod:'dinov2',inferenceBackend:'wasm',sceneContext:{kind:'field',gameplayROI:{x:0,y:0,w:info.width,h:info.height},excludeCenter:false,maskNormalized:{x:.42,y:.36,w:.16,h:.24}}};
 const baseline=proposeEnemyROIs(image,{...stamp,sceneContext:{...stamp.sceneContext,excludeCenter:true}},{profile:'shrine-blue-v1',excludeCommandHUD:true,maxProposals:8,oversizedWarmSplit:true});
 const frozen=await v2.proposeLocalEnemyROIs(image,stamp,{backend,bank:bank2}),revised=await v3.proposeLocalEnemyROIs(image,stamp,{backend,bank:bank3});
 records.push({frame_id:f.frame_id,rgba_sha256:f.rgba_sha256,baseline:strip(baseline),frozen:strip(frozen),revised:strip(revised)});
 await fs.writeFile(root+'/H5_V5_PIPELINE_PREDICTIONS.json',JSON.stringify({actual_provider:'Python ORT CPU EP1.23.2; not browser speed',config_sha256:createHash('sha256').update(config).digest('hex'),annotations_used_for_inference:false,records},null,2)+'\n');
 console.log(JSON.stringify({id:f.frame_id,B0:baseline.proposals.length,V2:frozen.proposals.length,V3:revised.proposals.length}));
}}finally{await backend.dispose();}
