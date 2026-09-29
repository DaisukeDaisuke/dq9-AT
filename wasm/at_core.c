/* AT acceleration; specification reused from rand.js ARand and actual ROM.
 * uint32 overflow implements modulo2^32. No seed estimation or setter path.
 */
typedef unsigned int u32;
typedef unsigned long long u64;
__attribute__((export_name("at_next"))) u32 at_next(u32 seed){return seed*0x41c64e6du+0x3039u;}
__attribute__((export_name("at_advance"))) u32 at_advance(u32 seed,u64 count){
 u32 mul=0x41c64e6du,add=0x3039u,am=1,ac=0;
 while(count){if(count&1){ac=ac*mul+add;am=am*mul;}add=add*(mul+1);mul=mul*mul;count>>=1;}
 return seed*am+ac;
}
__attribute__((export_name("at_randint"))) int at_randint(u32 random,u32 max){
 return (int)((double)max*(((double)random-1.0)/32767.0));
}
__attribute__((export_name("at_generate"))) u32 at_generate(u32 seed,u32 count,u32 *pairs){
 for(u32 i=0;i<count;i++){seed=at_next(seed);pairs[2*i]=seed;pairs[2*i+1]=(seed>>16)&0x7fff;}
 return seed;
}
__attribute__((export_name("at_match_interval"))) u32 at_match_interval(u32 seed,u32 count,u32 max,int lo,int hi,u32 *offsets){
 u32 found=0;
 for(u32 i=0;i<count;i++){seed=at_next(seed);int n=at_randint((seed>>16)&0x7fff,max);if(n>=lo&&n<=hi)offsets[found++]=i+1;}
 return found;
}
