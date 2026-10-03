// Diagnostic consumer of prepared material packets, not native DS raster parity.
export function createTexturePreview(gl){
 const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();
 gl.attachShader(program,compile(gl.VERTEX_SHADER,`#version 300 es
 in vec3 position;in vec3 color;in vec2 uv;uniform mat4 projection;uniform mat4 view;out vec3 vertexColor;out vec2 textureUV;
 void main(){gl_Position=projection*view*vec4(position,1);vertexColor=color;textureUV=uv;}`));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;uniform sampler2D image;uniform vec2 imageSize;uniform float polygonAlpha;in vec3 vertexColor;in vec2 textureUV;out vec4 result;
 void main(){vec4 texel=texture(image,textureUV/imageSize);float alpha=texel.a*polygonAlpha;if(alpha==0.0)discard;result=vec4(texel.rgb*vertexColor,alpha);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const vao=gl.createVertexArray(),buffer=gl.createBuffer(),texture=gl.createTexture();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,size,offset] of [['position',3,0],['color',3,12],['uv',2,24]]){const at=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,32,offset);}
 gl.bindVertexArray(null);
 return {render(packets,view,projection){
  const rejected=[],accepted=[];
  for(const p of packets.draws){
   let reason=null;
   if(p.polygonMode!==0)reason='Only modulation mode0 is implemented';
   else if(p.alpha===0)reason='Native wireframe not implemented';
   else if(p.polygonAttribute&0x4000)reason='Native equal-depth comparison not implemented';
   else if(p.texture&&(p.texture.output!=='8888'||p.texture.pixels.length!==p.texture.width*p.texture.height*4))reason='RGBA8888 texture required';
   if(reason)rejected.push({instanceId:p.instanceId,shapeIndex:p.shapeIndex,reason});else accepted.push(p);
  }
  gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,new Float32Array(view));gl.uniformMatrix4fv(gl.getUniformLocation(program,'projection'),false,new Float32Array(projection));
  gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(.12,.14,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  for(const p of accepted){
   const face=p.polygonAttribute>>>6&3;if(face===0)continue;
   if(face===3)gl.disable(gl.CULL_FACE);else{gl.enable(gl.CULL_FACE);gl.cullFace(face===1?gl.FRONT:gl.BACK);gl.frontFace(gl.CCW);}
   const tex=p.texture??{width:1,height:1,pixels:new Uint8Array([255,255,255,255])};
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,tex.width,tex.height,0,gl.RGBA,gl.UNSIGNED_BYTE,tex.pixels);
   for(const [axis,repeat,flip] of [[gl.TEXTURE_WRAP_S,p.sampler.repeatS,p.sampler.flipS],[gl.TEXTURE_WRAP_T,p.sampler.repeatT,p.sampler.flipT]])gl.texParameteri(gl.TEXTURE_2D,axis,repeat?(flip?gl.MIRRORED_REPEAT:gl.REPEAT):gl.CLAMP_TO_EDGE);
   gl.uniform2f(gl.getUniformLocation(program,'imageSize'),tex.width,tex.height);gl.uniform1f(gl.getUniformLocation(program,'polygonAlpha'),p.alpha);
   // Fixed submitted order. This blend/depth path is diagnostic, not DS sorting.
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(p.alpha===1||Boolean(p.polygonAttribute&0x800));
   gl.bufferData(gl.ARRAY_BUFFER,p.vertices,gl.STREAM_DRAW);gl.drawArrays(gl.TRIANGLES,0,p.vertices.length/8);
  }
  gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.bindVertexArray(null);
  return {acceptedPackets:accepted.length,rejected,limitations:'WebGL diagnostic only: native raster, winding, translucent ordering, depth, modulation precision and fog remain unverified.'};
 }};
}
