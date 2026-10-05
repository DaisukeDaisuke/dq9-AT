// ROM-proved alpha setter -> model gate -> SDK material POLYGON_ATTR write.
const need=(x,m)=>{if(!x)throw Error(m);};
export function readMseAlphaMaterialRules(sdk){
 const checks=[[0x0207bf08,0xebfeebd9],[0x02036e80,0xe20110ff],[0x02036e84,0xe1a01d81],[0x02036e88,0xe3c220f8],[0x02036e8c,0xe1821c21],[0x02036e90,0xe5c41040],[0x02036eac,0xeb00000b],[0x02036eb8,0xeb0122a1],[0x02036efc,0xe0000092],[0x02036f00,0xe3a0101f],[0x02034690,0xe383301f],[0x02034694,0xe5c43041],[0x0203473c,0xe3a00a01],[0x02034740,0xe1c40ab0],[0x0203543c,0xeb0006a7],[0x02035440,0xe31000ff],[0x02035448,0x08bd8010],[0x020354ac,0xebffffdc],[0x020354b8,0x08bd80f8],[0x0207bd18,0xebfee5da],[0x0207f95c,0xeb00e525],[0x020b8e20,0xebffff8a],[0x020b8cb8,0xe3c0081f],[0x020b8cbc,0xe1800802],[0x020b8cc0,0xe581000c]];
 const source=checks.map(([address,expected])=>{const b=sdk.read(address,4),word=new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);need(word===expected,'MSE alpha source differs at '+address.toString(16));return{address,word};});
 return{ready:true,kind:'source-MSE-alpha-material',source,modelScale:31,zeroAlphaSkipsModel:true,alphaMask:0x1f0000,scope:'Initialized model alpha-scale31, constructor model fade scale4096, ordinary enabled model, no external model override. Source checks do not prove live state.'};
}
export function validateMseRenderState(profile,phase,state){
 need(phase?.kind==='explicit-offsets','Source-state rendering needs explicit pre-update offsets');
 need(Array.isArray(state.layerAlpha)&&state.layerAlpha.length===profile.layers.length,'One source alpha per layer required');
 need(Array.isArray(state.offsetsFx)&&JSON.stringify(state.offsetsFx)===JSON.stringify(phase.offsetsFx),'State alpha and offsets must come from the same pre-update draw');
 need(Number.isInteger(state.managerAlpha)&&state.managerAlpha>=0&&state.managerAlpha<=31,'Manager alpha0..31 required');
 need(state.layerAlpha.every(a=>Number.isInteger(a)&&a>=0&&a<=31),'Layer alpha0..31 required');
 need(Number.isInteger(state.flags)&&!(state.flags&1),'Paused state cannot emit MSE draw polygons');
}
export function buildMseStateRenderOptions(renderState,{indexStart,rasterProfile}){
 need(renderState,'An enabled source render state is required');
 return{phase:{kind:'explicit-offsets',offsetsFx:renderState.offsetsFx},renderState,indexStart,rasterProfile};
}
