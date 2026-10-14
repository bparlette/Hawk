#include <stdlib.h>
void *Z_Malloc(int s,int t,void*u){return malloc(s);} void Z_Free(void*p){free(p);}
#include <stdio.h>
#include <stdlib.h>
#include "memio.h"
#include "mus2mid.h"
int main(int c, char **v){ FILE*f=fopen(v[1],"rb"); fseek(f,0,2); long n=ftell(f); rewind(f); unsigned char*b=malloc(n); fread(b,1,n,f); fclose(f);
 MEMFILE*in=mem_fopen_read(b,n), *out=mem_fopen_write(); if(mus2mid(in,out)){printf("fail\n");return 1;}
 void*buf; size_t len; mem_get_buf(out,&buf,&len); f=fopen(v[2],"wb"); fwrite(buf,1,len,f); fclose(f); return 0;}
