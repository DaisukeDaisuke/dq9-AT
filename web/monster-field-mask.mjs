// Pixel-only field exclusion. This never creates negative enemy/AT evidence.
export const FIELD_CENTER_MASK=Object.freeze({x:.42,y:.36,w:.16,h:.24});
const need=(v,m)=>{if(!v)throw Error(m);};
export function normalizeSceneContext(context,sourceFrame){
 if(context==null)return{kind:'unspecified',gameplayROI:null,excludeCenter:false,maskNormalized:{...FIELD_CENTER_MASK}};
 need(context&&['field','unspecified'].includes(context.kind),'画面の種類を選択してください');
 need(typeof context.excludeCenter==='boolean','中央領域の設定が不正です');
 const m=context.maskNormalized??FIELD_CENTER_MASK;need(m&&Object.keys(FIELD_CENTER_MASK).every(k=>m[k]===FIELD_CENTER_MASK[k]),'中央領域の範囲がこの実験と一致しません');
 if(context.kind==='unspecified'){need(!context.excludeCenter,'中央領域を除外するにはフィールド画面を指定してください');return{kind:'unspecified',gameplayROI:null,excludeCenter:false,maskNormalized:{...FIELD_CENTER_MASK}};}
 const r=context.gameplayROI;need(r&&[r.x,r.y,r.w,r.h].every(Number.isInteger)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=sourceFrame.width&&r.y+r.h<=sourceFrame.height,'操作画面の範囲を元画像の中に指定してください');
 return{kind:'field',gameplayROI:{x:r.x,y:r.y,w:r.w,h:r.h},excludeCenter:context.excludeCenter,maskNormalized:{...FIELD_CENTER_MASK}};
}
export function getFieldExclusion(captureStamp,sceneContext){
 const s=normalizeSceneContext(sceneContext,captureStamp.sourceFrame);if(s.kind!=='field'||!s.excludeCenter)return{enabled:false,excluded:false,mask:null,overlapPixels:0};
 const r=s.gameplayROI,m=s.maskNormalized,x=Math.floor(r.x+m.x*r.w),y=Math.floor(r.y+m.y*r.h),x1=Math.ceil(r.x+(m.x+m.w)*r.w),y1=Math.ceil(r.y+(m.y+m.h)*r.h),mask={x,y,w:x1-x,h:y1-y};
 const roi=captureStamp.enemyROI;const overlapPixels=roi?Math.max(0,Math.min(roi.x+roi.w,x1)-Math.max(roi.x,x))*Math.max(0,Math.min(roi.y+roi.h,y1)-Math.max(roi.y,y)):0;
 return{enabled:true,excluded:overlapPixels>0,mask,overlapPixels};
}
