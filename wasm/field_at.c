/* Field RNG leaf decisions, ported from 02075050 and 02079d54.
 * Caller supplies measured/hypothesized state explicitly. No frame scheduler,
 * occupancy inference, player pathfinding or boot-proof claim is made here. */
typedef unsigned int u32;
__attribute__((export_name("field_table_candidates"))) u32 field_table_candidates(const u32 *flags,u32 count,u32 time_value,u32 area_mask,u32 *indices){
 u32 preferred=0;
 for(u32 i=0;i<count;i++){u32 mode=flags[i]&7,mask=(flags[i]>>13)&255;if((mode==0&&time_value==0)||(mode==1&&time_value!=0))continue;if(mask==0||(mask&area_mask))indices[preferred++]=i;}
 if(preferred)return preferred;
 u32 fallback=0;for(u32 i=0;i<count;i++){u32 mode=flags[i]&7;if((mode==0&&time_value==0)||(mode==1&&time_value!=0))continue;indices[fallback++]=i;}return fallback;
}
__attribute__((export_name("field_neighbor_candidates"))) int field_neighbor_candidates(const u32 *area_masks,const u32 *occupied,u32 count,u32 table_area_mask,u32 *indices){
 u32 found=0;for(u32 i=0;i<count;i++){if(area_masks[i]&&!(area_masks[i]&table_area_mask))continue;if(occupied[i]>1)return -1;if(!occupied[i])indices[found++]=i;}return (int)found;
}
__attribute__((export_name("field_movement_index"))) int field_movement_index(u32 random,u32 count){return count?(int)(random%count):-1;}
