import struct
def lumps(path):
    d=open(path,'rb').read()
    n,off=struct.unpack('<ii',d[4:12])
    return d,[(struct.unpack('<ii8s',d[off+16*i:off+16*i+16])) for i in range(n)]
def maps(path):
    d,L=lumps(path); out={}
    L=[(n.rstrip(b'\0').decode(),o,s) for o,s,n in L]
    for i,(n,o,s) in enumerate(L):
        if n.startswith('MAP') and len(n)==5:
            out[n]={L[i+j][0]:d[L[i+j][1]:L[i+j][1]+L[i+j][2]] for j in range(1,11)}
    return out
def lump(path,name):
    d,L=lumps(path)
    for o,s,n in L:
        if n.rstrip(b'\0').decode()==name: return d[o:o+s]
