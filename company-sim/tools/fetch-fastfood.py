#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快餐/茶饮连锁：港股上市主体。老乡鸡、乡村基未上市（已确认），用上市同行做基准
2026-10-24 肥鱼"""
import subprocess, json, time, os

def curl_json(url,t=40):
    r=subprocess.run(['curl','-sL','-m',str(t),'-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                      '-H','Referer: https://quote.eastmoney.com/',url],capture_output=True,timeout=t+10)
    txt=r.stdout.decode('utf-8','ignore').strip()
    try: return json.loads(txt) if txt else None
    except: return None

def get(rep,sc,size=400):
    u=('https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName='+rep+'&columns=ALL'
       '&filter=(SECUCODE%3D%22'+sc+'%22)&pageNumber=1&pageSize='+str(size)+'&sortColumns=REPORT_DATE&sortTypes=-1')
    d=curl_json(u)
    return (d['result'].get('data') or []) if d and d.get('result') else []

COMPANIES=[
    ('09987','百胜中国','快餐·西式(KFC/必胜客)'),
    ('02097','蜜雪集团','茶饮·加盟小店'),
    ('01364','古茗','茶饮·加盟'),
    ('02555','茶百道','茶饮·加盟'),
]

OUT='data/fastfood.json'
res={}
for code,name,kind in COMPANIES:
    sc=code+'.HK'
    print('=== %s %s ==='%(name,code),flush=True)
    mi=get('RPT_HKF10_FN_MAININDICATOR',sc)
    inc=get('RPT_HKF10_FN_INCOME',sc)
    bal=get('RPT_HKF10_FN_BALANCE',sc)
    years=[r for r in mi if '年报' in (r.get('REPORT_TYPE') or '')]
    print('  main %d / 年报 %d / income %d / balance %d'%(len(mi),len(years),len(inc),len(bal)),flush=True)

    def group(rows):
        g={}
        for r in rows:
            d=(r.get('REPORT_DATE') or '')[:10]
            g.setdefault(d,{})[r.get('ITEM_NAME')]=r.get('AMOUNT')
        return g
    gi,gb=group(inc),group(bal)

    recs=[]
    for y in years[:8]:
        d=(y.get('REPORT_DATE') or '')[:10]
        recs.append({
            'date':d,'report_type':y.get('REPORT_TYPE'),'currency':y.get('CURRENCY'),
            'revenue':y.get('OPERATE_INCOME'),'gross_profit':y.get('GROSS_PROFIT'),
            'gross_margin':y.get('GROSS_PROFIT_RATIO'),'net_profit':y.get('HOLDER_PROFIT'),
            'net_margin':y.get('NET_PROFIT_RATIO'),'operate_profit':y.get('OPERATE_PROFIT'),
            'total_assets':y.get('TOTAL_ASSETS'),'total_liab':y.get('TOTAL_LIABILITIES'),
            'debt_ratio':y.get('DEBT_ASSET_RATIO'),'roe':y.get('ROE_AVG'),
            'netcash_operate':y.get('NETCASH_OPERATE'),
            'ar_days':y.get('ACCOUNTS_RECE_TDAYS'),'inv_days':y.get('INVENTORY_TDAYS'),
            'income_items':gi.get(d),'balance_items':gb.get(d),
        })
    res[code]={'name':name,'kind':kind,'annual':recs}
    if recs:
        a=recs[0]
        print('  %s 营收%.1f亿 毛利%.1f%% 净利%.1f%% 负债%.1f%%'%(
            a['date'],(a['revenue'] or 0)/1e8,a['gross_margin'] or 0,a['net_margin'] or 0,a['debt_ratio'] or 0),flush=True)
    time.sleep(0.8)

with open(OUT,'w',encoding='utf-8') as f:
    json.dump(res,f,ensure_ascii=False,indent=2)
print('\n✅ %s (%.0f KB)'%(OUT,os.path.getsize(OUT)/1024))
