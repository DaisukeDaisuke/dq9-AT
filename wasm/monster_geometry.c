/* Bounded Nitro geometry-command interpreter. Reference: apicula (0BSD),
 * vendor/apicula/src/nds/gpu_cmds.rs and src/primitives/mod.rs.
 * No ROM data is compiled into this module. Unknown commands fail closed. */
#include <stdint.h>
#define API __attribute__((used,visibility("default")))
#define MAX_INPUT (8*1024*1024)
#define MAX_VERTICES 65536
#define MAX_INDICES 262144
static uint8_t input[MAX_INPUT];
/* position(3), uv(2), color(3), normal(3); texels normalized y-down for WebGPU */
static float vertices[MAX_VERTICES*11], current[16], stack[32*16];
static uint32_t indices[MAX_INDICES], nv, ni, err_op, err_offset;
static uint32_t count_op[256];
API uint8_t *monster_input(void){return input;}
API float *monster_vertices(void){return vertices;}
API uint32_t *monster_indices(void){return indices;}
API float *monster_matrix(void){return current;}
API float *monster_stack(void){return stack;}
API uint32_t *monster_commands(void){return count_op;}
API uint32_t monster_vertex_count(void){return nv;}
API uint32_t monster_index_count(void){return ni;}
API uint32_t monster_error_opcode(void){return err_op;}
API uint32_t monster_error_offset(void){return err_offset;}
API void monster_reset(void){nv=ni=err_op=err_offset=0;for(int i=0;i<256;i++)count_op[i]=0;}
static uint32_t u32(const uint8_t*p){return (uint32_t)p[0]|(uint32_t)p[1]<<8|(uint32_t)p[2]<<16|(uint32_t)p[3]<<24;}
static int32_t sx(uint32_t v,int n){return (int32_t)(v<<(32-n))>>(32-n);}
static int tri(uint32_t a,uint32_t b,uint32_t c){if(ni+3>MAX_INDICES)return 3;indices[ni++]=a;indices[ni++]=b;indices[ni++]=c;return 0;}
static int finish(uint32_t start,int mode){uint32_t n=nv-start;int e;
 if(mode==0){if(n%3)return 4;for(uint32_t i=start;i+2<nv;i+=3)if((e=tri(i,i+1,i+2)))return e;}
 else if(mode==1){if(n%4)return 4;for(uint32_t i=start;i+3<nv;i+=4){if((e=tri(i,i+1,i+2)))return e;if((e=tri(i,i+2,i+3)))return e;}}
 else if(mode==2){if(n<3)return 4;for(uint32_t i=start;i+2<nv;i++)if((e=(i-start)%2?tri(i,i+2,i+1):tri(i,i+1,i+2)))return e;}
 else if(mode==3){if(n<4||n%2)return 4;for(uint32_t i=start;i+3<nv;i+=2){if((e=tri(i,i+1,i+3)))return e;if((e=tri(i,i+3,i+2)))return e;}}
 return 0;
}
/* Codes: 1 unsupported opcode, 2 truncated/bounds, 3 budget,
 * 4 invalid primitive sequence, 5 matrix not initialized. */
API int monster_decode(uint32_t length,uint32_t valid_stack,float width,float height,float red,float green,float blue){
 if(length>MAX_INPUT||length%4||width<=0||height<=0)return 2;
 uint32_t p=0,start=nv;int active=0,mode=0;
 float xyz[3]={0,0,0},uv[2]={0,0},color[3]={red,green,blue},normal[3]={0,0,0};
 while(p<length){uint32_t base=p;uint8_t commands[4];for(int j=0;j<4;j++)commands[j]=input[p++];
  for(int j=0;j<4;j++){uint32_t op=commands[j],words=0;err_op=op;err_offset=base+j;count_op[op]++;
   switch(op){case 0:case 0x41:break;case 0x1b:words=3;break;case 0x23:words=2;break;
    case 0x14:case 0x20:case 0x21:case 0x22:case 0x24:case 0x25:case 0x26:case 0x27:case 0x28:case 0x40:words=1;break;default:return 1;}
   if(p+words*4>length)return 2;uint32_t a=words?u32(input+p):0,b=words>1?u32(input+p+4):0;int e=0,isvertex=0;
   switch(op){
    case 0:break;
    case 0x14:{int slot=a&31;if(!(valid_stack&(1u<<slot)))return 5;for(int k=0;k<16;k++)current[k]=stack[slot*16+k];break;}
    case 0x1b:for(int c=0;c<3;c++){float s=(int32_t)u32(input+p+c*4)/4096.0f;for(int r=0;r<4;r++)current[c*4+r]*=s;}break;
    case 0x40:if(active)return 4;active=1;mode=a&3;start=nv;break;
    case 0x41:if(!active)return 4;e=finish(start,mode);if(e)return e;active=0;break;
    case 0x20:for(int k=0;k<3;k++){color[k]=((a>>(5*k))&31)/31.0f;normal[k]=0;}break;
    case 0x21:{float n[3];for(int k=0;k<3;k++)n[k]=sx(a>>(10*k),10)/512.0f;for(int r=0;r<3;r++){normal[r]=current[r]*n[0]+current[4+r]*n[1]+current[8+r]*n[2];color[r]=1;}break;}
    case 0x22:uv[0]=sx(a,16)/16.0f/width;uv[1]=sx(a>>16,16)/16.0f/height;break;
    case 0x23:xyz[0]=sx(a,16)/4096.0f;xyz[1]=sx(a>>16,16)/4096.0f;xyz[2]=sx(b,16)/4096.0f;isvertex=1;break;
    case 0x24:for(int k=0;k<3;k++)xyz[k]=sx(a>>(10*k),10)/64.0f;isvertex=1;break;
    case 0x25:xyz[0]=sx(a,16)/4096.0f;xyz[1]=sx(a>>16,16)/4096.0f;isvertex=1;break;
    case 0x26:xyz[0]=sx(a,16)/4096.0f;xyz[2]=sx(a>>16,16)/4096.0f;isvertex=1;break;
    case 0x27:xyz[1]=sx(a,16)/4096.0f;xyz[2]=sx(a>>16,16)/4096.0f;isvertex=1;break;
    case 0x28:for(int k=0;k<3;k++)xyz[k]+=sx(a>>(10*k),10)/4096.0f;isvertex=1;break;
   }
   if(isvertex){if(!active)return 4;if(nv>=MAX_VERTICES)return 3;float*v=vertices+nv++*11;
    for(int r=0;r<3;r++)v[r]=current[r]*xyz[0]+current[4+r]*xyz[1]+current[8+r]*xyz[2]+current[12+r];
    v[3]=uv[0];v[4]=uv[1];for(int r=0;r<3;r++){v[5+r]=color[r];v[8+r]=normal[r];}}
   p+=words*4;
  }
 }
 if(active){int e=finish(start,mode);if(e)return e;}err_op=err_offset=0;return 0;
}
