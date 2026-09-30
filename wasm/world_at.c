typedef unsigned int u32;
/* Actual dq9_new2 return/writer:020409d0->020409dc. */
__attribute__((export_name("world_movement_init"))) u32 world_movement_init(u32 random){return random%2000+2000;}
/* 0203ccf0->0203cd18, with single-precision intermediate and truncation. */
__attribute__((export_name("world_actor_phase"))) int world_actor_phase(u32 random){volatile float fraction=(float)(random%200)/100.0f;return (int)(fraction*4096.0f);}
/* 0208fbd8->0208fbec. Positive ordered descriptor bounds required. */
__attribute__((export_name("world_pickup_phase"))) int world_pickup_phase(u32 random,int lower,int upper){return lower+(int)random%(upper-lower);}
/* Reached 0203ce74..0203ce88 only; flags are read AFTER the actor-motion calls.
 * ARM addition wraps to 32 bits. This is not an elapsed/frame producer. */
__attribute__((export_name("world_actor_elapsed_write"))) u32 world_actor_elapsed_write(u32 elapsed,u32 delta,u32 flags){return (flags&1)?0:elapsed+delta;}
/* 020411b0/020411b4: unsigned threshold >= elapsed skips, including equality. */
__attribute__((export_name("world_movement_due"))) u32 world_movement_due(u32 threshold,u32 elapsed){return elapsed>threshold;}
/* 02041544..020415dc: signed comparisons, original (not clamped) X/Z,
 * ordered vector slots 0,1,2,3. Mode-8 slots are not necessarily axes.
 * Bounds may have equal endpoints. */
__attribute__((export_name("world_direction_mask"))) u32 world_direction_mask(int x,int z,int max_x,int max_z,int min_x,int min_z){return (x<max_x?1:0)|(z<max_z?2:0)|(x>min_x?4:0)|(z>min_z?8:0);}
/* Positive observed candidate count 1..4; callers must reject the empty list.
 * UpdateAT is 0..32767 so the native signed remainder has this same result. */
__attribute__((export_name("world_direction_ordinal"))) u32 world_direction_ordinal(u32 random,u32 count){return random%count;}
