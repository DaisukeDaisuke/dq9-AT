/* SPDX-License-Identifier: GPL-2.0-or-later
 * Retain only immutable decompressed ROM archive members within one renderer.
 * No geometry, lighting, texture interpretation or camera results are retained.
 * ROM/project replacement is an identity boundary; uploaded ROMs are immutable.
 */
export function createRendererSourceArchives({maxBytes=32*1024*1024,maxArchives=8}={}) {
 let project=null,rom=null,wrapped=null,bytes=0;const archives=new Map();
 const stats={loads:0,hits:0,evictions:0,bypasses:0,retainedBytes:0,retainedArchives:0};
 const counts=()=>{stats.retainedBytes=bytes;stats.retainedArchives=archives.size;};
 function clear(){archives.clear();bytes=0;project=null;rom=null;wrapped=null;counts();}
 function forProject(nextProject,nextRom){
  if(project===nextProject&&rom===nextRom&&wrapped)return wrapped;
  clear();project=nextProject;rom=nextRom;
  // Capture the source rather than the mutable current session. Even a stale
  // wrapper cannot accidentally read a replacement ROM's archive.
  const source=nextProject;
  wrapped={...source,archive(name){
   if(project!==source||rom!==nextRom)return source.archive(name);
   if(archives.has(name)){const entry=archives.get(name);archives.delete(name);archives.set(name,entry);stats.hits++;return entry.value;}
   const value=source.archive(name);stats.loads++;
   // Charge complete backing buffers (including shared NARC storage), once per
   // archive. This conservatively overcounts shared buffers across archives.
   const buffers=new Set();let size=0;
   if(value instanceof Map)for(const member of value.values()){if(!ArrayBuffer.isView(member)){size=Infinity;break;}if(!buffers.has(member.buffer)){buffers.add(member.buffer);size+=member.buffer.byteLength;}}
   else size=Infinity;
   if(size>maxBytes||maxArchives<1){stats.bypasses++;return value;}
   while(archives.size&&(bytes+size>maxBytes||archives.size>=maxArchives)){const key=archives.keys().next().value;bytes-=archives.get(key).size;archives.delete(key);stats.evictions++;}
   archives.set(name,{value,size});bytes+=size;counts();return value;
  }};
  return wrapped;
 }
 return{forProject,clear,stats};
}
