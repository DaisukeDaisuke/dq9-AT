// Additive retention of the prior isolated-body result. Never chooses the
// scene-composed score, changes a candidate gate, or certifies a live phase.
export function retainIsolatedBodySupport(target,row,{sourcePlacement,placementMethod,appendUnsupported}={}){
 const incoming=row?.isolatedBodySupport;if(!incoming)return;
 if(!['decoded','emitted','prior'].includes(placementMethod))throw Error('Explicit isolated placement method required');
 const copy=v=>structuredClone(v),out=target.isolatedBodySupport??={kind:'prior-isolated-body-source-support',testedProposals:0,best:null,unsupported:[],placementSupport:{decoded:{testedProposals:0,best:null},emitted:{testedProposals:0,best:null}}};
 out.testedProposals+=incoming.testedProposals;const failures=copy(incoming.unsupported);if(appendUnsupported)appendUnsupported(out.unsupported,...failures);else out.unsupported.push(...failures);
 const method=out.placementSupport[placementMethod]??={testedProposals:0,best:null};method.testedProposals+=incoming.testedProposals;
 const best=incoming.best;if(best){const retained={...copy(best),sourcePlacement:copy(sourcePlacement)};if(!method.best||best.fit.pixelErrorReduction>method.best.fit.pixelErrorReduction)method.best=retained;if(!out.best||best.fit.pixelErrorReduction>out.best.fit.pixelErrorReduction)out.best=retained;}
}
