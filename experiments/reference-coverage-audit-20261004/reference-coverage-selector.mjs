// Preserve original sampling except when it discards available required spatial bins.
export function selectWithCoverage(points,n){
 const count=Math.min(n,points.length);if(!count)return[];const selected=Array.from({length:count},(_,i)=>points[Math.floor((i+.5)*points.length/count)]),v=p=>Math.min(2,Math.floor(p.y*3)),h=p=>p.x>=.5?1:0;
 const bins=a=>({v:new Set(a.map(v)),h:new Set(a.map(h))});
 for(const [axis,values,key]of[[v,[0,1,2],'v'],[h,[0,1],'h']])for(const value of values){if(selected.some(p=>axis(p)===value))continue;const pool=points.filter(p=>axis(p)===value);if(!pool.length)continue;const add=pool[Math.floor(pool.length/2)],before=bins(selected);let replace=-1;
  for(let i=selected.length-1;i>=0;i--){const after=bins(selected.filter((_,j)=>j!==i));if([...before.v].every(x=>after.v.has(x))&&[...before.h].every(x=>after.h.has(x))){replace=i;break;}}
  if(replace<0)throw Error('No coverage-preserving replacement within fixed sample budget');selected[replace]=add;
 }
 return selected;
}
