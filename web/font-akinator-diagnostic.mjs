// Bounded source locations only: never include error text, URLs, file names
// chosen by the user, captured pixels, glyphs, stamps or ROM data.
const files=new Set(['video-panel.mjs','font-akinator-cpu-client.mjs','font-akinator-cpu-worker.mjs','font-akinator.mjs','font-match-reference.mjs']);
const phases=new Set(['page-cpu','client','worker-init','worker-match','worker-request']);
const revision='cpu-text-diag-1';
const frame=value=>typeof value==='string'&&value.length<=100&&/^([\w-]+\.mjs):([1-9]\d{0,7}):([1-9]\d{0,7})$/.test(value)&&files.has(value.split(':')[0]);
export function cpuTextDiagnostic(error,phase='client'){
 const supplied=error?.cpuDiagnostic;
 if(supplied?.revision===revision&&phases.has(supplied.phase)&&Array.isArray(supplied.frames))return {revision,phase:supplied.phase,frames:supplied.frames.slice(0,6).filter(frame)};
 const stack=typeof error?.stack==='string'?error.stack.slice(0,8192):'',frames=[];
 for(const match of stack.matchAll(/(?:^|[\s/(])([\w-]+\.mjs):([1-9]\d{0,7}):([1-9]\d{0,7})(?=[\s)]|$)/gm)){
  const value=match.slice(1).join(':');if(frame(value)&&!frames.includes(value))frames.push(value);if(frames.length===6)break;
 }
 return {revision,phase:phases.has(phase)?phase:'client',frames};
}
export function formatCpuTextDiagnostic(error,phase='page-cpu'){
 const d=cpuTextDiagnostic(error,phase);return `[${d.revision}/${d.phase} ${d.frames.join(' ← ')||'source-location-unavailable'}]`;
}
