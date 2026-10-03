// Equality semantics of native FSi path component comparison FUN020cccec.
export function nativeAsciiNameKey(name){
 if(typeof name!=='string'||/[^\x00-\x7f]/.test(name))throw new Error('Only verified ASCII filename components are accepted');
 return name.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
}
export function nativeAsciiNameEqual(a,b){return a.length===b.length&&nativeAsciiNameKey(a)===nativeAsciiNameKey(b);}
export function nativeAsciiNameCandidates(entries,name){const key=nativeAsciiNameKey(name);return entries.filter(e=>e.name&&nativeAsciiNameKey(e.name)===key);}
