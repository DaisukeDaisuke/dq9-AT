/* Source-derived movement and terrain arithmetic, NOT a whole-world/FSM
 * emulator. ROM resources are supplied at runtime; no fitted trajectories.
 * All ARM low-word arithmetic is explicit unsigned arithmetic; no fast-math. */
#include <stdint.h>
#define API(name) __attribute__((export_name(name)))
static uint32_t input_words[24],output_words[24];
static int16_t trig_words[8192];
static int16_t atan_words[129];
API("monster_motion_input") uint32_t *mm_input(void){return input_words;}
API("monster_motion_output") uint32_t *mm_output(void){return output_words;}
API("monster_motion_trig") int16_t *mm_trig(void){return trig_words;}
API("monster_motion_atan_table") int16_t *mm_atan_table(void){return atan_words;}
static int32_t signed32(uint32_t x){return x<=0x7fffffffU?(int32_t)x:(int32_t)((int64_t)x-4294967296LL);}
static int32_t signed16(uint32_t x){x&=65535U;return x<32768U?(int32_t)x:(int32_t)x-65536;}
static int32_t add32(int32_t a,int32_t b){return signed32((uint32_t)a+(uint32_t)b);}
static int32_t sub32(int32_t a,int32_t b){return signed32((uint32_t)a-(uint32_t)b);}
static int32_t mul32(int32_t a,int32_t b){return signed32((uint32_t)a*(uint32_t)b);}
static int32_t fixed_mul(int32_t a,int32_t b){int64_t q=(int64_t)a*b+2048;return signed32((uint32_t)((uint64_t)q>>12));}
/* signed32 *2^32 fits int64; callers exclude zero and INT_MIN/-1 division. */
static int32_t fixed_div(int32_t a,int32_t b){int64_t q=((int64_t)a*4294967296LL)/b+524288;return signed32((uint32_t)((uint64_t)q>>20));}
static int32_t angle_diff(int32_t a,int32_t b){int32_t d=sub32(b,a);if(a<b){if(d>12868)d=sub32(d,25736);}else if(d< -12868)d=add32(d,25736);return d;}
static int32_t wrap_angle(int32_t a){
 if(a<0){int32_t q=fixed_div(sub32(0,a),25736);q=signed32(((uint32_t)q+4096U)&0xfffff000U);return add32(a,fixed_mul(25736,q));}
 if(a>25736){int32_t q=signed32((uint32_t)fixed_div(a,25736)&0xfffff000U);return sub32(a,fixed_mul(25736,q));}return a;
}
static uint32_t trig_index(int32_t angle){int32_t shifted=signed32((uint32_t)angle<<16);int32_t q=shifted/25736;return (((uint32_t)q&65535U)>>4)*2U;}
static uint64_t integer_sqrt(uint64_t n){uint64_t result=0,bit=1ULL<<62;while(bit>n)bit>>=2;while(bit){if(n>=result+bit){n-=result+bit;result=(result>>1)+bit;}else result>>=1;bit>>=2;}return result;}
static int32_t atan_xz(int32_t x,int32_t z){
 if(x==0)return z<0?12868:0;
 if(z==0)return x<0?-6434:6434;
 int32_t ax=x<0?-x:x,az=z<0?-z:z;
 int32_t small=ax<az?ax:az,large=ax<az?az:ax,index=fixed_div(small,large)>>5;
 int32_t angle=atan_words[index];if(ax>az)angle=6434-angle;if(z<0)angle=12868-angle;if(x<0)angle=-angle;return signed16((uint32_t)angle);
}
/* 02078118 no-path steering uses flattened CURRENT Y=0, but full targetY.
 * This numeric leaf does not decide the state transition/terrain query. Input
 * words0..2=currentXYZ,3..5=targetXYZ. Output0..2=normalized delta,3=target angle,
 * 4=full steering distance,5=XZ arrival distance. */
API("monster_motion_state2_steer") int mm_state2_steer(uint32_t flatten_current_y){
 if(flatten_current_y>1U)return 0;
 int32_t v[3]={sub32(signed32(input_words[3]),signed32(input_words[0])),sub32(signed32(input_words[4]),flatten_current_y?0:signed32(input_words[1])),sub32(signed32(input_words[5]),signed32(input_words[2]))};
 uint64_t sum=0,xz=0;for(uint32_t i=0;i<3;i++){uint64_t q=(uint64_t)((int64_t)v[i]*v[i]);sum+=q;if(i!=1)xz+=q;}
 if(sum==0||sum>=(1ULL<<60))return 0;
 uint64_t factor=((1ULL<<56)/sum)*integer_sqrt(sum*4U);
 for(uint32_t i=0;i<3;i++){uint64_t product=factor*(uint64_t)(int64_t)v[i];int32_t high=signed32((uint32_t)(product>>32)+4096U);int32_t normalized=high/8192;if(high<0&&high%8192)normalized--;output_words[i]=(uint32_t)normalized;}
 int32_t angle=atan_xz(signed32(output_words[0]),signed32(output_words[2]));
 output_words[3]=(uint32_t)(angle<0?angle+25736:angle);
 output_words[4]=(uint32_t)((integer_sqrt(sum*4U)+1U)>>1);
 output_words[5]=(uint32_t)((integer_sqrt(xz*4U)+1U)>>1);
 return 1;
}
/* words: XYZ,actualAngle,targetAngle,turnRate,speed,targetSpeed,acceleration,
 * movementByte,header,e0,c1,c2,c4,gravity,vertical124,vertical128,counter12c.
 * phase and scaledDelta are pre-invocation clock facts, never post-state input.
 * Return1 only for this bounded prefix; 0 means unsupported dependencies. */
API("monster_motion_prefix") int mm_prefix(uint32_t phase,uint32_t scaled_delta){
 uint32_t *s=input_words,*o=output_words;for(uint32_t i=0;i<24;i++)o[i]=s[i];
 int32_t angle=signed32(s[3]),target=signed16(s[4]),turn=signed16(s[5]);
 /* This first contract excludes angle-completion animation callbacks, special
  * motion modes and vertical impulses. The caller must keep them unresolved. */
 if((s[11]&4U)||(s[14]&32768U)||s[9]>1U||s[16]!=0U||s[17]!=0U||s[18]!=0U||angle<0||angle>25736||target<0||target>25736||turn<0||phase>65535U)return 0;
 int32_t diff=angle_diff(angle,target),rate=mul32(turn,signed32(phase));
 if(rate<0)return 0;
 if(diff>0)angle=diff<rate?target:add32(angle,rate);
 else if(diff<0)angle=sub32(0,diff)<rate?target:sub32(angle,rate);
 angle=wrap_angle(angle);o[3]=(uint32_t)angle;
 /* 02032fc4's three gates. Orientation has already been updated. */
 if((s[11]&1U)||(s[13]&32U)||(s[12]&4U))return 1;
 uint32_t delay=s[14]&32767U;delay=scaled_delta<delay?delay-scaled_delta:0;o[14]=delay;
 int32_t old_speed=signed16(s[6]),goal=signed16(s[7]),accel=signed16(s[8]);
 if(old_speed<0||goal<0||accel<0)return 0;
 int32_t increment=mul32(accel,signed32(phase)),next_speed;
 if(s[9]==1U){if(old_speed<goal)next_speed=add32(old_speed,increment);else next_speed=sub32(old_speed,goal)<increment?goal:sub32(old_speed,increment);}
 else next_speed=old_speed>0?sub32(old_speed,increment):0;
 o[6]=(uint32_t)signed16((uint32_t)next_speed);
 int32_t speed=delay?0:old_speed;
 if(speed>0){int32_t d=angle_diff(angle,target);if(d<0)d=sub32(0,d);int32_t cap=fixed_mul(goal,sub32(4096,fixed_div(d,12868)));if(cap<speed)speed=cap;
  int32_t direction=(s[10]&256U)?target:angle,step=mul32(speed,signed32(phase));uint32_t index=trig_index(direction);
  o[0]=(uint32_t)add32(signed32(s[0]),fixed_mul(trig_words[index],step));
  o[2]=(uint32_t)add32(signed32(s[2]),fixed_mul(trig_words[index+1],step));
 }
 /* 020331cc makes the NEGATIVE comparison bound;020331dc MOVLT reloads
  * POSITIVE0x32000. Exact source behavior, not covered by the moving fixture. */
 int32_t y=sub32(signed32(s[1]),signed16(s[15]));if(y< -0x32000)y=0x32000;o[1]=(uint32_t)y;
 return 1;
}

/* Bounded non-tiled, zero-transform COL2 query. Header words: queryXYZ(3),
 * shift, columns, rows, cellSize, triangleCount, cellCount, indexCount,
 * minXYZ(3),maxXYZ(3), followed by triangles(19 words each:12s16,6bounds,flags),
 * counts[cellCount],starts[cellCount],indices[indexCount]. No selected cells,
 * triangles or output height are supplied. Capacity limits suspend, not prune. */
static int32_t terrain_words[131072],terrain_output[256];
API("monster_terrain_input") int32_t *mm_terrain_input(void){return terrain_words;}
API("monster_terrain_output") int32_t *mm_terrain_output(void){return terrain_output;}
static int64_t arshift64(int64_t x,unsigned n){uint64_t u=(uint64_t)x>>n;if(x<0)u|=(~0ULL)<<(64-n);return (int64_t)u;}
static int32_t dot3(const int32_t*a,const int32_t*b){uint64_t u=2048;for(int i=0;i<3;i++)u+=(uint64_t)((int64_t)a[i]*b[i]);return signed32((uint32_t)(u>>12));}
static void cross3(const int32_t*a,const int32_t*b,int32_t*c){for(int i=0;i<3;i++){uint64_t u=(uint64_t)((int64_t)a[(i+1)%3]*b[(i+2)%3])-(uint64_t)((int64_t)a[(i+2)%3]*b[(i+1)%3])+2048;c[i]=signed32((uint32_t)(u>>12));}}
static void sub3(const int32_t*a,const int32_t*b,int32_t*c){for(int i=0;i<3;i++)c[i]=sub32(a[i],b[i]);}
static int bbox_overlap(const int32_t*a,const int32_t*b){for(int i=0;i<3;i++)if(a[i]<b[i+3]||a[i+3]>b[i])return 0;return 1;}
static int div_checked(int32_t a,int32_t b,int32_t*out){if(!b||(a==(-2147483647-1)&&b==-1))return 0;*out=fixed_div(a,b);return 1;}
static int terrain_query_shape(uint32_t words,int32_t radius,int32_t upper,int32_t ray_upper,int32_t ray_y){
 int32_t*s=terrain_words,*o=terrain_output;for(int i=0;i<256;i++)o[i]=0;
 if(words<16||words>131072)return 0;
 int sh=s[3],w=s[4],rows=s[5],size=s[6],nt=s[7],nc=s[8],ni=s[9];
 if(sh<0||sh>16||w<=0||rows<=0||size<=0||nt<0||nt>65535||nc<=0||nc>65536||ni<0||nc!=(int64_t)w*rows+rows/2)return 0;
 if(16ULL+(uint64_t)nt*19+(uint64_t)nc*2+(uint64_t)ni!=words)return 0;
 int32_t*tri=s+16,*counts=tri+nt*19,*starts=counts+nc,*ids=starts+nc;
 int32_t q[6],bounds[6];const int off[6]={radius,upper,radius,-radius,-40960,-radius};
 for(int i=0;i<6;i++){q[i]=add32(s[i%3],off[i]);bounds[i]=mul32(s[10+(i<3?3:0)+i%3],1<<sh);}
 o[0]=ray_y;o[1]=-1;
 if(!bbox_overlap(q,bounds))return 1;
 if(sh)for(int i=0;i<6;i++)q[i]=(int32_t)arshift64(q[i],sh);
 int cells[7],ncell=0;
 if(nc<=7){for(int i=0;i<nc;i++)cells[ncell++]=i;}
 else{
  int32_t cyq,cxq;int32_t midz=add32(q[2],q[5])/2,midx=add32(q[0],q[3])/2; /* native wrapped ADD then signed truncation */
  if(!div_checked(sub32(midz,s[12]),size,&cyq))return 0;
  int cy=(int)((float)cyq/4096.0f);
  if(cy>=0&&cy<rows){if(!div_checked(add32(sub32(midx,s[10]),(cy&1)?size/2:0),size,&cxq))return 0;int cx=(int)((float)cxq/4096.0f);
   if(cx>=0&&cx<w+(cy&1)){int c=cy*w+cx+cy/2;cells[ncell++]=c;
    if(cy&1){if(cy>0){if(cx>0)cells[ncell++]=c-w-1;if(cx<w)cells[ncell++]=c-w;}if(cy<rows-1){if(cx>0)cells[ncell++]=c+w;if(cx<w)cells[ncell++]=c+w+1;}}
    else{if(cy>0){cells[ncell++]=c-w;cells[ncell++]=c-w-1;}if(cy<rows-1){cells[ncell++]=c+w;cells[ncell++]=c+w+1;}}
    if(cx>0)cells[ncell++]=c-1;if(cx<w-((cy&1)?0:1))cells[ncell++]=c+1;
   }
  }
 }
 o[2]=ncell;for(int i=0;i<ncell;i++)o[8+i]=cells[i];
 int visited[192],nv=0,selected[96],ns=0;
 for(int c=0;c<ncell;c++){int cell=cells[c];if(cell<0||cell>=nc||counts[cell]<0||counts[cell]>255||starts[cell]<0||(int64_t)starts[cell]+counts[cell]>ni)return 0;
  for(int k=0;k<counts[cell];k++){int id=ids[starts[cell]+k];if(id<0||id>=nt)return 0;int seen=0;for(int j=0;j<nv;j++)if(visited[j]==id)seen=1;if(seen)continue;
   // Saturation branches are deliberately unresolved until separately validated.
   if(nv>=191||ns>=95)return 0;visited[nv++]=id;int32_t*t=tri+id*19;if(t[18]&1)return 0;
   int32_t b[6];for(int j=0;j<6;j++){int at=t[12+(j<3?j+3:j-3)];if(at<0||at>8)return 0;b[j]=t[at];}
   if(bbox_overlap(b,q))selected[ns++]=id;
  }
 }
 o[3]=ns;o[4]=nv;for(int i=0;i<ns;i++)o[16+i]=selected[i];
 int32_t top[3]={s[0],add32(ray_y,ray_upper),s[2]},bottom[3]={s[0],sub32(ray_y,40960),s[2]},bestY=0;int best=-1;
 for(int j=0;j<ns;j++){int32_t*t=tri+selected[j]*19;if(t[10]<=2048)continue;int32_t a[3],b[3],c[3],ab[3],ac[3],ray[3],n[3],at[3],rc[3];for(int k=0;k<3;k++){a[k]=mul32(t[k],1<<sh);b[k]=mul32(t[3+k],1<<sh);c[k]=mul32(t[6+k],1<<sh);}sub3(b,a,ab);sub3(c,a,ac);sub3(top,bottom,ray);cross3(ab,ac,n);int32_t den=dot3(ray,n);if(den<1)continue;sub3(top,a,at);int32_t time=dot3(at,n);if(time<0||den<time)continue;cross3(ray,at,rc);int32_t wb=dot3(ac,rc),wc=sub32(0,dot3(ab,rc));if(wb<0||den<wb||wc<0||den<add32(wb,wc))continue;int32_t inv;if(!div_checked(4096,den,&inv))return 0;wb=fixed_mul(wb,inv);wc=fixed_mul(wc,inv);int32_t wa=sub32(sub32(4096,wb),wc),rank=add32(add32(fixed_mul(a[1],wa),fixed_mul(b[1],wb)),fixed_mul(c[1],wc));if(best<0||rank>bestY){best=j;bestY=rank;}}
 if(best>=0){int32_t*t=tri+selected[best]*19,a[3],b[3],c[3],ab[3],ac[3],n[3],delta[3];for(int k=0;k<3;k++){a[k]=mul32(t[k],1<<sh);b[k]=mul32(t[3+k],1<<sh);c[k]=mul32(t[6+k],1<<sh);}sub3(b,a,ab);sub3(c,a,ac);cross3(ab,ac,n);sub3(bottom,top,delta);int32_t time;if(!div_checked(sub32(dot3(n,a),dot3(n,top)),dot3(n,delta),&time))return 0;if(time>=0&&time<=4096){o[0]=add32(add32(top[1],fixed_mul(delta[1],time)),409);o[1]=best;o[5]=time;o[6]=selected[best];}}
 return 1;
}

API("monster_terrain_query") int mm_terrain_query(uint32_t words){return terrain_query_shape(words,2048,4096,4096,terrain_words[1]);}
/* Walking collection is frozen at inputXYZ, but prior objects may change rayY. */
API("monster_walking_terrain_query") int mm_walking_query(uint32_t words,uint32_t width,uint32_t height,int32_t ray_y){
 if(width==0||width>0x7fffffffU||height==0||height>0x7fffffffU)return 0;
 return terrain_query_shape(words,(int32_t)width/2,(int32_t)height,6144,ray_y);
}
/* Dynamic-anchor exclusion: each squared X/Z term rounds independently. */
API("monster_walking_anchor_test") int mm_walking_anchor(void){
 int32_t dx=sub32(signed32(input_words[0]),signed32(input_words[3]));
 int32_t dy=sub32(signed32(input_words[1]),signed32(input_words[4]));
 int32_t dz=sub32(signed32(input_words[2]),signed32(input_words[5]));
 int32_t ay=dy<0?sub32(0,dy):dy,square=add32(fixed_mul(dx,dx),fixed_mul(dz,dz));
 output_words[0]=(uint32_t)dx;output_words[1]=(uint32_t)dy;output_words[2]=(uint32_t)dz;
 output_words[3]=(uint32_t)ay;output_words[4]=(uint32_t)square;
 output_words[5]=(ay<=4096&&square<=4096)?1U:0U;return 1;
}
