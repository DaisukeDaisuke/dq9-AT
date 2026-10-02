#!/usr/bin/env python3
"""Dependency-free validator for exactly the keywords used by this schema.
Unsupported schema keywords fail explicitly. This is not a general RFC validator.
"""
import json,re,sys,hashlib,copy
from pathlib import Path
class Invalid(ValueError): pass
SUPPORTED={'$schema','$id','$defs','$ref','type','additionalProperties','required','properties','const','enum','minimum','maximum','minLength','minItems','maxItems','uniqueItems','items','pattern','allOf','if','then'}
def schema_check(s):
 if not isinstance(s,dict): raise Invalid('Schema node is not an object')
 for k in s:
  if k not in SUPPORTED: raise Invalid('Unsupported schema keyword '+k)
 for key in ['properties','$defs']:
  for child in s.get(key,{}).values(): schema_check(child)
 for key in ['items','if','then']:
  if key in s: schema_check(s[key])
 for child in s.get('allOf',[]): schema_check(child)
def validate(v,s,root,p='$'):
 if '$ref' in s:
  target=root
  if not s['$ref'].startswith('#/'): raise Invalid('Unsupported external ref')
  for token in s['$ref'][2:].split('/'): target=target[token.replace('~1','/').replace('~0','~')]
  validate(v,target,root,p)
 types={'object':lambda x:isinstance(x,dict),'array':lambda x:isinstance(x,list),'integer':lambda x:isinstance(x,int) and not isinstance(x,bool),'number':lambda x:isinstance(x,(int,float)) and not isinstance(x,bool),'string':lambda x:isinstance(x,str),'boolean':lambda x:isinstance(x,bool),'null':lambda x:x is None}
 if 'type' in s:
  kinds=s['type'] if isinstance(s['type'],list) else [s['type']]
  if any(k not in types for k in kinds): raise Invalid('Unsupported type')
  if not any(types[k](v) for k in kinds): raise Invalid(p+': type')
 if 'const' in s and v!=s['const']: raise Invalid(p+': const')
 if 'enum' in s and v not in s['enum']: raise Invalid(p+': enum')
 if isinstance(v,dict):
  for k in s.get('required',[]):
   if k not in v: raise Invalid(p+': missing '+k)
  if s.get('additionalProperties') is False and set(v)-set(s.get('properties',{})): raise Invalid(p+': extra property')
  for k,child in s.get('properties',{}).items():
   if k in v: validate(v[k],child,root,p+'.'+k)
 if isinstance(v,list):
  if len(v)<s.get('minItems',0) or len(v)>s.get('maxItems',len(v)): raise Invalid(p+': array bounds')
  if s.get('uniqueItems') and len({json.dumps(x,sort_keys=True,ensure_ascii=False) for x in v})!=len(v): raise Invalid(p+': duplicate')
  if 'items' in s:
   for i,x in enumerate(v): validate(x,s['items'],root,p+'['+str(i)+']')
 if isinstance(v,str):
  if len(v)<s.get('minLength',0): raise Invalid(p+': string length')
  if 'pattern' in s and not re.search(s['pattern'],v): raise Invalid(p+': pattern')
 if isinstance(v,(int,float)) and not isinstance(v,bool):
  if v<s.get('minimum',v) or v>s.get('maximum',v): raise Invalid(p+': numeric range')
 for child in s.get('allOf',[]): validate(v,child,root,p)
 if 'if' in s:
  try: validate(v,s['if'],root,p)
  except Invalid: pass
  else:
   if 'then' in s: validate(v,s['then'],root,p)
def main():
 if len(sys.argv)!=4: raise Invalid('Usage: validate-actor-schema.py SCHEMA.json DATA.json REPORT.json')
 sp,dp,out=map(Path,sys.argv[1:]);s=json.loads(sp.read_text(encoding='utf-8'));raw=dp.read_bytes();d=json.loads(raw);schema_check(s);validate(d,s,s)
 mutations=[lambda x:x.update(futureRAM={}),lambda x:x.update(staticOnly=False),lambda x:x['calls'][0]['fields'][0].update(widthBits=64),lambda x:x['calls'][0]['fields'][0].update(signed=1),lambda x:x['calls'][0]['fields'][0].update(status='unresolved',reason=None),lambda x:x['predictionResources'].update(futureSeed=0)]
 for mutation in mutations:
  # Shallow outer copies plus a deep first call/resources suffice; the source
  # extraction is never changed by the negative validation fixtures.
  bad={**d,'calls':[copy.deepcopy(d['calls'][0]),*d['calls'][1:]],'predictionResources':copy.deepcopy(d['predictionResources'])};mutation(bad)
  try: validate(bad,s,s)
  except Invalid: pass
  else: raise Invalid('Negative fixture accepted')
 out.write_text(json.dumps({'schema':'work5-schema-verification-v1','passed':True,'schemaSha256':hashlib.sha256(sp.read_bytes()).hexdigest(),'dataSha256':hashlib.sha256(raw).hexdigest(),'negativeFixtures':len(mutations),'scope':'All keywords used by supplied schema; unsupported keyword fails; not full general JSON Schema'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Schema validated; 6 invalid fixtures rejected')
if __name__=='__main__': main()
