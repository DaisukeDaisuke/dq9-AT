const need=(v,m)=>{if(!v)throw Error(m);};
export const AB_VERSION='dq9-three-target-loss-ab-v1';
export const EXPECTED_PARENT_ID='c1c77a8f161d3ba2c3acd74620bf32c78e6bf451b07fbe94ff70261b4b30531f';
export function validateABMetrics(m){
 need(m&&Number.isInteger(m.images)&&m.images>0,'Validation images missing');
 for(const k of['tp','fp','fn'])need(Number.isInteger(m.totals?.[k])&&m.totals[k]>=0,'Invalid validation count: '+k);
 need(m.totals.tp+m.totals.fn>0,'Positive validation truths required');
 for(const k of['recall','negativeImageFalsePositiveRate'])need(Number.isFinite(m[k])&&m[k]>=0&&m[k]<=1,'Invalid validation metric: '+k);
 need(m.precision===null&&m.totals.tp+m.totals.fp===0||Number.isFinite(m.precision)&&m.precision>=0&&m.precision<=1,'Invalid validation precision');return m;
}
export function compareABMetrics(control,candidate){
 const a=validateABMetrics(control),b=validateABMetrics(candidate);
 need(a.images===b.images&&a.totals.tp+a.totals.fn===b.totals.tp+b.totals.fn&&a.negativeImages===b.negativeImages,'A/B validation set differs');
 return{fpRatio:b.totals.fp/Math.max(1,a.totals.fp),recallRatio:a.recall>0?b.recall/a.recall:null,negativeFPRChange:b.negativeImageFalsePositiveRate-a.negativeImageFalsePositiveRate,relativeScreeningOnly:a.totals.tp>0&&b.totals.tp>0&&b.totals.fp<=a.totals.fp*.25&&b.recall>=a.recall*.75&&b.negativeImageFalsePositiveRate<a.negativeImageFalsePositiveRate,meaning:'Relative diagnostic screen only. Both arms need nonzero true positives. Fixed-score real-video detection and broader accuracy remain separate gates.'};
}
export function requireABBudget(status,{saveCandidates=true}={}){
 for(const k of['records','bytes','maxRecords','maxBytes'])need(Number.isFinite(status?.[k])&&status[k]>=0,'Invalid checkpoint budget: '+k);
 const needed=saveCandidates?2*141000000:0;
 need(!saveCandidates||status.records+2<=status.maxRecords&&status.bytes+needed<=status.maxBytes,'Capacity preflight needs two append-only candidate slots');
 if(saveCandidates&&status.originQuota!==null&&status.originUsage!==null){need(Number.isFinite(status.originQuota)&&Number.isFinite(status.originUsage)&&status.originQuota>=0&&status.originUsage>=0,'Invalid origin quota');need(status.originQuota-status.originUsage>=needed+64*1024**2,'Insufficient origin quota; baseline is untouched');}
 return{neededBytes:needed,additionalRecords:saveCandidates?2:0};
}
