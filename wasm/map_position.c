typedef unsigned char u8;
/* Photometric registration of an observed upper frame against the ROM image.
   Opaque reference pixels only; frame masks exclude names/arrows. Coordinates
   are image pixels, not inferred world/walkable coordinates. */
__attribute__((export_name("map_registration"))) int map_registration(
 const u8 *ref,const u8 *alpha,int rw,int rh,const u8 *frame,const u8 *valid,int fw,int fh,
 int xmin,int xmax,int ymin,int ymax,int stride,int sample,int minimum,float *out){
 int k=0;
 for(int dy=ymin;dy<=ymax;dy+=stride)for(int dx=xmin;dx<=xmax;dx+=stride){
  double st=0,sf=0,stt=0,sff=0,stf=0;int n=0;
  int y0=dy<0?-dy:0,y1=rh<fh-dy?rh:fh-dy,x0=dx<0?-dx:0,x1=rw<fw-dx?rw:fw-dx;
  for(int y=y0;y<y1;y+=sample)for(int x=x0;x<x1;x+=sample){int a=y*rw+x,b=(y+dy)*fw+x+dx;if(alpha[a]<240||!valid[b])continue;double t=ref[a],f=frame[b];st+=t;sf+=f;stt+=t*t;sff+=f*f;stf+=t*f;n++;}
  double vt=n*stt-st*st,vf=n*sff-sf*sf,cov=n*stf-st*sf;
  float score=-2;if(n>=minimum&&vt>1&&vf>1)score=(float)(cov/__builtin_sqrt(vt*vf));
  out[k++]=(float)dx;out[k++]=(float)dy;out[k++]=score;out[k++]=(float)n;
 }
 return k/4;
}
