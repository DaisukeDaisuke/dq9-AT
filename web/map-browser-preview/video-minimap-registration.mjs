// Coarse sampling can miss a narrow whole-minimap peak. Retry the existing
// bounded dense matcher only after failure, within the same per-image deadline.
// Registration thresholds, scale, exclusions and unknown outcomes are unchanged.
export function matchVideoMinimapRegistration(matcher,frame,{excluded=[]}={}){
 const maximumMilliseconds=1500,started=performance.now(),options={scales:[.5],excluded};
 const initial=matcher.match(frame,{...options,maxMilliseconds:maximumMilliseconds});
 if(initial.resolved||initial.search?.budgetExhausted)return initial;
 const remaining=Math.max(0,maximumMilliseconds-(performance.now()-started));
 const dense=matcher.match(frame,{...options,denseTranslation:true,maxMilliseconds:remaining});
 return{...dense,fallback:{reason:'coarse-registration-unresolved',initialRegistration:initial,sharedMaximumMilliseconds:maximumMilliseconds,remainingMillisecondsAtDenseStart:remaining,elapsedMilliseconds:performance.now()-started}};
}
