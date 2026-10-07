import {queryPreferredFieldNode,preferredNodeTrigFromRom,fieldNativeFacing} from './field-preferred-node.mjs';

// Explicit scenario inputs only. No current game state or actual safety claim.
export function spawnZoneScenario({graph,trig,party,group=0,emptyPool=false}={}){
 if(!Number.isInteger(group)||group<0||group>3)throw Error('Natural group0..3 required');
 const inventory={slots:Array.from({length:12},(_,i)=>emptyPool?{slot:112+group*12+i,registryKnown:true,pointer:0}:{slot:112+group*12+i,registryKnown:false})};
 const members=Array.from({length:4},(_,i)=>{
  const p=party?.[i];if(!p?.specified)return {member:i+1,resolved:false,reason:'member position/facing/current node unknown'};
  const result=queryPreferredFieldNode({queryReached:true,graph,trig,inventory,fieldFlags:group,player:{graphEnabled:true,position:p.position,angle:p.angle,nodeIndex:p.nodeIndex}});
  return {member:i+1,...result};
 });
 return {conditional:true,inputScope:'manual scenario; no observed runtime timestamp',assumptions:{queryReached:true,graphEnabled:true,emptyPool,group},members,allPartySpecified:Array.from({length:4},(_,i)=>party?.[i]?.specified===true).every(Boolean),allQueriesResolved:members.every(x=>x.resolved),laterEligibility:'unknown',totalAT:'unknown',invulnerabilityCertified:false,actualQueryReachability:'unknown'};
}
export function canvasWorldPoint(x,y,transform){if(!transform||!Number.isFinite(transform.scale)||transform.scale<=0)return null;return {x:(x-transform.x)/transform.scale,z:(y-transform.z)/transform.scale};}

export function mapUnderlayTransform(image,width,height){
 const unit=image?.descriptor?.worldToMapScale,origin=image?.originPixel;
 if(!Number.isFinite(unit)||unit<=0||!Array.isArray(origin)||origin.length!==2||!origin.every(Number.isFinite)||!Number.isFinite(image.width)||image.width<=0||!Number.isFinite(image.height)||image.height<=0||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const fit=Math.min(width/image.width,height/image.height),ox=(width-image.width*fit)/2,oz=(height-image.height*fit)/2;
 return {scale:unit*fit,x:ox-origin[0]*fit,z:oz-origin[1]*fit,fit,ox,oz};
}

export function nodeDiskCoverage(nodes,transform,width,height){
 const counts=new Uint8Array(width*height);if(!transform||transform.scale<=0)return counts;
 const radius=3.5*transform.scale,r2=radius*radius;
 for(const node of nodes??[]){const cx=transform.x+node.position[0]*transform.scale,cz=transform.z+node.position[2]*transform.scale;
  for(let y=Math.max(0,Math.floor(cz-radius));y<=Math.min(height-1,Math.ceil(cz+radius));y++)for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(width-1,Math.ceil(cx+radius));x++)if((x+.5-cx)**2+(y+.5-cz)**2<=r2){const i=y*width+x;if(counts[i]<255)counts[i]++;}
 }return counts;
}

if(typeof document!=='undefined')setup();
function setup(){
 const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d');let worker=null,metadata=null,image=null,graph=null,trig=null,epoch=0,request=0,selected=null,transform=null,scenario=null;
 const colors=['#ff9393','#92c1ff','#ffe18c','#d2a2ff'];
 const party=Array.from({length:4},(_,i)=>({specified:i===0,position:[0,0,0],angle:0,nodeIndex:-1}));
 const status=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
 function release(){epoch++;request++;worker?.terminate();worker=null;metadata=image=graph=trig=selected=null;transform=scenario=null;$('rom').value='';$('maps').replaceChildren();$('maps').disabled=true;$('descriptor').replaceChildren();$('descriptor').disabled=true;$('release').disabled=true;$('map-info').textContent='';renderParty();draw();status('NDSを解放しました。位置・向きは次のROMへ引き継ぎません。');party.forEach((p,i)=>Object.assign(p,{specified:i===0,position:[0,0,0],angle:0,nodeIndex:-1}));renderParty();}
 async function load(file){if(!file)return;if(!/\.nds$/i.test(file.name)){status('NDSファイルを選択してください',true);return;}release();const id=epoch;$('release').disabled=false;status('NDSをブラウザ内で読み込み中');try{
  const csvResponse=await fetch('./data/map-id-names.csv');if(!csvResponse.ok)throw Error('マップ名CSVを取得できません');const csv=await csvResponse.text(),buffer=await file.arrayBuffer();if(id!==epoch)return;
  let trigWarning='';try{trig=preferredNodeTrigFromRom(buffer);}catch(e){trigWarning=e.message;}
  worker=new Worker(new URL('./worker.mjs?v=registration-timing-20261007-0020',import.meta.url),{type:'module'});worker.onerror=e=>{if(id===epoch)status('Worker: '+e.message,true);};
  worker.onmessage=({data:m})=>{if(id!==epoch)return;if(m.type==='progress')status(m.message);if(m.type==='error')status(m.message,true);if(m.type==='loaded'){metadata=m.metadata;$('maps').disabled=false;$('release').disabled=false;list();const choice=metadata.records.find(r=>r.mapId===7402)||metadata.records[0];if(choice){$('maps').value=choice.key;select(choice.key);}status(`ローカル読込完了：${metadata.records.length} maps / ${metadata.fieldGraphs.summary.graphs}静的グラフ${trigWarning?'。向き計算は未対応ROMのため保留':''}`);}if(m.type==='image'&&m.requestId===request){image=m.image;draw();}};
  worker.postMessage({type:'load',buffer,csv},[buffer]);
 }catch(e){if(id===epoch)status(e.message,true);}}
 function list(){const query=$('search').value.normalize('NFKC').toLowerCase(),rows=(metadata?.records??[]).filter(r=>`${r.mapId} ${r.name} ${r.fieldCode}`.normalize('NFKC').toLowerCase().includes(query));$('maps').replaceChildren(...rows.map(r=>new Option(`${r.mapId} ${r.name||r.fieldCode||''}${r.fieldGraph?.key?'':' [グラフ未結合]'}`,r.key)));if(selected&&rows.includes(selected))$('maps').value=selected.key;}
 function select(key){selected=metadata?.records.find(r=>r.key===key);image=null;request++;graph=metadata?.fieldGraphs.graphs.find(g=>g.key===selected?.fieldGraph?.key)??null;party.forEach((p,i)=>{p.specified=i===0;p.nodeIndex=-1;p.position=graph?.nodes[0]?.position.map(x=>x*4096)??[0,0,0];p.angle=0;});$('descriptor').replaceChildren(...(selected?.candidates??[]).map(c=>new Option(c.path,c.path)));$('descriptor').disabled=!selected?.candidates?.length;$('map-info').textContent=graph?`${graph.nodes.length}ノード / ${graph.edges.length}辺。敵の経路グラフであり、プレイヤーの歩行可能領域ではありません。`:'静的グラフ未結合。生成ダンジョン等を空グラフ＝安全とは扱いません。';renderParty();renderImage();draw();}
 function renderImage(){image=null;request++;if(worker&&$('descriptor').value)worker.postMessage({type:'render',descriptor:$('descriptor').value,requestId:request});draw();}
 function renderParty(){const container=$('party');container.replaceChildren();party.forEach((p,i)=>{const row=document.createElement('div');row.className='party-row';const member=document.createElement('label');member.className='member';member.style.color=colors[i];const radio=document.createElement('input');radio.type='radio';radio.name='member';radio.value=i;radio.checked=i===0;member.append(radio,` ${i+1}`);const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=p.specified;enabled.onchange=()=>{p.specified=enabled.checked;draw();};member.append(document.createElement('br'),enabled,' 指定');row.append(member);
  ['X','Y','Z'].forEach((axis,j)=>{const label=document.createElement('label');label.textContent=axis;const input=document.createElement('input');input.type='number';input.step='0.25';input.value=p.position[j]/4096;input.dataset.axis=j;input.onchange=()=>{const n=Number(input.value);p.position[j]=Number.isFinite(n)?Math.round(n*4096):NaN;draw();};label.append(input);row.append(label);});
  const angle=document.createElement('label');angle.textContent='実向き（native整数）';const a=document.createElement('input');a.type='number';a.step=128;a.min=-32768;a.max=32767;a.value=p.angle;const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=25735;slider.step=1;slider.value=((p.angle%25736)+25736)%25736;slider.setAttribute('aria-label',`${i+1}の実向き仮説`);
  const setAngle=value=>{p.angle=Number(value);a.value=p.angle;slider.value=((p.angle%25736)+25736)%25736;draw();};a.onchange=()=>setAngle(a.value);slider.oninput=()=>setAngle(slider.value);const turns=document.createElement('div');turns.className='turns';for(const [label,delta]of [['−90°',-6434],['+90°',6434]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>setAngle(((p.angle+delta)%25736+25736)%25736);turns.append(b);}angle.append(a,slider,turns);row.append(angle);
  const node=document.createElement('label');node.textContent='現在ノード（仮説）';const n=document.createElement('select');n.add(new Option('不明','-1'));for(const v of graph?.nodes??[])n.add(new Option(`${v.index}: ID${v.id}`,v.index));n.value=String(p.nodeIndex);n.onchange=()=>{p.nodeIndex=Number(n.value);draw();};node.append(n);row.append(node);container.append(row);});}
 function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#080d13';ctx.fillRect(0,0,canvas.width,canvas.height);transform=null;
  const underlay=$('overlay').checked?mapUnderlayTransform(image,canvas.width,canvas.height):null;
  if(underlay){const temp=document.createElement('canvas');temp.width=image.width;temp.height=image.height;temp.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(temp,underlay.ox,underlay.oz,image.width*underlay.fit,image.height*underlay.fit);transform=underlay;}
  $('canvas-help').textContent=underlay?`ROMマップ背景 + ノード/円/実向き。${selected?.mapId===7402?'7402は限定範囲の位置対応を検証済み（全域保証なし）。':'このマップの位置対応は未検証です。'}クリックで選択メンバーのXZ仮説を設定。`:`XZ平面表示（${$('overlay').checked?'背景の対応画像/有効な縮尺が未取得':'背景をOFF'}）。クリックで選択メンバーのXZ仮説を設定。`;
  if(!graph?.nodes.length){ctx.fillStyle='#bac9db';ctx.fillText('静的グラフ未結合：生成可否は不明です',24,40);scenario=null;results();return;}
  const nodes=graph.nodes,positions=nodes.map(n=>n.position);let scale,x,z;
  if(underlay){({scale,x,z}=underlay);}
  else{const minX=Math.min(...positions.map(p=>p[0])),maxX=Math.max(...positions.map(p=>p[0])),minZ=Math.min(...positions.map(p=>p[2])),maxZ=Math.max(...positions.map(p=>p[2]));scale=Math.min(640/Math.max(1,maxX-minX),400/Math.max(1,maxZ-minZ));x=40-minX*scale;z=40-minZ*scale;}
  transform={scale,x,z};
  if($('disks').checked){const counts=nodeDiskCoverage(nodes,transform,canvas.width,canvas.height),layer=ctx.createImageData(canvas.width,canvas.height);for(let i=0;i<counts.length;i++)if(counts[i])layer.data.set(counts[i]>=2?[73,205,230,75]:[235,161,63,42],i*4);const temp=document.createElement('canvas');temp.width=canvas.width;temp.height=canvas.height;temp.getContext('2d').putImageData(layer,0,0);ctx.drawImage(temp,0,0);}
  const point=p=>[x+p[0]*scale,z+p[2]*scale];ctx.strokeStyle='#6d8495';ctx.lineWidth=1;for(const [a,b]of graph.edges){if(!nodes[a]||!nodes[b])continue;ctx.beginPath();ctx.moveTo(...point(nodes[a].position));ctx.lineTo(...point(nodes[b].position));ctx.stroke();}
  scenario=spawnZoneScenario({graph,trig,party,group:Number($('group').value),emptyPool:$('empty-pool').checked});const active=Number(document.querySelector('[name=member]:checked')?.value??0),m=scenario.members[active];
  for(const n of nodes){const [px,pz]=point(n.position);ctx.fillStyle=m.preferredNodeId===n.id?'#70d6c0':m.nodeIds?.includes(n.id)?'#f0ba58':'#d8e6f3';ctx.beginPath();ctx.arc(px,pz,4,0,Math.PI*2);ctx.fill();ctx.font='10px system-ui';ctx.fillText(String(n.id),px+6,pz-4);}
  party.forEach((p,i)=>{if(!p.specified||p.position.some(n=>!Number.isFinite(n)))return;const [px,pz]=point(p.position.map(n=>n/4096));ctx.fillStyle=colors[i];ctx.beginPath();ctx.arc(px,pz,6,0,Math.PI*2);ctx.fill();ctx.fillText(String(i+1),px+7,pz+13);const facing=fieldNativeFacing(p.angle,trig);if(facing){ctx.strokeStyle=colors[i];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,pz);ctx.lineTo(px+facing[0]/4096*25,pz+facing[2]/4096*25);ctx.stroke();}});results();}
 function results(){const lines=[['静的データ',graph?`${graph.nodes.length}ノード。灰色の辺は敵の経路情報です。`:'グラフ不明。安全判定なし。'],['条件付き選択',scenario?scenario.members.map(m=>`${m.member}: ${!m.resolved?'未解決 ('+m.reason+')':!m.nodeIds.length?'候補0（この到達済みquery仮説のみ）':m.fallbackDrawRequired?`${m.nodeIds.length}候補 / scheduler到達時にfallback AT1回が必要`:`優先ID${m.preferredNodeId} / この選択段階はAT0回`}`).join('\n'):'NDSとマップを選択してください。'],['後段の生成可否','位置補間・衝突・距離・エリア・時間・枠確保・生成結果は未評価。'],['総AT / 生成抑制の保証','不明。未指定party、既存敵の移動、他の消費経路を含む保証は出せません。']];$('results').replaceChildren(...lines.map(([title,text])=>{const d=document.createElement('div');d.className='stage warn';const b=document.createElement('strong');b.textContent=title;const p=document.createElement('p');p.style.whiteSpace='pre-line';p.textContent=text;d.append(b,p);return d;}));$('detail').textContent=JSON.stringify({mapId:selected?.mapId,graph:graph?.key,imageTransformAssumed:$('overlay').checked,underlayApplied:!!($('overlay').checked&&mapUnderlayTransform(image,canvas.width,canvas.height)),nodeDisks:$('disks').checked?'radius3.5 XZ only; same-height assumption; no safety proof':false,scenario},null,2);}
 canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),p=canvasWorldPoint((e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height,transform);if(!p)return;const i=Number(document.querySelector('[name=member]:checked')?.value??0);party[i].position[0]=Math.round(p.x*4096);party[i].position[2]=Math.round(p.z*4096);const inputs=$('party').children[i].querySelectorAll('[data-axis]');inputs[0].value=party[i].position[0]/4096;inputs[2].value=party[i].position[2]/4096;draw();};
 $('rom').onchange=()=>load($('rom').files[0]);$('release').onclick=release;$('search').oninput=list;$('maps').onchange=()=>select($('maps').value);$('descriptor').onchange=renderImage;for(const id of ['group','empty-pool','overlay','disks'])$(id).onchange=draw;$('party').addEventListener('change',draw);renderParty();draw();
}
