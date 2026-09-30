import {MapProject,MapRenderer} from './map-core.mjs';
import {mineRuntimeFonts} from './font-core.mjs';
let project=null,renderer=null;
const boot=(async()=>{const response=await fetch('./wasm/map_render.wasm');if(!response.ok)throw Error('WASMを取得できません');const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});renderer=new MapRenderer(instance);})();
self.onmessage=async({data:m})=>{try{await boot;
 if(m.type==='load'){project=new MapProject(m.buffer,m.csv,s=>postMessage({type:'progress',message:s}));postMessage({type:'loaded',metadata:project.metadata()});}
 else if(m.type==='render'){if(!project)throw Error('NDSを先に選択してください');let image;if(m.descriptor)image=renderer.compose(project,m.descriptor);else {const a=project.assets.get(m.key);if(!a)throw Error('画像がありません');image=renderer.decodeAsset(a,m.transparent!==false);}postMessage({type:'image',requestId:m.requestId,image},[image.rgba.buffer]);}
 else if(m.type==='fonts'){try{if(!project)throw Error('NDSを先に投入してください');const fonts=mineRuntimeFonts(project.nitro);postMessage({type:'fonts',fonts},fonts.fonts.map(f=>f.data.buffer));}catch(error){postMessage({type:'font-error',message:error.message});}}
 else if(m.type==='asset'){const a=project?.assets.get(m.key);if(!a)throw Error('assetがありません');const bytes=a.data.slice();postMessage({type:'asset',name:a.path,bytes},[bytes.buffer]);}
 }catch(error){postMessage({type:'error',requestId:m.requestId,message:error.message,stack:error.stack});}};
