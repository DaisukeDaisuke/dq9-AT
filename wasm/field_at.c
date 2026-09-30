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
/* 02074568 scheduler arithmetic. Runtime delta/geometry are explicit inputs. */
__attribute__((export_name("field_clock_delta"))) u32 field_clock_delta(u32 elapsed_low,u32 elapsed_high){return elapsed_high||elapsed_low>50000?50:elapsed_low/1000;}
__attribute__((export_name("field_spawn_timer"))) int field_spawn_timer(u32 timer,u32 delta){return (int)(timer+delta);}
__attribute__((export_name("field_spawn_delay"))) int field_spawn_delay(u32 flags){return (7-(int)((flags>>21)&15))*1000;}
/* -1 unresolved, 0 early return, 1 next member, 2 weighted tail. */
__attribute__((export_name("field_spawn_delay_branch"))) int field_spawn_delay_branch(int timer,u32 flags,u32 attempt,int has_next_member){
 if(timer>=field_spawn_delay(flags)||attempt>=3)return 2;
 if(has_next_member<0)return -1;
 return has_next_member?1:0;
}
__attribute__((export_name("field_spawn_finish_timer"))) int field_spawn_finish_timer(u32 timer,u32 creation_result){return creation_result?0:(int)timer;}
__attribute__((export_name("field_spawn_direction_index"))) int field_spawn_direction_index(const int *dot,u32 count){
 int best=-1,score=0;for(u32 i=0;i<count;i++)if(dot[i]>score){best=(int)i;score=dot[i];}return best;
}
__attribute__((export_name("field_spawn_member"))) int field_spawn_member(const int *ids,const int *near_count,const u32 *eligible,u32 count){
 int chosen=-1,best=3;for(u32 i=0;i<count;i++){if(eligible[i]>1||near_count[i]<0)return -2;if(eligible[i]&&near_count[i]<best){best=near_count[i];chosen=ids[i];}}return chosen;
}
