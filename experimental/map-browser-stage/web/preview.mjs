import{cameraMapScene}from'./camera-map-scene.mjs';
import{MapRenderer,minimapProjectFromRom}from'./minimap-preview.mjs';
import{cameraForMapClick}from'./map-click-camera.mjs';
import {rasterizePreviewPackets} from './cpu-preview.mjs';
import {openMapRom} from './static-scene.mjs';
import {prepareDrawPackets} from './draw-packets.mjs';
import {createTexturePreview} from './texture-preview.mjs';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';
import {cameraFromExplicitInput} from './explicit-camera-input.mjs';
const $=id=>document.getElementById(id);let project=null,scene=null,renderInputs=null;
const gl=$('view').getContext('webgl2'),cpuContext=gl?null:$('view').getContext('2d');if(!gl&&!cpuContext){$('status').textContent='停止: 描画contextを初期化できません。';throw Error('Rendering context unavailable');}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let prog=null,vbo=null;if(gl){prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,`#version 300 es
in vec3 position;in vec3 color;uniform mat4 projection;uniform mat4 view;out vec3 vColor;void main(){gl_Position=projection*view*vec4(position,1.0);vColor=color;}`));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec3 vColor;out vec4 outputColor;void main(){outputColor=vec4(vColor,1.0);}`));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);for(const [name,offset] of [['position',0],['color',12]]){const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,24,offset);}
}
let vertexCount=0,packets=null,texturePreview=null;
function upload(){if(!gl)throw Error('CPU経路では明示したtexture resourceとnative material globalsが必要です。');gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);const vertices=[];for(const obj of scene.instances)for(const draw of obj.draws)for(const i of draw.indices){const v=draw.vertices[i];if(v.color555===null)throw Error('Unresolved vertex color');vertices.push(...v.position,...[0,5,10].map(k=>(v.color555>>k&31)/31));}gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);vertexCount=vertices.length/6;}
async function render(){if(!project||!scene)return;const cfg=JSON.parse($('camera').value),table=project.sdk.read(0x020e955c,16384),d=new DataView(table.buffer,table.byteOffset,table.byteLength);const c=cameraFromExplicitInput(cfg,i=>[d.getInt16(i*4,true),d.getInt16(i*4+2,true)]),v=c.view4x3Fx,p=c.projectionFx;
 let V=[v[0],v[1],v[2],0,v[3],v[4],v[5],0,v[6],v[7],v[8],0,v[9],v[10],v[11],4096].map(x=>x/4096);
 let activeScene=scene,activePackets=packets;if(renderInputs?.profile){activeScene=cameraMapScene(project,scene,renderInputs.textureBytes,V.map(x=>Math.round(x*4096)),{profile:renderInputs.profile});activePackets=prepareDrawPackets(activeScene,renderInputs);V=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
 let textureResult=null;
 if(activePackets){if(gl){texturePreview??=createTexturePreview(gl);textureResult=texturePreview.render(activePackets,V,p.map(x=>x/4096));}else{const r=rasterizePreviewPackets(activePackets,{view:V,projection:p.map(x=>x/4096),clearRGBA:[31,36,41,255]});cpuContext.putImageData(new ImageData(r.rgba,r.width,r.height),0,0);const canvasBytes=cpuContext.getImageData(0,0,r.width,r.height).data,sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');const comparison={differingPixels:0,opaqueDifferingPixels:0,translucentPixels:0,maximumChannelDifference:0,firstDifference:null};for(let i=0;i<r.rgba.length;i+=4){const partial=r.rgba[i+3]!==255;comparison.translucentPixels+=Number(partial);let different=false;for(let ch=0;ch<4;ch++){const delta=Math.abs(canvasBytes[i+ch]-r.rgba[i+ch]);comparison.maximumChannelDifference=Math.max(comparison.maximumChannelDifference,delta);different||=delta!==0;}if(different){comparison.differingPixels++;comparison.opaqueDifferingPixels+=Number(!partial);comparison.firstDifference??={x:i/4%r.width,y:Math.floor(i/4/r.width),generated:Array.from(r.rgba.slice(i,i+4)),readback:Array.from(canvasBytes.slice(i,i+4))};}}textureResult={...r.stats,canvasComparison:comparison,rgbaSha256:await sha(r.rgba),canvasSha256:await sha(canvasBytes),canvasBufferEqual:canvasBytes.every((v,i)=>v===r.rgba[i]),limitations:r.scope};}}
 else{if(!gl)throw Error('CPU経路ではtexture/materialを指定して配置を読み込んでください。');gl.useProgram(prog);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
 gl.uniformMatrix4fv(gl.getUniformLocation(prog,'view'),false,new Float32Array(V));gl.uniformMatrix4fv(gl.getUniformLocation(prog,'projection'),false,new Float32Array(p.map(x=>x/4096)));gl.viewport(0,0,256,192);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.12,.14,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,vertexCount);}
 $('status').textContent=JSON.stringify({archive:activeScene.archiveName,stream:activeScene.streamName,placements:activeScene.placementCount,previewInstances:activeScene.instances.length,unsupported:activeScene.unsupported,vertices:activePackets?activePackets.draws.reduce((n,p)=>n+p.vertices.length/8,0):vertexCount,cameraEyeFx:c.eyeFx,backend:gl?'webgl2':'cpu2d',textureResult,packetUnsupported:activePackets?.unsupported,hiddenPackets:activePackets?.hidden,limitations:activeScene.scope},null,2);}
function guard(fn){return async()=>{try{await fn();}catch(e){$('status').textContent='停止: '+e.message;console.error(e);}};}
$('rom').onchange=guard(async()=>{const file=$('rom').files[0];if(!file)return;project=openMapRom(new Uint8Array(await file.arrayBuffer()));$('archive').replaceChildren(...project.archives.map(n=>new Option(n,n)));if(project.archives.includes('D04M02.amdj'))$('archive').value='D04M02.amdj';await selectArchive();});
async function selectArchive(){const a=project.archive($('archive').value),names=[...a.keys()].filter(x=>x.endsWith('.bmdj'));$('stream').replaceChildren(...names.map(n=>new Option(n,n)));scene=null;packets=null;renderInputs=null;$('status').textContent='配置ストリームと現在のカメラ状態を指定してください。';}
$('archive').onchange=guard(selectArchive);$('load').onclick=guard(()=>{let textureBytes=null;packets=null;renderInputs=null;
 const selection=$('texture').value.trim();
 if(selection){const cfg=JSON.parse(selection);if(typeof cfg.archive!=='string'||typeof cfg.member!=='string'||!project.nfs.readDir('data/map').files.includes(cfg.archive))throw Error('Exact ROM texture archive/member required');
 const z=Narc.load(new Uint8Array(project.nfs.readFile('data/map/'+cfg.archive))),matches=z.files.map((_,i)=>i).filter(i=>z.fnt.getFilenameOf(i)===cfg.member);if(matches.length!==1)throw Error('Texture member absent or ambiguous');const e=z.files[matches[0]];textureBytes=e[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(e.buffer,e.byteOffset,e.length))):e;}
 scene=project.scene($('archive').value,$('stream').value,{textureBytes});
 if(textureBytes){const materialGlobals=JSON.parse($('material').value);for(const k of ['diffuseAmbient','specularEmission','polygonAttribute'])if(!Number.isInteger(materialGlobals[k])||materialGlobals[k]<0||materialGlobals[k]>0xffffffff)throw Error('Explicit unsigned native material global required: '+k);
 const mb=project.sdk.read(0x020e934c,32),md=new DataView(mb.buffer,mb.byteOffset,mb.byteLength),masks=Array.from({length:8},(_,i)=>md.getUint32(i*4,true));renderInputs={textureBytes,materialGlobals,masks,profile:JSON.parse(selection).cameraBillboardProfile??null};packets=prepareDrawPackets(scene,{materialGlobals,masks});}
 if(!packets)upload();return render();});$('draw').onclick=guard(render);

let minimapImage=null,minimapPair=null;const verifiedMapPair=s=>s?.archiveName==='D04M02.amdj'&&s.streamName==='D04M0200.bmdj'?'D04M02.bmmp':s?.archiveName==='D04.amdj'&&s.streamName==='D04M0000.bmdj'?'D04.bmmp':null;
$('mapload').onclick=guard(async()=>{
 if(!project||!verifiedMapPair(scene))throw Error('この配置のマップ対応は未確認です。');
 const wasmResponse=await fetch('../wasm/map_render.wasm');if(!wasmResponse.ok)throw Error('Existing minimap renderer unavailable');
 const {instance}=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{}),renderer=new MapRenderer(instance);
 minimapImage=renderer.compose(minimapProjectFromRom(project.nfs),verifiedMapPair(scene));minimapPair=scene.archiveName+'::'+scene.streamName;
 const canvas=$('minimap');canvas.width=minimapImage.width;canvas.height=minimapImage.height;canvas.getContext('2d').putImageData(new ImageData(minimapImage.rgba,minimapImage.width,minimapImage.height),0,0);
 $('mapstatus').textContent=JSON.stringify({descriptor:minimapImage.descriptor.path,width:minimapImage.width,height:minimapImage.height,originPixel:minimapImage.originPixel,worldToMapScale:minimapImage.descriptor.worldToMapScale,scope:'Requested preview only; explicit camera Y is retained.'});
});
$('minimap').onclick=event=>guard(async()=>{
 if(!minimapImage||!scene||minimapPair!==scene.archiveName+'::'+scene.streamName)throw Error('Load the confirmed minimap/scene pair first');
 const canvas=$('minimap'),rect=canvas.getBoundingClientRect(),imageX=(event.clientX-rect.left)*canvas.width/rect.width,imageY=(event.clientY-rect.top)*canvas.height/rect.height;
 if(imageX<0||imageY<0||imageX>=canvas.width||imageY>=canvas.height)throw Error('Click outside composed map');
 const cameraState=JSON.parse($('camera').value);if(cameraState.nativeAppliedMatrices)throw Error('適用済み行列のsnapshot表示です。クリック追従には未補完の通常camera状態が必要です。');const table=project.sdk.read(0x020e955c,16384),d=new DataView(table.buffer,table.byteOffset,table.byteLength);
 const request=cameraForMapClick({imageX,imageY,originPixel:minimapImage.originPixel,worldToMapScale:minimapImage.descriptor.worldToMapScale,playerYFx:cameraState.playerPositionFx[1],cameraState},i=>[d.getInt16(i*4,true),d.getInt16(i*4+2,true)]);
 $('camera').value=JSON.stringify({...cameraState,playerPositionFx:request.requestedPlayerPositionFx});$('mapstatus').textContent=JSON.stringify({imageX,imageY,...request},null,2);await render();
}) ();
