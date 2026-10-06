// Only this module can certify a detached observation graph. The certificate
// is outside the data: no evidence field, serialization or hash is changed.
const immutableBundles=new WeakSet();

// Keep native structuredClone behavior (including unsupported-input errors)
// at the producer boundary. A plain clone can be shared after every node is
// frozen. Built-ins with mutable internal slots/buffers retain the old path.
export function cloneImmutableObservationBundle(value){
 const result=structuredClone(value),nodes=[],seen=new WeakSet(),stack=[result];
 while(stack.length){
  const node=stack.pop();if(!node||typeof node!=='object'||seen.has(node))continue;
  if(!Array.isArray(node)&&Object.getPrototypeOf(node)!==Object.prototype)return result;
  seen.add(node);nodes.push(node);
  for(const key of Object.keys(node)){
   const child=node[key];
   // A mutable AT root must not leave a back-reference to the producer root.
   // Arbitrary internal cycles/aliases are safe once all their nodes freeze.
   if(child===result)return result;
   if(child&&typeof child==='object')stack.push(child);
  }
 }
 if(!result||typeof result!=='object'||Array.isArray(result))return result;
 for(const node of nodes)Object.freeze(node);
 immutableBundles.add(result);return result;
}

// The AT consumer writes only its new top-level companion fields. Certified
// nested evidence is immutable; generic/unfreezable bundles still get their
// own complete native clone. Metadata or Object.isFrozen alone is not proof.
export function copyObservationBundleForAT(bundle){
 return immutableBundles.has(bundle)?{...bundle}:structuredClone(bundle);
}
