import fs from 'node:fs/promises';
const v2=process.argv.includes('--v2'),prefix=v2?'FAIRCLS_':'';
const target=new Set(['z019b','z021a','z064a','z000c']),ann1=JSON.parse(await fs.readFile('../private-inputs/work1/vision-comparison/dataset/ANNOTATIONS.json','utf8')),ann2=JSON.parse(await fs.readFile('results/HOLDOUT_ANNOTATIONS.json','utf8')),ann3=v2?JSON.parse(await fs.readFile('results/ADDITIONAL_ANNOTATIONS.json','utf8')):{frames:[]},annotations=new Map([...ann1.frames,...ann2.frames,...ann3.frames].map(f=>[f.frame_id,f]));
if(v2)for(const f of JSON.parse(await fs.readFile('results/H4_ANNOTATIONS.json','utf8')).frames)annotations.set(f.frame_id,f);
if(v2)for(const f of JSON.parse(await fs.readFile('results/TEMPORAL_NEGATIVE_REGIONS.json','utf8')).frames){const a=annotations.get(f.frame_id);if(!a)throw Error('Unknown negative-region label');a.objects.push(...f.objects);a.negative_type_annotation='manual party region overlap proxy';}
const iou=(a,b)=>{const i=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return i/(a.w*a.h+b.w*b.h-i);},rect=b=>({x:b[0],y:b[1],w:b[2],h:b[3]});
const sets=v2?['FAIRCLS_FRAME_RESULTS','FAIRCLS_H2_FRAME_RESULTS','FAIRCLS_H3_FRAME_RESULTS','FAIRCLS_H4_FRAME_RESULTS','FAIRCLS_TEMPORAL_FRAME_RESULTS']:['FRAME_RESULTS','H2_FRAME_RESULTS'],records=[];for(const n of sets)records.push(...JSON.parse(await fs.readFile(`results/${n}.json`,'utf8')).records);
const rows=[],positions=[];
for(const split of [...new Set(records.map(r=>r.split))])for(const method of['baseline','frozen','revised'])for(const budget of['raw',8,2,'displayed'])for(const threshold of[.3,.5]){
 let tp=0,fp=0,gtCount=0,gtTarget=0,tpTarget=0,partyFalse=0,backgroundFalse=0,eligible=0;const frames=[];
 for(const f of records.filter(r=>r.split===split)){
  const a=annotations.get(f.frame_id);if(!a)throw Error('No independent labels '+f.frame_id);if(!a.eligible){frames.push({id:f.frame_id,excluded:a.reason,predicted:f[method].proposals.length});continue;}eligible++;
  const enemies=a.objects.filter(o=>o.kind.startsWith('enemy')),negatives=a.objects.filter(o=>['player','player_party','npc'].includes(o.kind)),result=f[method];
  let ps=budget==='raw'?(result.rawCandidates??result.proposals):result.proposals.slice(0,budget==='displayed'?2:budget);const pairs=[];
  for(let p=0;p<ps.length;p++)for(let g=0;g<enemies.length;g++){const v=iou(ps[p].nativeROI,rect(enemies[g].bbox));if(v>=threshold)pairs.push({p,g,iou:v});}
  pairs.sort((a,b)=>b.iou-a.iou||a.p-b.p||a.g-b.g);const usedP=new Set(),usedG=new Set(),matches=[];for(const p of pairs)if(!usedP.has(p.p)&&!usedG.has(p.g)){usedP.add(p.p);usedG.add(p.g);matches.push(p);}
  tp+=matches.length;fp+=ps.length-matches.length;gtCount+=enemies.length;gtTarget+=enemies.filter(o=>target.has(o.model_id)).length;tpTarget+=matches.filter(p=>target.has(enemies[p.g].model_id)).length;
  let framePartyFalse=0,frameBackgroundFalse=0;
  for(let p=0;p<ps.length;p++)if(!usedP.has(p)){if(a.negative_type_annotation==='not available in temporal block')continue;if(negatives.some(o=>iou(ps[p].nativeROI,rect(o.bbox))>=.1)){partyFalse++;framePartyFalse++;}else{backgroundFalse++;frameBackgroundFalse++;}}
  if(budget==='displayed'&&threshold===.3)for(let g=0;g<enemies.length;g++){
   const match=matches.find(p=>p.g===g),box=match?ps[match.p].nativeROI:null,truth=rect(enemies[g].bbox);
   positions.push({split,method,id:f.frame_id,enemy:g,model_id:enemies[g].model_id??null,gt:truth,box,iou:match?.iou??0,center_error_px:box?Math.hypot(box.x+box.w/2-truth.x-truth.w/2,box.y+box.h/2-truth.y-truth.h/2):null,bottom_center_error_px:box?Math.hypot(box.x+box.w/2-truth.x-truth.w/2,box.y+box.h-truth.y-truth.h):null,area_ratio:box?box.w*box.h/(truth.w*truth.h):null,body_bbox_covered_fraction:box?(Math.max(0,Math.min(box.x+box.w,truth.x+truth.w)-Math.max(box.x,truth.x))*Math.max(0,Math.min(box.y+box.h,truth.y+truth.h)-Math.max(box.y,truth.y)))/(truth.w*truth.h):0});
  }
  frames.push({id:f.frame_id,predictions:ps.length,tp:matches.length,fp:ps.length-matches.length,party_or_npc_false:framePartyFalse,background_false:frameBackgroundFalse,negative_type_scope:a.negative_type_annotation??'manual negative-body bbox overlap',missed:enemies.length-matches.length,matches:matches.map(m=>({...m,gt:enemies[m.g].bbox,pred:ps[m.p].nativeROI}))});
 }
 rows.push({split,method,budget,IoU:threshold,eligible_frames:eligible,tp,fp,gt_all_enemies:gtCount,gt_target_models:gtTarget,tp_target_models:tpTarget,precision:tp+fp?tp/(tp+fp):null,recall_all:gtCount?tp/gtCount:null,recall_target:gtTarget?tpTarget/gtTarget:null,party_or_npc_false:partyFalse,background_false:backgroundFalse,frames});
}
await fs.writeFile(`results/${prefix}METRICS.json`,JSON.stringify({matching:'one-to-one greedy descending IoU; location only, model identity not required',displayed_scope:'offline first2 projection of video UI; frozen UI can display up to8; actual browser results separately reported',negative_type_scope:'Party/NPC overlap uses IoU>=0.1 to manual negative-body bboxes. Temporal regions were added after outputs were known and can group multiple party members with gaps; these are overlap proxies. Background means no annotated party overlap, not a certified semantic label.',rows,positions},null,2));
const columns=['split','method','budget','IoU','eligible_frames','tp','fp','gt_all_enemies','gt_target_models','tp_target_models','precision','recall_all','recall_target','party_or_npc_false','background_false'];await fs.writeFile(`results/${prefix}METRICS.csv`,columns.join(',')+'\n'+rows.map(r=>columns.map(k=>r[k]??'').join(',')).join('\n')+'\n');
await fs.writeFile(`results/${prefix}POSITION_ERRORS.json`,JSON.stringify(positions,null,2));
console.log(JSON.stringify(rows.filter(r=>r.budget==='displayed').map(({frames,...r})=>r),null,2));
