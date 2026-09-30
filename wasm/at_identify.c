#include <stdint.h>
#define MAX_OBS 32
static uint32_t masks[32768],gapMin[MAX_OBS],gapMax[MAX_OBS],counts[MAX_OBS],samples[16],sampleCount;
static uint32_t prev(uint32_t s){return ((s-12345u)*0x6eb9eb65u)&0x7fffffffu;}
__attribute__((used)) uintptr_t mask_address(void){return (uintptr_t)masks;}
__attribute__((used)) uintptr_t gap_min_address(void){return (uintptr_t)gapMin;}
__attribute__((used)) uintptr_t gap_max_address(void){return (uintptr_t)gapMax;}
__attribute__((used)) uintptr_t counts_address(void){return (uintptr_t)counts;}
__attribute__((used)) uintptr_t samples_address(void){return (uintptr_t)samples;}
#define MAX_LAG 256
static uint32_t memoStamp[MAX_OBS*(MAX_LAG+1)],lagMasks[MAX_LAG+1],epoch,lagState,lagReady;
static uint8_t memoValue[MAX_OBS*(MAX_LAG+1)];
static void resetMemo(void){for(uint32_t i=0;i<MAX_OBS*(MAX_LAG+1);i++)memoStamp[i]=0;}
static void beginState(uint32_t state){epoch=state+1;lagState=state;lagReady=0;lagMasks[0]=masks[state>>16];}
static uint32_t atLag(uint32_t lag){while(lagReady<lag){lagState=prev(lagState);lagMasks[++lagReady]=masks[lagState>>16];}return lagMasks[lag];}
static int possibleLag(int stage,uint32_t lag){
 uint32_t key=(uint32_t)stage*(MAX_LAG+1)+lag;
 if(memoStamp[key]==epoch)return memoValue[key];
 int result=0;
 if(atLag(lag)&(1u<<stage)){
  if(stage==0)result=1;
  else for(uint32_t gap=gapMin[stage-1];gap<=gapMax[stage-1];gap++){if(possibleLag(stage-1,lag+gap)){result=1;break;}}
 }
 memoStamp[key]=epoch;memoValue[key]=(uint8_t)result;return result;
}
static int possible(uint32_t state,int stage){beginState(state);return possibleLag(stage,0);}
static int valid(uint32_t n){if(n<2||n>MAX_OBS)return 0;uint32_t total=0;for(uint32_t i=0;i+1<n;i++){if(gapMin[i]<1||gapMin[i]>gapMax[i]||gapMax[i]>MAX_LAG)return 0;total+=gapMax[i];}return total<=MAX_LAG;}
__attribute__((used)) uint32_t accepts(uint32_t state,uint32_t n){if(!valid(n))return 0xffffffffu;
 resetMemo();return (uint32_t)possible(state&0x7fffffffu,(int)n-1);}
__attribute__((used)) uint32_t search(uint32_t first,uint32_t last,uint32_t n){
 if(!valid(n)||first>last||last>0x7fffffff)return 0xffffffffu;
 resetMemo();
 for(uint32_t i=0;i+1<n;i++)if(gapMin[i]>gapMax[i]||gapMax[i]>1000)return 0;
 for(uint32_t i=0;i<MAX_OBS;i++)counts[i]=0;
 sampleCount=0;
 for(uint32_t state=first;;state++){
  if(masks[state>>16]&(1u<<(n-1))){counts[n-1]++;if(possible(state,(int)n-1)){counts[0]++;if(sampleCount<16)samples[sampleCount++]=state;}}
  if(state==last)break;
 }
 return counts[0];
}
#ifndef __wasm__
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
static double seconds(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec/1e9;}
int main(int argc,char**argv){
 if(argc!=5){fprintf(stderr,"usage: state-search packet.bin first last observations\n");return 2;}
 FILE*f=fopen(argv[1],"rb");if(!f||fread(masks,4,32768,f)!=32768||fread(gapMin,4,MAX_OBS,f)!=MAX_OBS||fread(gapMax,4,MAX_OBS,f)!=MAX_OBS){fprintf(stderr,"invalid packet\n");return 3;}fclose(f);
 uint32_t first=(uint32_t)strtoul(argv[2],0,10),last=(uint32_t)strtoul(argv[3],0,10),n=(uint32_t)strtoul(argv[4],0,10);
 double begin=seconds();uint32_t count=search(first,last,n);double elapsed=seconds()-begin;
 if(count==0xffffffffu){fprintf(stderr,"unsupported search range or event-gap packet\n");return 4;}
 printf("{\"elapsedSeconds\":%.9f,\"candidateClasses\":%u,\"uint32States\":%llu,\"examinedLastClasses\":%u,\"samples\":[",elapsed,count,(unsigned long long)count*2,counts[n-1]);
 for(uint32_t i=0;i<sampleCount;i++){printf("%s%u",i?",":"",samples[i]);}
 puts("]}");return 0;
}
#endif
