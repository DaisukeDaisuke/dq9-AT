typedef unsigned int u32;
/* Actual dq9_new2 return/writer:020409d0->020409dc. */
__attribute__((export_name("world_movement_init"))) u32 world_movement_init(u32 random){return random%2000+2000;}
/* 0203ccf0->0203cd18, with single-precision intermediate and truncation. */
__attribute__((export_name("world_actor_phase"))) int world_actor_phase(u32 random){volatile float fraction=(float)(random%200)/100.0f;return (int)(fraction*4096.0f);}
/* 0208fbd8->0208fbec. Positive ordered descriptor bounds required. */
__attribute__((export_name("world_pickup_phase"))) int world_pickup_phase(u32 random,int lower,int upper){return lower+(int)random%(upper-lower);}
