/* Scratch prototype: exact positive finite-gap mask chains in LCG cycle order.
 * Inputs/bit packing intentionally match the existing reviewed at_identify kernel.
 * This is an event-state filter, not a world simulator or current-video estimator. */
#include <stdint.h>
#define MAX_OBS 32
#define RING 512
#define CHUNK 1000000
static uint32_t masks[32768],gapMin[32],gapMax[32];
static uint32_t history[RING],groupMin[31],groupMax[31],groupBits[31];
static uint32_t ng,nobs,state,cursor,ready,samples[16],sampleIndices[16],sampleCount;
static uint64_t processed,matches;
static uint8_t output[(CHUNK+7)/8];
__attribute__((used)) uintptr_t mask_address(void){return (uintptr_t)masks;}
__attribute__((used)) uintptr_t gap_min_address(void){return (uintptr_t)gapMin;}
__attribute__((used)) uintptr_t gap_max_address(void){return (uintptr_t)gapMax;}
__attribute__((used)) uintptr_t output_address(void){return (uintptr_t)output;}
__attribute__((used)) uintptr_t samples_address(void){return (uintptr_t)samples;}
__attribute__((used)) uintptr_t sample_indices_address(void){return (uintptr_t)sampleIndices;}
__attribute__((used)) uint64_t total_processed(void){return processed;}
__attribute__((used)) uint64_t total_matches(void){return matches;}
__attribute__((used)) uint32_t sample_count(void){return sampleCount;}
static uint32_t previous(uint32_t s){return ((s-12345u)*0x6eb9eb65u)&0x7fffffffu;}
static uint32_t tick(void){
 uint32_t reachable=1u;
 for(uint32_t g=0;g<ng;g++){
  uint32_t prior=0u;
  for(uint32_t lag=groupMin[g];lag<=groupMax[g];lag++)prior|=history[(cursor-lag)&(RING-1)];
  reachable|=(prior<<1)&groupBits[g];
 }
 reachable&=masks[state>>16];history[cursor&(RING-1)]=reachable;cursor++;
 return (reachable>>(nobs-1))&1u;
}
__attribute__((used)) uint32_t begin(uint32_t n,uint32_t first,uint32_t warmup){
 ready=0;ng=0;processed=matches=0;sampleCount=0;
 if(n<2||n>32||first>0x7fffffffu)return 0;
 uint32_t total=0;
 for(uint32_t i=0;i+1<n;i++){
  if(gapMin[i]<1||gapMin[i]>gapMax[i]||gapMax[i]>256)return 0;
  total+=gapMax[i];if(total>256)return 0;
  uint32_t g=0;for(;g<ng;g++)if(groupMin[g]==gapMin[i]&&groupMax[g]==gapMax[i])break;
  if(g==ng){groupMin[g]=gapMin[i];groupMax[g]=gapMax[i];groupBits[g]=0;ng++;}
  groupBits[g]|=1u<<(i+1);
 }
 if(warmup>total)return 0;
 for(uint32_t i=0;i<RING;i++)history[i]=0;
 nobs=n;state=first;for(uint32_t i=0;i<warmup;i++)state=previous(state);
 cursor=0;for(uint32_t i=0;i<warmup;i++){tick();state=(state*0x41c64e6du+12345u)&0x7fffffffu;}
 ready=1;return 1;
}
__attribute__((used)) uint32_t scan_chunk(uint32_t count){
 if(!ready||count>CHUNK||processed+(uint64_t)count>2147483648ULL)return 0xffffffffu;
 for(uint32_t i=0;i<(count+7)/8;i++)output[i]=0;
 uint32_t found=0;
 for(uint32_t i=0;i<count;i++){
  if(tick()){
   output[i>>3]|=(uint8_t)(1u<<(i&7));found++;
   if(sampleCount<16){samples[sampleCount]=state;sampleIndices[sampleCount++]=(uint32_t)(processed+i);}
  }
  state=(state*0x41c64e6du+12345u)&0x7fffffffu;
 }
 processed+=count;matches+=found;return found;
}
#ifndef __wasm__
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
static double seconds(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec/1e9;}
static int canonical_decimal(const char *s,uint64_t limit,uint64_t *out){
 if(!s[0]||(s[0]=='0'&&s[1]))return 0;
 uint64_t value=0;
 for(uint32_t i=0;s[i];i++){
  if(s[i]<'0'||s[i]>'9')return 0;
  uint64_t digit=(uint64_t)(s[i]-'0');
  if(value>limit/10||(value==limit/10&&digit>limit%10))return 0;
  value=value*10+digit;
 }
 *out=value;return 1;
}
int main(int argc,char **argv){
 if(argc!=7){fprintf(stderr,"usage: stream-mask packet n first-class count warmup output-bits\n");return 2;}
 uint64_t n64,first64,count,warmup64;
 if(!canonical_decimal(argv[2],32,&n64)||!canonical_decimal(argv[3],0x7fffffffU,&first64)||!canonical_decimal(argv[4],2147483648ULL,&count)||!canonical_decimal(argv[5],256,&warmup64)){
  fprintf(stderr,"numeric arguments must be canonical decimals within their declared ranges\n");return 4;
 }
 uint32_t n=(uint32_t)n64,first=(uint32_t)first64,warmup=(uint32_t)warmup64;
 FILE *f=fopen(argv[1],"rb");if(!f||fread(masks,4,32768,f)!=32768||fread(gapMin,4,32,f)!=32||fread(gapMax,4,32,f)!=32){fprintf(stderr,"invalid packet\n");return 3;}fclose(f);
 if(!begin(n,first,warmup))return 4;
 FILE *out=fopen(argv[6],"wb");if(!out)return 5;double start=seconds();
 while(processed<count){uint32_t chunk=count-processed>CHUNK?CHUNK:(uint32_t)(count-processed);if(scan_chunk(chunk)==0xffffffffu)return 6;if(fwrite(output,1,(chunk+7)/8,out)!=(chunk+7)/8)return 7;}
 fclose(out);double elapsed=seconds()-start;
 printf("{\"processed\":%llu,\"matches\":%llu,\"elapsedSeconds\":%.9f,\"samples\":[",(unsigned long long)processed,(unsigned long long)matches,elapsed);
 for(uint32_t i=0;i<sampleCount;i++){printf("%s{\"class\":%u,\"index\":%u}",i?",":"",samples[i],sampleIndices[i]);}puts("]}");return 0;
}
#endif
