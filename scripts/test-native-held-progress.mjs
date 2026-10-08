import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../web/monster-native-auto-support.mjs?v=frame-heading-20261008-b8f5df4e',import.meta.url),'utf8');
const early=source.match(/if\(remaining<=0\)\{job\.pending\.unshift\(proposal\);[^}]+\}/)[0];
const ordinary=source.match(/if\(visitProgress\)work\.totalCompletedVisits\+\+;if\(!holdCursor\)\{work\.cursor=\(work\.cursor\+1\)%jobs\.length;\}/)[0];
const later=source.match(/if\(progress\)work\.totalCompletedVisits\+\+;if\(!holdCursor\)\{work\[cursorKey\]=\(work\[cursorKey\]\+1\)%activeJobs\.length;\}/)[0];
for(const progressed of [false,true]){
 const work={cursor:0,totalCompletedVisits:5},proposal={id:'owned'},job={pending:[]};
 const run=new Function('work','job','proposal','visitProgress',`let remaining=0,budgetStopped=false;while(true){${early}${ordinary}break;}return budgetStopped;`);
 assert.equal(run(work,job,proposal,progressed),true);assert.equal(work.totalCompletedVisits,5+Number(progressed));assert.equal(work.cursor,0);assert.equal(job.pending[0],proposal);
 for(const hold of [false,true]){
  const w={cursor:0,totalCompletedVisits:0};new Function('work','visitProgress','holdCursor',`const jobs=[1,2];${ordinary}`)(w,progressed,hold);assert.equal(w.totalCompletedVisits,Number(progressed));assert.equal(w.cursor,Number(!hold));
  const v={cursor:0,totalCompletedVisits:0};new Function('work','progress','holdCursor',`const activeJobs=[1,2],cursorKey='cursor';${later}`)(v,progressed,hold);assert.equal(v.totalCompletedVisits,Number(progressed));assert.equal(v.cursor,Number(!hold));
 }
}
console.log('Source snippets: prepared/requeued work counted exactly once, held cursor unchanged, genuine zero work remains zero in ordinary/yaw/phase paths.');

const completion=source.match(/const completionChanged=.*?if\(completionChanged\)work\.totalCompletedVisits\+\+;/)[0];
const finish=new Function('job','work','beforeSourceCursor',completion);
const job={decodedDone:false,done:false,served:true,emittedPlacements:[{}],pose:1,yaw:0,scale:0},work={totalCompletedVisits:0};finish(job,work,[1,0,0]);assert.equal(work.totalCompletedVisits,1);finish(job,work,[1,0,0]);assert.equal(work.totalCompletedVisits,1);job.emittedPlacements=[];finish(job,work,[1,0,0]);assert.equal(work.totalCompletedVisits,2);finish(job,work,[0,3,0]);assert.equal(work.totalCompletedVisits,3);finish(job,work,[1,0,0]);assert.equal(work.totalCompletedVisits,3);console.log('Completion transition/source cursor consumption counted once; repeated decodedDone revisit remains zero.');
