/* A ROM BMMP display anchor can support a map hypothesis, never actor XZ.
 * Agreement uses the exact existing marker/registration uncertainty interval.
 * No extra pixel threshold, landmark coordinate, or floor is introduced.
 */
export function fixedDisplayAnchorCandidates(result,mapImage){
 if(result?.binding?.kind!=='fixed-display-anchor'||!result.selection?.firstSlotHUDConfirmed)return[];
 const out=[];for(const candidate of result.candidates??[]){
  if(!candidate.registrationAccepted||candidate.slotColorCandidates.length!==1||candidate.slotColorCandidates[0]!==1||candidate.world!==null||candidate.floor!==null)continue;
  const marker=result.markers.candidates.find(m=>m.id===candidate.markerId),peak=result.registration.candidates[candidate.peakIndex],anchor=candidate.coordinate?.displayAnchor;if(!marker||!peak||!anchor)continue;
  const sx=Math.round(mapImage.width*peak.scale)/mapImage.width,sy=Math.round(mapImage.height*peak.scale)/mapImage.height;if(!(sx>0&&sy>0))continue;
  const ux=((marker.uncertaintyPixels?.x??0)/2+1)/sx,uy=((marker.uncertaintyPixels?.y??0)/2+1)/sy,bounds={left:candidate.image.x-ux,right:candidate.image.x+ux,top:candidate.image.y-uy,bottom:candidate.image.y+uy},anchorImage={x:anchor.x*mapImage.descriptor.worldToMapScale-mapImage.originPixel[0],y:anchor.z*mapImage.descriptor.worldToMapScale-mapImage.originPixel[1]};
  if(!Object.values(anchorImage).every(Number.isFinite)||anchorImage.x<bounds.left||anchorImage.x>bounds.right||anchorImage.y<bounds.top||anchorImage.y>bounds.bottom)continue;
  out.push({kind:'same-frame-fixed-display-anchor-hypothesis',mapId:result.binding.mapId,descriptor:mapImage.descriptor.path,markerId:candidate.markerId,peakIndex:candidate.peakIndex,observedImage:{...candidate.image},observedImageBounds:bounds,anchorImage,displayAnchor:anchor,binding:result.binding,world:null,floor:null,actorPositionKnown:false,playerIdentityProven:false,mapIdentityCertified:false,minimumProvenATCalls:0,scope:'Same-frame registered marker is compatible with this ROM map display anchor. It supplies no actor world coordinates, geometric floor or camera state.'});
 }
 return out;
}
