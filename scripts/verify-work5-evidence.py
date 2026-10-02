#!/usr/bin/env python3
"""Verify a downloaded private evidence bundle without reading ROM or SAV."""
import hashlib,json,sys
from pathlib import Path,PurePosixPath

def main():
 if len(sys.argv)!=2: raise ValueError('Usage: verify-work5-evidence.py PRIVATE_EVIDENCE_MANIFEST.json')
 manifest=Path(sys.argv[1]).resolve();root=manifest.parent
 data=json.loads(manifest.read_text(encoding='utf-8'))
 if data.get('schema')!='work5-private-evidence-manifest-v1': raise ValueError('Unknown manifest schema')
 seen=set()
 for row in data['files']:
  relative=PurePosixPath(row['path'])
  if relative.is_absolute() or '..' in relative.parts or row['path'] in seen: raise ValueError('Unsafe or duplicate manifest path')
  seen.add(row['path']);file=root.joinpath(*relative.parts)
  if file.is_symlink() or not file.resolve().is_relative_to(root): raise ValueError('Unsafe evidence link')
  value=file.read_bytes()
  if len(value)!=row['bytes'] or hashlib.sha256(value).hexdigest()!=row['sha256']: raise ValueError('Evidence changed: '+row['path'])
 print(json.dumps({'passed':True,'files':len(seen),'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest()}))

if __name__=='__main__': main()
