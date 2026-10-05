// Runtime-only ARM9 SDK image reader. No extracted ROM table is embedded.
// Backward decompression follows NTRGhidra CRT0 (Pedro Javier Fernandez),
// pinned 9e0674c, Apache-2.0; preserve accompanying NOTICE/LICENSE on distribution.
const u32=(a,p)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint32(p,true);
export function backwards(input){
 if(input.length<8)throw Error('Short ARM9 compressed footer');
 const footer=u32(input,input.length-8),outLength=input.length+u32(input,input.length-4);
 if(outLength<input.length||outLength>16*1024*1024)throw Error('Unsupported ARM9 expanded size');
 const result=new Uint8Array(outLength);result.set(input);
 let src=input.length-(footer>>>24),dst=outLength;const end=input.length-(footer&0xffffff);
 if(src<0||end<0||end>src)throw Error('Invalid ARM9 compressed span');
 const read=()=>{if(src<=end)throw Error('Truncated ARM9 compressed token');return result[--src];};
 for(;;){let flags=read();for(let bit=0;bit<8;bit++,flags=(flags<<1)&255){
  if(flags&128){const a=read(),b=read(),distance=((a&15)<<8|b)+2,count=(a>>>4)+3;
   for(let i=0;i<count;i++){if(dst<=0||dst+distance>=result.length)throw Error('ARM9 backreference outside image');result[dst-1]=result[dst+distance];dst--;}
  }else{if(dst<=0)throw Error('ARM9 output underflow');result[--dst]=read();}
  if(src<=end)return result;
 }}
}
export function readArm9SdkImage(rom){
 if(!(rom instanceof Uint8Array)||rom.length<512)throw Error('NDS bytes required');
 const code=String.fromCharCode(...rom.subarray(12,16));if(code!=='YDQJ'||rom[30]!==0)throw Error('Only YDQJ revision0 is verified');
 const offset=u32(rom,0x20),loadAddress=u32(rom,0x28),length=u32(rom,0x2c);
 if(offset+length>rom.length)throw Error('ARM9 span exceeds ROM');
 const input=rom.subarray(offset,offset+length),magic=[0x21,6,0xc0,0xde,0xde,0xc0,6,0x21],found=[];
 for(let i=28;i+8<=input.length;i++)if(magic.every((x,j)=>input[i+j]===x))found.push(i-28);
 if(found.length!==1)throw Error('SDK module parameters are not unique');const paramsOffset=found[0];
 let image=input.slice();if(u32(image,paramsOffset+20)!==0){image=backwards(input);new DataView(image.buffer).setUint32(paramsOffset+20,0,true);}
 const listStart=u32(image,paramsOffset),listEnd=u32(image,paramsOffset+4),autoStart=u32(image,paramsOffset+8);
 const staticLength=autoStart-loadAddress;
 if(staticLength<0||staticLength>image.length||listEnd<listStart||(listEnd-listStart)%12)throw Error('Invalid SDK runtime layout');
 const segments=[{kind:'static',address:loadAddress,bytes:image.subarray(0,staticLength)}];let at=staticLength;
 for(let p=listStart-loadAddress;p<listEnd-loadAddress;p+=12){
  if(p<0||p+12>image.length)throw Error('Autoload descriptor outside image');const address=u32(image,p),size=u32(image,p+4),bssSize=u32(image,p+8);
  if(at+size>image.length)throw Error('Autoload payload outside image');segments.push({kind:'autoload',address,bssSize,bytes:image.subarray(at,at+size)});at+=size;
 }
 function read(address,size){if(!Number.isSafeInteger(size)||size<0)throw Error('Invalid native read size');const matches=segments.filter(s=>address>=s.address&&address+size<=s.address+s.bytes.length);if(matches.length!==1)throw Error('Native address has no unique initialized ROM segment');const s=matches[0];return s.bytes.subarray(address-s.address,address-s.address+size);}
 return {offset,loadAddress,inputLength:length,expandedLength:image.length,paramsOffset,segments,read};
}
