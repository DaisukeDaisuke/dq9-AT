import assert from 'node:assert/strict';
import {detectDSScreens} from '../web/ds-screen-detect.mjs';

// Procedural RGBA only: no videos, private fixtures, reference snapshots, or deps.
// The title glyphs and panels are geometry controls, not text/party recognition.
const colors={background:[25,28,35,255],parchment:[218,166,85,255],panel:[48,48,48,255],ink:[225,225,225,255]};
function canvas(width=640,height=480){const image={width,height,data:new Uint8ClampedArray(width*height*4)};fill(image,0,0,width,height,colors.background);return image;}
function fill(image,x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)image.data.set(color,(yy*image.width+xx)*4);}
function map(image,x=0,y=0,panels=1){
 fill(image,x,y,256,192,colors.parchment);
 fill(image,x+136,y,120,16,[55,45,32,255]);
 for(let xx=150;xx<251;xx+=10)fill(image,x+xx,y+4,3,8,colors.ink);
 for(let slot=0;slot<panels;slot++){
  const sx=x+slot*64;
  fill(image,sx,y+176,64,16,colors.panel);
  fill(image,sx+1,y+180,1,10,colors.ink);
  fill(image,sx+62,y+180,1,10,colors.ink);
  fill(image,sx+28,y+182,4,6,colors.ink);
 }
 return image;
}
const report=[];
function check(name,image,resolved,{box,reason}={}){
 const result=detectDSScreens(image),best=result.candidates[0];
 assert.equal(result.resolved,resolved,`${name}: ${result.reason}`);
 if(box)assert.deepEqual(['x','y','w','h'].map(k=>best[k]),box,name);
 if(reason)assert.equal(result.reason,reason,name);
 assert.equal(result.minimumProvenATCalls,0,name);
 assert.equal(result.confidenceCalibrated,false,name);
 report.push({name,resolved:result.resolved,reason:result.reason});
 return result;
}
const single=check('one corroborated party panel',map(canvas()),true,{box:[0,0,256,192]});
assert(single.candidates[0].partyDark<.35,'Solo fixture must exercise the local fallback');
assert(single.candidates[0].partyPanel.confirmed);
const four=check('four party panels',map(canvas(),0,0,4),true,{box:[0,0,256,192]});
assert(four.candidates[0].partyDark>.35,'Four-panel fixture must exercise original whole-footer evidence');
check('moved one-panel map',map(canvas(),100,80),true,{box:[100,80,256,192]});
check('map/title without party panel',map(canvas(),0,0,0),false);
for(const [name,rect,color]of[
 ['panel without text',[12,181,40,8],colors.panel],
 ['panel without left border',[1,180,1,10],colors.panel],
 ['panel without right border',[62,180,1,10],colors.panel],
 ['panel without dark interior',[12,181,40,8],colors.ink],
 ['map without title',[136,0,120,16],colors.parchment],
 ['title and panel without parchment',[0,24,256,144],[70,110,150,255]],
]){const image=map(canvas());fill(image,...rect,color);check(name,image,false);}
// These intentionally generic controls exercise screen-role rejection only.
for(const [name,color]of[['menu-like',[45,55,75,255]],['battle-like',[115,90,70,255]],['gameplay-like',[218,166,85,255]]]){
 const image=canvas();fill(image,40,30,256,192,color);
 for(let row=0;row<5;row++)fill(image,60,90+row*16,120,3,colors.ink);
 check(`${name} rectangle without map HUD`,image,false);
}
check('blank',canvas(),false);
const tie=map(map(canvas(),0,0),350,250);
check('two equally supported one-panel maps',tie,false,{reason:'ambiguous-rectangles'});
console.log(`PASS: ${report.length} portable synthetic DS-screen regressions`);
