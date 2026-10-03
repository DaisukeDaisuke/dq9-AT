import {openMapRom} from './static-scene.mjs';
import {cameraFromPlayerFx} from './native/camera-from-player.mjs';
const $=id=>document.getElementById(id);let project=null,scene=null;
const gl=$('view').getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,`#version 300 es
in vec3 position;in vec3 color;uniform mat4 projection;uniform mat4 view;out vec3 vColor;void main(){gl_Position=projection*view*vec4(position,1.0);vColor=color;}`));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec3 vColor;out vec4 outputColor;void main(){outputColor=vec4(vColor,1.0);}`));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);for(const [name,offset] of [['position',0],['color',12]]){const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,24,offset);}
let vertexCount=0;
function upload(){const vertices=[];for(const obj of scene.instances)for(const draw of obj.draws)for(const i of draw.indices){const v=draw.vertices[i];if(v.color555===null)throw Error('Unresolved vertex color');vertices.push(...v.position,...[0,5,10].map(k=>(v.color555>>k&31)/31));}gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);vertexCount=vertices.length/6;}
function render(){if(!project||!scene)return;const cfg=JSON.parse($('camera').value),table=project.sdk.read(0x020e955c,16384),d=new DataView(table.buffer,table.byteOffset,table.byteLength);const c=cameraFromPlayerFx(cfg,i=>[d.getInt16(i*4,true),d.getInt16(i*4+2,true)]),v=c.view4x3Fx,p=c.projectionFx;
 const V=[v[0],v[1],v[2],0,v[3],v[4],v[5],0,v[6],v[7],v[8],0,v[9],v[10],v[11],4096].map(x=>x/4096);
 gl.uniformMatrix4fv(gl.getUniformLocation(prog,'view'),false,new Float32Array(V));gl.uniformMatrix4fv(gl.getUniformLocation(prog,'projection'),false,new Float32Array(p.map(x=>x/4096)));gl.viewport(0,0,256,192);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.12,.14,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,vertexCount);
 $('status').textContent=JSON.stringify({archive:scene.archiveName,stream:scene.streamName,placements:scene.placementCount,previewInstances:scene.instances.length,unsupported:scene.unsupported,vertices:vertexCount,cameraEyeFx:c.eyeFx,limitations:scene.scope},null,2);}
function guard(fn){return async()=>{try{await fn();}catch(e){$('status').textContent='停止: '+e.message;console.error(e);}};}
$('rom').onchange=guard(async()=>{const file=$('rom').files[0];if(!file)return;project=openMapRom(new Uint8Array(await file.arrayBuffer()));$('archive').replaceChildren(...project.archives.map(n=>new Option(n,n)));if(project.archives.includes('D04M02.amdj'))$('archive').value='D04M02.amdj';await selectArchive();});
async function selectArchive(){const a=project.archive($('archive').value),names=[...a.keys()].filter(x=>x.endsWith('.bmdj'));$('stream').replaceChildren(...names.map(n=>new Option(n,n)));scene=null;$('status').textContent='配置ストリームと現在のカメラ状態を指定してください。';}
$('archive').onchange=guard(selectArchive);$('load').onclick=guard(()=>{scene=project.scene($('archive').value,$('stream').value);upload();render();});$('draw').onclick=guard(render);
