// Minimal libretro frontend for the browser: Genesis Plus GX -> 2D canvas, WebAudio, touch/keyboard pad.
#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <emscripten.h>
#include "libretro.h"
static uint32_t fb[320*240]; static int fbw=320, fbh=224; static unsigned pixfmt=0;
static int16_t abuf[8192*2]; static int alen=0; static unsigned pad=0;
static bool env(unsigned cmd, void* data){
  switch(cmd){
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY: case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char**)data="/"; return true;
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: pixfmt=*(unsigned*)data; return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool*)data=true; return true;
    default: return false;
  }
}
static void video(const void* data, unsigned w, unsigned h, size_t pitch){
  if(!data) return; if(w>320) w=320; if(h>240) h=240; fbw=w; fbh=h;
  for(unsigned y=0;y<h;y++){
    const uint8_t* row=(const uint8_t*)data+y*pitch; uint32_t* o=fb+y*w;
    if(pixfmt==RETRO_PIXEL_FORMAT_XRGB8888){ const uint32_t* s=(const uint32_t*)row; for(unsigned x=0;x<w;x++){uint32_t p=s[x]; o[x]=0xFF000000|((p&0xFF)<<16)|(p&0xFF00)|((p>>16)&0xFF);} }
    else { const uint16_t* s=(const uint16_t*)row; for(unsigned x=0;x<w;x++){uint16_t p=s[x]; unsigned r,g,b;
      if(pixfmt==RETRO_PIXEL_FORMAT_RGB565){r=(p>>11)&31;g=(p>>5)&63;b=p&31; g=(g<<2)|(g>>4);} else {r=(p>>10)&31;g=(p>>5)&31;b=p&31; g=(g<<3)|(g>>2);}
      r=(r<<3)|(r>>2); b=(b<<3)|(b>>2); o[x]=0xFF000000|(b<<16)|(g<<8)|r; } }
  }
}
static void asample(int16_t l,int16_t r){ if(alen<8192){abuf[alen*2]=l;abuf[alen*2+1]=r;alen++;} }
static size_t abatch(const int16_t* d,size_t n){ size_t k=n; if(alen+k>8192) k=8192-alen; memcpy(abuf+alen*2,d,k*4); alen+=k; return n; }
static void poll(void){}
static int16_t state(unsigned port,unsigned dev,unsigned idx,unsigned id){
  if(port||dev!=RETRO_DEVICE_JOYPAD) return 0;
  if(id==RETRO_DEVICE_ID_JOYPAD_MASK) return pad;
  return (pad>>id)&1;
}
EMSCRIPTEN_KEEPALIVE int gx_init(const char* path){
  retro_set_environment(env); retro_set_video_refresh(video); retro_set_audio_sample(asample);
  retro_set_audio_sample_batch(abatch); retro_set_input_poll(poll); retro_set_input_state(state);
  retro_init(); struct retro_game_info gi={path,NULL,0,NULL};
  FILE* f=fopen(path,"rb"); static uint8_t* rom; long sz=0; if(f){fseek(f,0,SEEK_END);sz=ftell(f);fseek(f,0,SEEK_SET);rom=malloc(sz);fread(rom,1,sz,f);fclose(f);gi.data=rom;gi.size=sz;}
  if(!retro_load_game(&gi)) return 0;
  retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
  struct retro_system_av_info av; retro_get_system_av_info(&av); return (int)av.timing.sample_rate;
}
EMSCRIPTEN_KEEPALIVE void gx_frame(void){ retro_run(); }
EMSCRIPTEN_KEEPALIVE void gx_pad(unsigned m){ pad=m; }
EMSCRIPTEN_KEEPALIVE uint32_t* gx_fb(void){ return fb; }
EMSCRIPTEN_KEEPALIVE int gx_w(void){ return fbw; }
EMSCRIPTEN_KEEPALIVE int gx_h(void){ return fbh; }
EMSCRIPTEN_KEEPALIVE int16_t* gx_audio(void){ return abuf; }
EMSCRIPTEN_KEEPALIVE int gx_alen(void){ int n=alen; alen=0; return n; }
EMSCRIPTEN_KEEPALIVE void gx_reset(void){ retro_reset(); }
