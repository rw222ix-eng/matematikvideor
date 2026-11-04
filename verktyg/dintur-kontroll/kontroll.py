#!/usr/bin/env python3
# Kontroll av Din tur-figurerna ur lagren från lager.mjs:
#   python3 kontroll.py <lagermapp> <dintur.json> [--telefon]
# Per etikett: minsta avstånd bläck-streck (i vyns enheter), om bläcket hamnar utanför utsnittet,
# kontrast mot bilden bakom, och om talet finns i frågan.
import json,sys,re
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
M=sys.argv[1];DT=json.load(open(sys.argv[2],encoding='utf8'))
def lum(a):
    a=a/255.0;a=np.where(a<=.03928,a/12.92,((a+.055)/1.055)**2.4);return a@np.array([.2126,.7152,.0722])
def hexrgb(s):
    s=s.lstrip('#');return np.array([int(s[i:i+2],16) for i in (0,2,4)],float)
ut={}
for lage in ['dator','telefon']:
    mat=json.load(open(f'{M}/matt-{lage}.json'))
    T=255-np.array(Image.open(f'{M}/{lage}-text.png').convert('L'))
    S=255-np.array(Image.open(f'{M}/{lage}-streck.png').convert('L'))
    H=np.array(Image.open(f'{M}/{lage}-hel.png').convert('RGB'))
    LUFT=150
    for m in mat:
        v=m['v'];X,Y=m['x'],m['y'];W,H0=int(v[2]),int(v[3])
        x0,y0=X-LUFT,Y-LUFT
        t=T[y0:y0+H0+2*LUFT,x0:x0+W+2*LUFT]>90
        s=S[y0:y0+H0+2*LUFT,x0:x0+W+2*LUFT]>90
        h=H[y0:y0+H0+2*LUFT,x0:x0+W+2*LUFT]
        # bakgrund: plåten själv = hel-lagret där inget bläck finns
        rader=[]
        sy,sx=np.nonzero(s)
        for e in m['text']:
            bx0=int(e['x']-v[0]+LUFT)-4;by0=int(e['y']-v[1]+LUFT)-4;bx1=int(e['x']+e['w']-v[0]+LUFT)+4;by1=int(e['y']+e['h']-v[1]+LUFT)+4
            mask=np.zeros_like(t);mask[max(by0,0):by1,max(bx0,0):bx1]=True
            ink=t&mask
            iy,ix=np.nonzero(ink)
            if len(ix)==0: rader.append(dict(t=e['t'],fel='inget bläck'));continue
            # minsta avstånd till streck
            if len(sx):
                near=(sx>ix.min()-120)&(sx<ix.max()+120)&(sy>iy.min()-120)&(sy<iy.max()+120)
                if near.any():
                    a=np.stack([ix[::2],iy[::2]],1)[:,None,:].astype(np.float32);b=np.stack([sx[near][::2],sy[near][::2]],1)[None,:,:].astype(np.float32)
                    d=np.sqrt(((a-b)**2).sum(2)).min()
                else: d=999.0
            else: d=999.0
            # utanför utsnittet
            ute={'v':max(0,LUFT-ix.min()),'h':max(0,ix.max()-(LUFT+W-1)),'o':max(0,LUFT-iy.min()),'n':max(0,iy.max()-(LUFT+H0-1))}
            ute={k:int(u) for k,u in ute.items() if u>0}
            # marginal till kanten
            kant=int(min(ix.min()-LUFT,LUFT+W-1-ix.max(),iy.min()-LUFT,LUFT+H0-1-iy.max()))
            # kontrast: bläckets färg mot ring 6-22 px runt bläcket i hel-lagret (inom utsnittet)
            yy0,yy1,xx0,xx1=max(iy.min()-22,0),iy.max()+22,max(ix.min()-22,0),ix.max()+22
            kar=h[yy0:yy1,xx0:xx1].astype(float);ik=ink[yy0:yy1,xx0:xx1]
            bg=np.ones_like(ik)
            # enkel utvidgning
            im=Image.fromarray((ik*255).astype('uint8'))
            from PIL import ImageFilter
            d1=np.array(im.filter(ImageFilter.MaxFilter(13)))>0;d2=np.array(im.filter(ImageFilter.MaxFilter(45)))>0
            ring=d2&~d1
            ringS=ring&~(s[yy0:yy1,xx0:xx1])
            bgl=lum(kar[ringS]) if ringS.any() else np.array([.5])
            farg=lum(np.median(kar[ik],axis=0)[None,:])[0] if ik.any() else 0
            cr=lambda a,b:(max(a,b)+.05)/(min(a,b)+.05)
            # sämsta bakgrund: 90:e percentilen åt det håll som ligger närmast bläcket
            pct=np.percentile(bgl,90) if farg<np.median(bgl) else np.percentile(bgl,10)
            con=cr(farg,float(np.median(bgl)));con_s=cr(farg,float(pct)) if False else cr(farg,float(np.percentile(bgl,10)) if farg>np.median(bgl) else float(np.percentile(bgl,90)))
            rader.append(dict(t=e['t'],avst=round(float(d),1),ute=ute,kant=kant,kontrast=round(float(con),1),samst=round(float(con_s),1),bred=int(ix.max()-ix.min()),hog=int(iy.max()-iy.min())))
        # text mot text
        par=[]
        for i,a in enumerate(m['text']):
            for b in m['text'][i+1:]:
                dx=max(a['x'],b['x'])-min(a['x']+a['w'],b['x']+b['w']);dy=max(a['y'],b['y'])-min(a['y']+a['h'],b['y']+b['h'])
                if dx<0 and dy<-a['h']*.3: par.append((a['t'],b['t'],round(dx),round(dy)))
        ut.setdefault(m['id'],{})[lage]=dict(text=rader,textkrock=par)
for id,d in ut.items():
    f=DT[id]; q=' '.join([f['fraga'],*f['slut']])
    print('\n'+id, '| utsnitt' , f['figur'].get('utsnitt'))
    print('  fråga:',q)
    for lage in d:
        print(' ',lage)
        for r in d[lage]['text']:
            if 'fel' in r: print('   ',r);continue
            flagga=[]
            if r['avst']<3: flagga.append('RÖR STRECK')
            elif r['avst']<10: flagga.append('nära streck')
            if r['ute']: flagga.append(f"KLIPPS {r['ute']}")
            elif r['kant']<14: flagga.append(f"nära kant {r['kant']}")
            if r['kontrast']<3 : flagga.append('LÅG KONTRAST')
            elif r['samst']<2.5: flagga.append('svag kontrast på sina håll')
            print(f"    {r['t']!r:18} avst {r['avst']:6} kant {r['kant']:5} kontr {r['kontrast']:4}/{r['samst']:4} {r['bred']}×{r['hog']}  {' '.join(flagga)}")
        if d[lage]['textkrock']: print('    TEXT MOT TEXT',d[lage]['textkrock'])
    tal=sorted({x for r in d['dator']['text'] for x in re.findall(r'\d+(?:,\d+)?',r['t'])})
    saknas=[x for x in tal if x not in q and x not in json.dumps(f.get('delar'),ensure_ascii=False)]
    print('  tal i bilden:',tal,'| finns inte i frågan:',saknas)
