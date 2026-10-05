/* SPDX-License-Identifier: GPL-2.0-or-later
 * Scalar clear attributes follow DeSmuME contributors, pinned 535f676,
 * Render3D::Render/ClearFramebuffer and gfx3d_init DS_DEPTH15TO24 table.
 * ROM producer/consumer guards resolve only ordinary initial mode1 field state.
 */
import{isSupportedMode1ColorEnvironment}from'../automatic-material-environment.mjs?v=native-body-20261006-0212';
import{readArm9Overlay}from'../rom-overlay.mjs';
export function readInitialMode1ClearProfile(project,rom,record,automatic){
 const environment=automatic?.environment;
 if(automatic?.environmentApplied!==true||automatic.plan?.recordKey!==record.key||!isSupportedMode1ColorEnvironment(environment,record.key))throw Error('Matching initial mode1 clear environment required');
 const spans=[[0x0207c32c,0x144,0xb132ddc2],[0x02013cc4,0x40,0xf9d713b8],[0x020c7054,0x28,0x72a4cc5b],[0x020c6ca8,0x10c,0x6489509f]];
 for(const[address,length,expected]of spans){let hash=2166136261;for(const b of project.sdk.read(address,length))hash=Math.imul(hash^b,16777619)>>>0;if(hash!==expected)throw Error('Initial field clear source differs at '+address.toString(16));}
 const word=(s,a)=>{const b=s.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const overlay=readArm9Overlay(rom,17),initCall=0x0218c60c;
 if(word(overlay,initCall)!==((0xeb000000|((0x020c6ca8-initCall-8)>>2)&0xffffff)>>>0))throw Error('Initial field G3 initialization differs');
 const records=environment.colorRecords?.inherited?.slice(0,4),hypothesis=environment.discreteOrdinaryHypothesis;
 if(!records||records.length!==4||records.some(r=>!Number.isInteger(r?.fields8c)||r.fields8c<0||r.fields8c>32767))throw Error('Ordinary source clear COLOR fields8c required');
 let color555,selection;
 if(hypothesis?.kind==='source-mode1-retained-ordinary-load-state'){
  if(hypothesis.recordKey!==record.key||!Number.isInteger(hypothesis.index)||hypothesis.index<0||hypothesis.index>3||environment.staticColorRecord.fields8c!==records[hypothesis.index].fields8c)throw Error('Clear and material ordinary hypotheses differ');
  color555=records[hypothesis.index].fields8c;selection={kind:'same-ordinary-load-state',index:hypothesis.index,currentStateCertified:false};
 }else{
  if(!records.every(r=>r.fields8c===records[0].fields8c))throw Error('Clear color varies across ordinary source states');
  color555=records[0].fields8c;selection={kind:'all-four-ordinary-clear-colors-identical',currentStateCertified:false};
 }
 const alpha5=word(project.sdk,0x02013cf0)&255,depth15=word(project.sdk,0x02013d7c),opaqueId=word(project.sdk,0x02013cd8)&255;
 if(alpha5!==16||depth15!==0x7fff||opaqueId!==0)throw Error('Initial field clear values outside connected source branch');
 return{ready:true,kind:'source-initial-mode1-field-clear-values',color555,rgba6665:[...[0,5,10].map(s=>{const c=color555>>>s&31;return c?c*2+1:0;}),alpha5],depth24:depth15*0x200+0x1ff,opaqueId,translucentId:255,isFogged:0,isTranslucentPoly:0,frontFacing:0,selection,source:{spans,initialFieldG3InitCall:initCall,colorProducer:0x0207c3e8,consumer:0x02013ce8,setter:0x020c7054,clearImageDisabledByInitialG3Reset:true},scope:'Ordinary initial mode1 field clear only. Source COLOR.fields8c and the same retained ordinary selector as material. Later writes, transitions, special/forced states and 2D composition remain unresolved.'};
}
export function initializeKnownClear(base,profile,state){
 const coverage=base.plane.coverage.slice(),clearMask=new Uint8Array(49152);if(!profile)return{coverage,clearMask};
 if(profile.ready!==true||profile.kind!=='source-initial-mode1-field-clear-values'||profile.depth24!==0xffffff||profile.rgba6665?.length!==4||profile.rgba6665[3]!==16||profile.rgba6665.some((v,i)=>!Number.isInteger(v)||v<0||v>(i===3?31:63))||profile.opaqueId!==0||profile.translucentId!==255||profile.isFogged!==0||profile.isTranslucentPoly!==0||profile.frontFacing!==0)throw Error('Explicit source initial clear profile required');
 for(let i=0;i<49152;i++)if(!coverage[i]&&!base.rgbUnavailableMask[i]){clearMask[i]=1;coverage[i]=1;state.rgba6665.set(profile.rgba6665,i*4);state.depth24[i]=profile.depth24;state.facing[i]=profile.frontFacing;state.opaqueId[i]=profile.opaqueId;state.isFogged[i]=profile.isFogged;}
 return{coverage,clearMask};
}
