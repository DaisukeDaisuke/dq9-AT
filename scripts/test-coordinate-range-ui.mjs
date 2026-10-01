#!/usr/bin/env node
// Node-only rendering checks with synthetic coordinates: no browser, ROM or video.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {imageToMapCoordinateCandidate} from '../web/player-coordinate.mjs';
import {factorPartyMapCandidates,previewPartyMapCandidates} from '../web/party-map-candidates.mjs';

const source=await readFile(new URL('../web/video-panel.mjs',import.meta.url),'utf8');
function extract(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,`Missing render section: ${start}`);return source.slice(a,b);}
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.text='';}
 set textContent(value){this.text=String(value);this.children=[];}
 get textContent(){return [this.text,...this.children.map(child=>child.textContent)].join('\n');}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.text='';this.children=[...children];}
}
const elements=new Map(['player-status','player-coordinates'].map(id=>[id,new Element()]));
const api=vm.runInNewContext([
 extract('function formatCoordinateRanges(','\nfunction renderPlayer('),
 extract('function renderPlayer(','\n$(\'player-pick\')'),
 extract('function renderCandidatePartyCoordinates(','\nfunction mapIdsForText('),
 '({formatCoordinateRanges,renderPlayer,renderCandidatePartyCoordinates})'
].join('\n'),{document:{createElement:tag=>new Element(tag)},$:id=>elements.get(id),activeFrameSerial:-1,playerReference:null,playerMapCtx:{clearRect(){}},previewPartyMapCandidates});

let checks=0;
function check(name,run){try{run();checks++;}catch(error){throw Error(`${name}: ${error.message}`,{cause:error});}}
function candidate(left,right,top,bottom){return imageToMapCoordinateCandidate({imageX:(left+right)/2,imageY:(top+bottom)/2,imageBounds:{left,right,top,bottom},originPixel:[0,0],scale:1});}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const boundary=freeze({...candidate(-1/4096,1/4096,16-1/4096,16+1/4096),profileId:'synthetic-gray'});
const display=api.formatCoordinateRanges(boundary),text=display.lines.join('\n');

check('approximate world intervals round outward to two decimals across zero and 16',()=>{
 assert.match(display.summary,/X範囲 約\[-0\.01, 0\.01\]/);
 assert.match(display.summary,/Z範囲 約\[15\.99, 16\.01\]/);
 assert.match(text,/X: signed raw32 \[-1, 1\] \/4096/);
 assert.match(text,/Z: signed raw32 \[65535, 65537\] \/4096/);
 assert.doesNotMatch(display.summary,/≈|0x|tuple/);
});
check('negative and positive chunks keep separate unsigned local ranges',()=>{
 assert.match(text,/X chunk -1（unsigned16 65535）: unsigned local16 \[65535, 65535\]/);
 assert.match(text,/X chunk 0（unsigned16 0）: unsigned local16 \[0, 1\]/);
 assert.match(text,/Z chunk 0（unsigned16 0）: unsigned local16 \[65535, 65535\]/);
 assert.match(text,/Z chunk 1（unsigned16 1）: unsigned local16 \[0, 1\]/);
 assert.doesNotMatch(text,/unsigned local16 \[65535, 1\]/);
});
check('axis convention, fixed point and calibration status remain explicit',()=>{
 for(const label of ['符号付き32bit固定小数点 /4096','world Z','高さ Y は未観測','ヒューリスティック・未校正','被覆率不明','メモリ読出値ではありません','別マップ・別位置ピーク・本人の対応候補・未表示候補','AT消費を推定したものではありません'])assert(text.includes(label),label);
});
check('negative coordinates use unsigned local parts within the signed chunk',()=>{
 const result=api.formatCoordinateRanges(candidate(-28,-16.5,-16,-16));
 assert.match(result.summary,/X範囲 約\[-28\.00, -16\.50\] · Z範囲 約\[-16\.00, -16\.00\]/);
 assert.match(result.lines.join('\n'),/X chunk -2（unsigned16 65534）: unsigned local16 \[16384, 63488\] \/4096 = \[4, 15\.5\]/);
 assert.match(result.lines.join('\n'),/Z chunk -1（unsigned16 65535）: unsigned local16 \[0, 0\]/);
});
check('full range and omitted chunks survive the chunk display cap',()=>{
 const result=api.formatCoordinateRanges(candidate(-32,320,0,0));
 assert.match(result.summary,/X範囲 約\[-32\.00, 320\.00\]/);
 assert.match(result.lines.join('\n'),/signed chunk \[-2, 20\] · 23チャンク候補/);
 assert.equal(result.lines.filter(line=>line.startsWith('X chunk ')).length,16);
 assert.match(result.lines.join('\n'),/16\/23チャンクを表示 · 未表示7チャンクも全体範囲の候補として保持/);
});
check('missing bounds never fall back to one center-derived word',()=>{
 const noBounds=imageToMapCoordinateCandidate({imageX:42,imageY:17,originPixel:[0,0],scale:1});
 const result=api.formatCoordinateRanges(noBounds);
 assert.match(result.summary,/X範囲 未確定 · Z範囲 未確定/);
 assert.doesNotMatch(result.lines.join('\n'),/X chunk|Z chunk|42|69632/);
 assert.equal(api.formatCoordinateRanges(null).summary,'マップ座標変換は未確定');
});
check('out-of-word-domain intervals stay visible without fabricated packed ranges',()=>{
 const result=api.formatCoordinateRanges(candidate(524287,524289,0,0));
 assert.match(result.summary,/X範囲 約\[524287\.00, 524289\.00\]/);
 assert.match(result.lines.join('\n'),/X: chunk \/ unsigned local16 範囲は未確定（符号付き32bit範囲外）/);
 assert(!result.lines.some(line=>line.startsWith('X chunk ')));
});

const sample=freeze({status:'candidate',stamp:{videoTime:1,frameSerial:1},coordinateCandidates:[boundary]});
check('manual-reference rendering uses the same range lines and preserves the sample',()=>{
 const before=JSON.stringify(sample);api.renderPlayer(sample);
 const row=elements.get('player-coordinates').children[1];
 assert.equal(row.tagName,'details');assert.equal(row.children[0].tagName,'summary');
 assert.equal(row.children[0].textContent,`点候補1 ${display.summary}`);
 for(const line of display.lines)assert(row.children.some(child=>child.textContent===line));
 assert.equal(JSON.stringify(sample),before);
 assert.doesNotMatch(row.textContent,/0x|tuple=|low16 X=|X≈|Z≈/);
});
check('a later observation gap clears the prior coordinate ranges',()=>{
 api.renderPlayer({status:'gap',reason:'synthetic-gap',stamp:{videoTime:2,frameSerial:2}});
 assert.equal(elements.get('player-coordinates').children.length,1);
 assert.doesNotMatch(elements.get('player-coordinates').textContent,/unsigned local16|X範囲/);
});

const stamp={frameSerial:1,streamId:'synthetic',generation:0,romEpoch:0,referenceEpoch:0,roi:{x:0,y:0,w:1,h:1},markerProfiles:[],profileTolerance:12};
const factors=freeze(factorPartyMapCandidates({stamp,markerFrame:{width:256,height:192},registrationFrame:{width:256,height:192},markers:{frame:{width:256,height:192},candidates:[0,1].map(i=>({id:`marker-${i}`,profileId:'synthetic-gray',x:0,y:16,uncertaintyPixels:{x:0,y:0}}))},disambiguation:{stamp,candidateSource:{},unknown:[{mapId:99,reason:'unsearched'}],rankings:[0,1].map(i=>({descriptor:`synthetic-${i}`,mapIds:[10+i,20+i],imageWidth:256,imageHeight:192,originPixel:[0,0],worldToMapScale:1,registration:{resolved:false,candidates:Array.from({length:8},(_,peak)=>({scale:1,dx:peak,dy:0,score:.5}))}}))}}));
check('factored preview retains map aliases, weak peaks, identities and capped alternatives',()=>{
 const before=JSON.stringify(factors),host=new Element();api.renderCandidatePartyCoordinates(factors,host);
 assert.match(host.children[0].textContent,/24\/32組を表示（残りも分解した候補データで保持）/);
 assert.match(host.children[0].textContent,/未評価マップ 1件/);
 assert.equal(host.children.length,25);
 const row=host.children[1],expected=api.formatCoordinateRanges(previewPartyMapCandidates(factors,24).rows[0].mapCoordinate);
 assert.match(row.children[0].textContent,/map 10\/20/);assert.match(row.children[0].textContent,/画像位置未確定/);
 assert(row.children[0].textContent.endsWith(expected.summary));
 for(const line of expected.lines)assert(row.children.some(child=>child.textContent===line));
 assert.match(row.textContent,/同名ID・弱い位置候補・未探索マップは除外していません/);
 assert.doesNotMatch(host.textContent,/0x|tuple=|low16 X=|X≈|Z≈/);
 assert.equal(JSON.stringify(factors),before);
});

console.log(JSON.stringify({passed:true,checks,scope:'synthetic shared formatting and both coordinate render paths; no browser visual or real-video accuracy claim'}));
