// Rank among references satisfying all existing body-support gates first.
// Keep the best failing evidence when none qualifies, for rejection diagnostics.
export function coherentReference(e,config){return !!e&&e.mean>=config.minMean&&e.support>=config.minParts&&e.vertical>=3&&e.horizontal>=2;}
export function preferCoherentReference(best,candidate,config,scoreField='mean'){
 if(!best)return candidate;
 const a=coherentReference(best,config),b=coherentReference(candidate,config);
 return b&&!a||a===b&&candidate[scoreField]>best[scoreField]?candidate:best;
}
