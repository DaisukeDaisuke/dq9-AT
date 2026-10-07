#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
static unsigned sum_u32_lanes(v128_t v){
 return (unsigned)wasm_i32x4_extract_lane(v,0)+(unsigned)wasm_i32x4_extract_lane(v,1)+
        (unsigned)wasm_i32x4_extract_lane(v,2)+(unsigned)wasm_i32x4_extract_lane(v,3);
}
static v128_t byte_sum(v128_t v){return wasm_u32x4_extadd_pairwise_u16x8(wasm_u16x8_extadd_pairwise_u8x16(v));}
static v128_t byte_products(v128_t a,v128_t b){return wasm_i32x4_add(
 wasm_u32x4_extadd_pairwise_u16x8(wasm_u16x8_extmul_low_u8x16(a,b)),
 wasm_u32x4_extadd_pairwise_u16x8(wasm_u16x8_extmul_high_u8x16(a,b)));}
#endif
typedef unsigned char u8;
/* Photometric registration of an observed upper frame against the ROM image.
   Opaque reference pixels only; frame masks exclude names/arrows. Coordinates
   are image pixels, not inferred world/walkable coordinates. */
__attribute__((export_name("map_registration"))) int map_registration(
 const u8 *ref,const u8 *alpha,int rw,int rh,const u8 *frame,const u8 *valid,int fw,int fh,
 int xmin,int xmax,int ymin,int ymax,int stride,int sample,int minimum,float *out){
#if defined(__wasm_simd128__)
 /* The input rectangle bound is evaluated in unsigned64 before selection.
    <=66051 byte samples bound every u32 moment by4294966275, and first sums
    by16843005. Positive row/index/range bounds also prevent signed overflow.
    Sample2 or any unproved domain keeps the exact original double loop. */
 const unsigned moment_limit=0xffffffffu/(255u*255u);
 const unsigned long long rp=(unsigned long long)(unsigned)rw*(unsigned)rh;
 const unsigned long long fp=(unsigned long long)(unsigned)fw*(unsigned)fh;
 const int vector_moments=sample==1&&rw>0&&rh>0&&fw>0&&fh>0&&
  rw<=0x3fffffff&&rh<=0x3fffffff&&fw<=0x3fffffff&&fh<=0x3fffffff&&
  rp<=0x7fffffffu&&fp<=0x7fffffffu&&xmin>=-rw&&xmax<=fw&&ymin>=-rh&&ymax<=fh&&
  (rp<=moment_limit||fp<=moment_limit);
#endif
 int k=0;
 for(int dy=ymin;dy<=ymax;dy+=stride)for(int dx=xmin;dx<=xmax;dx+=stride){
  double st=0,sf=0,stt=0,sff=0,stf=0;int n=0;
  int y0=dy<0?-dy:0,y1=rh<fh-dy?rh:fh-dy,x0=dx<0?-dx:0,x1=rw<fw-dx?rw:fw-dx;
#if defined(__wasm_simd128__)
  if(vector_moments){
   const v128_t zero=wasm_i32x4_splat(0),threshold=wasm_i8x16_splat((char)240);
   v128_t ts=zero,fs=zero,tts=zero,ffs=zero,tfs=zero;
   unsigned it=0,iff=0,itt=0,iff2=0,itf=0;
   for(int y=y0;y<y1;y++){
    int x=x0;
    for(;x1-x>=16;x+=16){
     const int a=y*rw+x,b=(y+dy)*fw+x+dx;
     const v128_t mask=wasm_v128_and(wasm_u8x16_ge(wasm_v128_load(alpha+a),threshold),wasm_i8x16_ne(wasm_v128_load(valid+b),zero));
     const v128_t t=wasm_v128_and(wasm_v128_load(ref+a),mask),f=wasm_v128_and(wasm_v128_load(frame+b),mask);
     ts=wasm_i32x4_add(ts,byte_sum(t));fs=wasm_i32x4_add(fs,byte_sum(f));
     tts=wasm_i32x4_add(tts,byte_products(t,t));ffs=wasm_i32x4_add(ffs,byte_products(f,f));tfs=wasm_i32x4_add(tfs,byte_products(t,f));
     n+=__builtin_popcount(wasm_i8x16_bitmask(mask));
    }
    for(;x<x1;x++){int a=y*rw+x,b=(y+dy)*fw+x+dx;if(alpha[a]<240||!valid[b])continue;unsigned t=ref[a],f=frame[b];it+=t;iff+=f;itt+=t*t;iff2+=f*f;itf+=t*f;n++;}
   }
   st=(double)(it+sum_u32_lanes(ts));sf=(double)(iff+sum_u32_lanes(fs));
   stt=(double)(itt+sum_u32_lanes(tts));sff=(double)(iff2+sum_u32_lanes(ffs));stf=(double)(itf+sum_u32_lanes(tfs));
  }else
#endif
  {
  for(int y=y0;y<y1;y+=sample)for(int x=x0;x<x1;x+=sample){int a=y*rw+x,b=(y+dy)*fw+x+dx;if(alpha[a]<240||!valid[b])continue;double t=ref[a],f=frame[b];st+=t;sf+=f;stt+=t*t;sff+=f*f;stf+=t*f;n++;}
  }
  double vt=n*stt-st*st,vf=n*sff-sf*sf,cov=n*stf-st*sf;
  float score=-2;if(n>=minimum&&vt>1&&vf>1)score=(float)(cov/__builtin_sqrt(vt*vf));
  out[k++]=(float)dx;out[k++]=(float)dy;out[k++]=score;out[k++]=(float)n;
 }
 return k/4;
}
