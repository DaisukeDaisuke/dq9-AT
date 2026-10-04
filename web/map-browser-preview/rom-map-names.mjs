// CSV parser reused unchanged from dq9-AT map-core.mjs (MIT).
export function parseCSV(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}const headers=rows.shift()||[];
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]??''])));
}
export function nameCatalogMaps(catalog,csvText){
 const names=new Map(parseCSV(csvText).map(r=>[Number(r.mapId),r.nameJa]));
 return catalog.maps.map(r=>({...r,name:names.get(r.mapId)||r.name,nameSource:names.has(r.mapId)?'existing-map-id-names.csv':'ROM maplist',displayLabel:`${names.get(r.mapId)||r.name} · ${r.mapId} · ${r.fieldCode}`,key:r.key}));
}
