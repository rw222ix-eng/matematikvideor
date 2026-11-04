#!/usr/bin/env python3
# Kontaktark i visad storlek: python3 ark.py <lagermapp> <lage> <bredd> <antal per rad> <rutor per ark> <ut-prefix>
import json,sys,math
from PIL import Image,ImageDraw
Image.MAX_IMAGE_PIXELS=None
M,lage,B,N,P,UT=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]),sys.argv[6]
mat=json.load(open(f'{M}/matt-{lage}.json'));H=Image.open(f'{M}/{lage}-hel.png').convert('RGB')
for s in range(0,len(mat),P):
    del_=mat[s:s+P];bilder=[]
    for m in del_:
        v=m['v'];c=H.crop((m['x'],m['y'],m['x']+int(v[2]),m['y']+int(v[3])));h=round(B*v[3]/v[2]);bilder.append((m['id'],c.resize((B,h),Image.LANCZOS)))
    rh=max(b.size[1] for _,b in bilder)+26;rader=math.ceil(len(bilder)/N)
    A=Image.new('RGB',(N*B+(N-1)*8,rader*rh),(23,20,20));d=ImageDraw.Draw(A)
    for i,(id,b) in enumerate(bilder):
        x=(i%N)*(B+8);y=(i//N)*rh;d.text((x+4,y+6),id,fill=(240,220,160));A.paste(b,(x,y+24))
    f=f'{UT}-{s//P+1}.jpg';A.save(f,quality=92);print(f,A.size)
