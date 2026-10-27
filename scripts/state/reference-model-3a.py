import json,sys
F={1:5,2:10,3:15,4:19,5:23,6:27,7:31}
PC=[11,14,17,20,23,26]; HM=[33,36,39,42,45,48,51,54,57,60,63]; APC=[69,72,75,78,81,84,87]
def ceil_div(a,b): return -(-a//b)
def units(L,N): return ceil_div(L*F[N],15)
def model(inp, rates):
    fl=inp['flags']; rows={int(k):v for k,v in inp['rows'].items()}
    u={r:units(*rows[r]) for r in rows}
    sm=lambda rs: sum(u.get(r,0) for r in rs)
    medrel=fl['L2']
    n29=sm(HM) if medrel else 0
    n30=sm(PC)+n29
    n66=0 if medrel else sm(HM)
    n90=sm(APC)
    o={}
    pc=rates['pc_rcf'] if fl['H9'] else rates['pc']
    apc=rates['apc_rcf'] if fl['H10'] else rates['apc']
    rn=rates['rn_rcf'] if fl['H11'] else rates['rn']
    o['O30']=n30*pc if n30>0 else None
    o['O66']=n66*rates['hc'] if n66>0 else None
    o['O90']=n90*apc if n90 else None
    nv=inp.get('nurseVisits')
    o['O96']=nv*rn if nv and nv>=1 else None
    for r,cell,rate in ((100,'O100',rates['resp_b']),(103,'O103',rates['resp_a']),(109,'O109',rates['adc']),(112,'O112',rates['adc']),(119,'O119',rates['hc'])):
        o[cell]=u[r]*rate if r in u else None
    n106=None
    if 'hdm' in inp:
        un,d=inp['hdm']; n106=ceil_div(un*F[d],1); o['O106']=n106*rates['dm']
    else: o['O106']=None
    o['O115']=None
    tot=sum(v for v in o.values() if v is not None)
    o['O122']=tot
    return u,{'N29':n29,'N30':n30,'N66':n66,'N90':n90,'N106':n106},o
