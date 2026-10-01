import {inferenceAssetForRequest,inferenceAssetResponse,readCachedInferenceAsset} from './monster-inference-assets.mjs';

// No install precache, navigation fallback, proxy, messages, ROMs, or captures.
// Registration is explicit in the setup UI and refuses a different controller.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const asset=inferenceAssetForRequest(event.request);if(!asset)return;
 // Explicit setup/repair downloads use no-store and verify before Cache.put.
 // Let only that exact allowlisted GET use the network; normal imports stay
 // cache-only, including when a cached asset is missing or corrupt.
 if(event.request.cache==='no-store')return;
 event.respondWith(readCachedInferenceAsset(asset.id,{signal:event.request.signal})
  .then(bytes=>inferenceAssetResponse(asset,bytes))
  .catch(()=>Response.error()));
});
