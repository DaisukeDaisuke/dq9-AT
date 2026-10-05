// Ordinary camera object initialization, read from this ROM's SDK image.
// This proves the initial value, not absence of later yaw input/script writers.
export function readRomInitialHeading(sdk){
 const read=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const source=[0x020a3da0,0x020a3da4,0x020a3dbc,0x020a3dec,0x020a44a0,0x020a44a4,0x020a44b0];
 const words=source.map(read),mov=words[0];
 if(((mov&0xfffff000)>>>0)!==0xe3a02000||words[1]!==0xe5842220||words[2]!==0xe2841c02||words[3]!==0xe1c124b6||words[4]!==0xe2840c02||words[5]!==0xe1d024f6||words[6]!==0xe5842220)throw Error('ROM初期カメラ向きの命令が対応範囲と異なります');
 const rotation=(mov>>>8&15)*2,n=mov&255,yawFx=((n>>>rotation)|(n<<(32-rotation)))|0;
 return{yawFx,yawDegrees:yawFx/25736*360,source:source.map((address,i)=>({address,instruction:words[i]})),scope:'Initial camera object +0x220 yaw from MOV/STR and initial +0x246 copy. Input rotation/script/area camera after initialization is unobserved, not assumed absent.'};
}
