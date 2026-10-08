// Only this module can certify a detached observation graph. The certificate
// is outside the data: no evidence field, serialization or hash is changed.
const immutableBundles=new WeakSet(),immutableNodes=new WeakSet();
// Only privately certified detached nodes may cross a later clone unchanged.
// Generic frozen objects, accessors, built-ins and unsupported values use the
// native clone path, preserving its errors and alias/accessor semantics.
function cloneWithCertifiedNodes(value){
 const seen=new WeakSet(),stack=[value],nodes=[];
 while(stack.length){const node=stack.pop();if(node===null||typeof node!=='object'){if(typeof node==='function'||typeof node==='symbol')return structuredClone(value);continue;}
  if(immutableNodes.has(node)||seen.has(node))continue;
  if(!Array.isArray(node)&&Object.getPrototypeOf(node)!==Object.prototype)return structuredClone(value);
  seen.add(node);nodes.push(node);
  for(const key of Object.keys(node)){const d=Object.getOwnPropertyDescriptor(node,key);if(!d||!Object.hasOwn(d,'value'))return structuredClone(value);stack.push(d.value);}
 }
 const copies=new Map(nodes.map(node=>[node,Array.isArray(node)?new Array(node.length):{}]));
 const copied=node=>node&&typeof node==='object'?(copies.get(node)??node):node;
 for(const node of nodes)for(const key of Object.keys(node))Object.defineProperty(copies.get(node),key,{value:copied(node[key]),writable:true,enumerable:true,configurable:true});
 return copied(value);
}

// Keep native structuredClone behavior (including unsupported-input errors)
// at the producer boundary. A plain clone can be shared after every node is
// frozen. Built-ins with mutable internal slots/buffers retain the old path.
export function cloneImmutableObservationBundle(value,{reuseCertifiedSubgraphs=false}={}){
 const result=reuseCertifiedSubgraphs?cloneWithCertifiedNodes(value):structuredClone(value),nodes=[],seen=new WeakSet(),stack=[result];
 while(stack.length){
  const node=stack.pop();if(!node||typeof node!=='object'||seen.has(node)||immutableNodes.has(node))continue;
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
 for(const node of nodes){Object.freeze(node);immutableNodes.add(node);}
 immutableBundles.add(result);return result;
}

// The AT consumer writes only its new top-level companion fields. Certified
// nested evidence is immutable; generic/unfreezable bundles still get their
// own complete native clone. Metadata or Object.isFrozen alone is not proof.
export function copyObservationBundleForAT(bundle){
 return immutableBundles.has(bundle)?{...bundle}:structuredClone(bundle);
}
