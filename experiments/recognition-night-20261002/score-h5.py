import json,pathlib
p=pathlib.Path(__file__).parent
a={f['frame_id']:f for f in json.loads((p/'H5_ANNOTATIONS_BEFORE_PREDICTION.json').read_text())['frames']}
r=json.loads((p/'H5_RAW_PREDICTIONS.json').read_text())['records']
def iou(b,g):
 x,y,w,h=g;i=max(0,min(b['x']+b['w'],x+w)-max(b['x'],x))*max(0,min(b['y']+b['h'],y+h)-max(b['y'],y));return i/(b['w']*b['h']+w*h-i)
rows=[]
for known in [False,True]:
 for method in ['baseline','frozen','revised']:
  for budget in [2,8,'raw']:
   for threshold in [.3,.5]:
    row=dict(known_regression=known,method=method,budget=budget,iou=threshold,frames=0,gt=0,tp=0,fp=0,details=[])
    for f in r:
     ann=a[f['frame_id']]
     if not ann['eligible'] or ann['known_regression']!=known:continue
     gt=[o['bbox'] for o in ann['objects'] if o['kind']=='enemy'];v=f[method];ps=v.get('rawCandidates',v['proposals']) if budget=='raw' else v['proposals'][:budget]
     pairs=sorted([(iou(b['nativeROI'],g),i,j) for i,b in enumerate(ps) for j,g in enumerate(gt) if iou(b['nativeROI'],g)>=threshold],key=lambda x:(-x[0],x[1],x[2]));up=set();ug=set()
     for value,i,j in pairs:
      if i not in up and j not in ug:up.add(i);ug.add(j)
     row['frames']+=1;row['gt']+=len(gt);row['tp']+=len(up);row['fp']+=len(ps)-len(up);row['details'].append(dict(id=f['frame_id'],tp=len(up),fp=len(ps)-len(up),missed=len(gt)-len(up)))
    rows.append(row)
(p/'H5_METRICS.json').write_text(json.dumps(dict(matching='one-to-one descending IoU, location only',provider='ORT CPU; not browser performance',fresh_frames=7,fresh_enemy_count=2,rows=rows),indent=2)+'\n')
for r in rows:
 if r['budget']==2 and r['iou']==.5:print({k:v for k,v in r.items() if k!='details'})
