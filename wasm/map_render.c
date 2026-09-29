/* DQ9 OBG indexed-tile renderer, based on observed FUN_0203b594.
 * No embedded ROM assets. The host owns a reusable input/output arena.
 */
typedef unsigned char u8;
typedef unsigned int u32;
static u32 rd16(const u8 *p) { return p[0] | ((u32)p[1]<<8); }
static u32 rd32(const u8 *p) { return rd16(p) | (rd16(p+2)<<16); }
__attribute__((export_name("obg_decode")))
int obg_decode(const u8 *src, u32 size, u8 *out, u32 capacity, int transparent_zero) {
 if(size<8 || !src[0] || !src[1] || src[2]>1) return -1;
 const u32 w=(u32)src[0]*8,h=(u32)src[1]*8,count=rd32(src+4);
 const u32 stride=src[2]?64:32,palette=src[2]?512:32;
 if(count>(size-8)/stride || capacity<w*h*4) return -2;
 const u32 tiles=8+palette,map=tiles+count*stride;
 if(map>size || (u32)src[0]*src[1]*2>size-map) return -3;
 for(u32 y=0;y<h;y++) for(u32 x=0;x<w;x++) {
   u32 entry=rd16(src+map+((y/8)*src[0]+x/8)*2),tile=entry&1023;
   u32 px=(entry&1024)?7-(x&7):(x&7),py=(entry&2048)?7-(y&7):(y&7);
   if(tile>=count) return -4;
   u32 index;
   if(src[2])index=src[tiles+tile*stride+py*8+px];
   else {u32 b=src[tiles+tile*stride+py*4+px/2];index=(b>>((px&1)*4))&15;}
   /* OBG owns one palette (16 or 256 colors); VRAM palette bank is relocation state. */
   u32 color=rd16(src+8+index*2),i=(y*w+x)*4;
   out[i]=(u8)((color&31)*255/31);out[i+1]=(u8)(((color>>5)&31)*255/31);out[i+2]=(u8)(((color>>10)&31)*255/31);
   out[i+3]=(transparent_zero && !index)?0:255;
 }
 return (int)(w*h*4);
}
/* Shared indexed tile primitive for Nitro BNCG/BNCL/BNSC map packets. */
__attribute__((export_name("tiles_decode")))
int tiles_decode(const u8 *tiles,u32 tile_size,const u8 *pal,u32 pal_size,const u8 *map,u32 map_size,u32 width_tiles,u32 height_tiles,int bpp,u8 *out,u32 cap) {
 if(!width_tiles||!height_tiles||width_tiles>256||height_tiles>256||(bpp!=4&&bpp!=8))return -1;
 u32 w=width_tiles*8,h=height_tiles*8,stride=bpp==8?64:32;
 if(map_size<width_tiles*height_tiles*2||cap<w*h*4)return -2;
 for(u32 y=0;y<h;y++)for(u32 x=0;x<w;x++){
  u32 e=rd16(map+((y/8)*width_tiles+x/8)*2),t=e&1023,px=e&1024?7-(x&7):x&7,py=e&2048?7-(y&7):y&7;
  if((t+1)*stride>tile_size)return -3;
  u32 index=bpp==8?tiles[t*stride+py*8+px]:(tiles[t*stride+py*4+px/2]>>((px&1)*4))&15;
  u32 ci=index+(bpp==4?(e>>12)*16:0);if(ci*2+2>pal_size)return -4;
  u32 c=rd16(pal+ci*2),i=(y*w+x)*4;
  out[i]=(c&31)*255/31;out[i+1]=((c>>5)&31)*255/31;out[i+2]=((c>>10)&31)*255/31;out[i+3]=index?255:0;
 }
 return w*h*4;
}
__attribute__((export_name("blit")))
void blit(u8 *dst,u32 dw,u32 dh,const u8 *src,u32 sw,u32 sh,int dx,int dy) {
 for(u32 y=0;y<sh;y++){int yy=(int)y+dy;if(yy<0||yy>=(int)dh)continue;
  for(u32 x=0;x<sw;x++){int xx=(int)x+dx;if(xx<0||xx>=(int)dw)continue;
   const u8 *s=src+(y*sw+x)*4;u8 *d=dst+((u32)yy*dw+(u32)xx)*4;
   if(s[3]){d[0]=s[0];d[1]=s[1];d[2]=s[2];d[3]=s[3];}
  }
 }
}
