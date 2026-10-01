import {readTreasureSource} from './treasure-entry.mjs';
import {MapProject,MapRenderer} from './map-core.mjs';
import {CandidateMapMatcher} from './map-disambiguation.mjs';
import {mineRuntimeFonts} from './font-core.mjs';
import {parseMonsterAssetCatalog,readMonsterAssets,monsterAssetTransfers} from './monster-assets.mjs';
import {MonsterGeometry,monsterPreviewTransfers} from './monster-geometry.mjs';
let monsterGeometryPromise=null;
const monsterGeometry=()=>monsterGeometryPromise??=MonsterGeometry.create().catch(error=>{monsterGeometryPromise=null;throw error;});
let project=null,renderer=null,wasmInstance=null,candidateMatcher=null;
let monsterCatalogPromise=null;
const monsterCatalog=()=>monsterCatalogPromise??=(fetch('./data/monsters.csv').then(r=>{if(!r.ok)throw Error('Monster catalogue unavailable');return r.text();}).then(parseMonsterAssetCatalog).catch(error=>{monsterCatalogPromise=null;throw error;}));
const boot=(async()=>{const response=await fetch('./wasm/map_render.wasm');if(!response.ok)throw Error('WASMを取得できません');const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});wasmInstance=instance;renderer=new MapRenderer(instance);})();
self.onmessage=async({data:m})=>{try{await boot;
 if(m.type==='load'){project=new MapProject(m.buffer,m.csv,s=>postMessage({type:'progress',message:s}));candidateMatcher=new CandidateMapMatcher(wasmInstance,project,renderer);postMessage({type:'loaded',metadata:project.metadata()});}
 else if(m.type==='map-candidates'){try{if(!candidateMatcher)throw Error('NDSを先に選択してください');const result=m.mode==='track-current'?candidateMatcher.track(m.frame,{stamp:m.stamp,acquisitionStamp:m.acquisitionStamp,descriptor:m.descriptor,scales:m.scales,excluded:m.excluded}):candidateMatcher.match(m.frame,m.candidates,{stamp:m.stamp,scales:m.scales,excluded:m.excluded});postMessage({type:'map-candidates',requestId:m.requestId,result});}catch(error){postMessage({type:'map-candidates-error',requestId:m.requestId,stamp:m.stamp,message:error.message});}}
 else if(m.type==='render'){if(!project)throw Error('NDSを先に選択してください');let image;if(m.descriptor)image=renderer.compose(project,m.descriptor);else {const a=project.assets.get(m.key);if(!a)throw Error('画像がありません');image=renderer.decodeAsset(a,m.transparent!==false);}postMessage({type:'image',requestId:m.requestId,image},[image.rgba.buffer]);}
 else if(m.type==='fonts'){try{if(!project)throw Error('NDSを先に投入してください');const fonts=mineRuntimeFonts(project.nitro);postMessage({type:'fonts',fonts},fonts.fonts.map(f=>f.data.buffer));}catch(error){postMessage({type:'font-error',message:error.message});}}
 else if(m.type==='monster-assets'){try{if(!project)throw Error('NDSを先に投入してください');const selectedProject=project,catalog=await monsterCatalog();if(project!==selectedProject)throw Error('NDS changed during monster request');const assets=readMonsterAssets(project.nitro,catalog,m.models);postMessage({type:'monster-assets',requestId:m.requestId,assets},monsterAssetTransfers(assets));}catch(error){postMessage({type:'monster-assets-error',requestId:m.requestId,message:error.message});}}
 else if(m.type==='monster-preview'){try{if(!project)throw Error('NDSを先に投入してください');const selectedProject=project,[catalog,geometry]=await Promise.all([monsterCatalog(),monsterGeometry()]);if(project!==selectedProject)throw Error('NDS changed during monster preview');const asset=readMonsterAssets(project.nitro,catalog,[m.model]).models[0],preview=geometry.decode(asset);postMessage({type:'monster-preview',requestId:m.requestId,preview},monsterPreviewTransfers(preview));}catch(error){postMessage({type:'monster-preview-error',requestId:m.requestId,message:error.message});}}
 else if(m.type==='treasure-source'){if(!project)throw Error('NDSを先に投入してください');const source=readTreasureSource(project.nitro,m.memberName);postMessage({type:'treasure-source',requestId:m.requestId,source});}
 else if(m.type==='asset'){const a=project?.assets.get(m.key);if(!a)throw Error('assetがありません');const bytes=a.data.slice();postMessage({type:'asset',name:a.path,bytes},[bytes.buffer]);}
 }catch(error){postMessage({type:'error',requestId:m.requestId,message:error.message,stack:error.stack});}};
