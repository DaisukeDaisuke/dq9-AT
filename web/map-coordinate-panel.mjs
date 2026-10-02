import {coordinateIndexFor,mapCoordinateIndexCSV} from './map-coordinate-index.mjs';
const $=id=>document.getElementById(id),text=$('coordinate-info'),toggle=$('coordinate-overlay'),json=$('export-coordinates'),csv=$('export-coordinates-csv');
let index=null,current=null;
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function reset(){index=null;current=null;if(text)text.textContent='NDSを開くと、選択したmap IDの地図上の対応位置を表示します。';if(toggle){toggle.disabled=true;toggle.checked=true;}if(json)json.disabled=true;if(csv)csv.disabled=true;}
function update(){
 if(!text)return;const row=index?.rows.find(r=>r.mapId===current?.mapId&&r.descriptor===current?.descriptor),f=n=>Number(n).toFixed(3);
 if(toggle)toggle.disabled=!row?.imagePoint;
 if(!current){text.textContent='map IDを選択すると、固定表示点または物理X/Zの対応を確認できます。';return;}
 if(!row){text.textContent='このmap IDと表示地図の座標対応は未確定です。';return;}
 if(row.kind==='fixed-display-anchor')text.textContent=`map ${row.mapId} → ${row.descriptor} · 固定表示 X ${f(row.displayAnchor.x)} / Z ${f(row.displayAnchor.z)}${row.imagePoint?` · 画像pixel (${f(row.imagePoint.x)}, ${f(row.imagePoint.y)})${row.imagePoint.insideImage?'':' · 画像範囲外'}`:' · pixel変換未対応'}。建物などの代表点です。室内の人物位置には変換できません。pixel位置は未校正の暫定値です。`;
 else if(row.kind==='physical-xz')text.textContent=`map ${row.mapId} → ${row.descriptor} · 通常グループでは物理X/Zを使用します。${row.frame.status==='provisional-descriptor-transform'?`pixelX = X × ${row.frame.scale} − (${row.frame.originPixel[0]}), pixelY = Z × ${row.frame.scale} − (${row.frame.originPixel[1]})。`:''}座標値を観測していないため点は置きません。変換は未校正です。`;
 else text.textContent='座標グループの順序または値を検証できません。点は置きません。';
}
export function paintCoordinateAnchor(context,image,mapId,descriptor){
 const row=index?.rows.find(r=>r.mapId===mapId&&r.descriptor===descriptor),p=row?.imagePoint;
 if(!toggle?.checked||!p?.insideImage||image.width!==row.frame.width||image.height!==row.frame.height)return;
 context.save();context.strokeStyle='#fff';context.lineWidth=4;context.beginPath();context.arc(p.x,p.y,5,0,Math.PI*2);context.stroke();context.strokeStyle='#bc2456';context.lineWidth=2;context.stroke();context.beginPath();context.moveTo(p.x-8,p.y);context.lineTo(p.x+8,p.y);context.moveTo(p.x,p.y-8);context.lineTo(p.x,p.y+8);context.stroke();context.restore();
}
window.addEventListener('dq9-rom-metadata',e=>{try{index=coordinateIndexFor(e.detail);if(json)json.disabled=false;if(csv)csv.disabled=false;update();}catch(error){reset();if(text)text.textContent='座標対応を作成できません: '+error.message;}});
window.addEventListener('dq9-rom-release',reset);
window.addEventListener('dq9-map-image',e=>{current=e.detail;update();});
if(toggle)toggle.onchange=()=>window.dispatchEvent(new CustomEvent('dq9-coordinate-overlay-change'));
if(json)json.onclick=()=>{if(index)download('dq9-map-coordinate-index-local.json',JSON.stringify(index,null,2),'application/json');};
if(csv)csv.onclick=()=>{if(index)download('dq9-map-coordinate-index-local.csv',mapCoordinateIndexCSV(index),'text/csv;charset=utf-8');};
reset();
