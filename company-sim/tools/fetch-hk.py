#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""港股餐饮：主要指标 + 利润表 + 资产负债表（按科目名展开）2026-10-24"""
import subprocess, json, time, os

def curl_json(url,t=40):
    r=subprocess.run(['curl','-sL','-m',str(t),'-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',url],capture_output=True,timeout=t+10)
    txt=r.stdout.decode('utf-8','ignore').strip()
    try: return json.loads(txt) if txt else None
    except: return None

def get(rep, sc, size=60):
    u=('https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName='+rep+'&columns=ALL'
       '&filter=(SECUCODE%3D%22'+sc+'%22)&pageNumber=1&pageSize='+str(size)+'&sortColumns=REPORT_DATE&sortTypes=-1')
    d=curl_json(u)
    return (d['result'].get('data') or []) if d and d.get('result') else []

COMPANIES=[
    ('06862','海底捞','火锅'),
    ('00992','??占位','x'),  # 会替换
]

# 九毛九 09922；呷哺呷哺 00520；特海国际(海底捞海外) 09658
COMPANIES=[
    ('06862','海底捞','火锅·直营大店'),
    ('09922','九毛九','火锅+酸菜鱼·多品牌'),
    ('00520','呷哺呷哺','火锅·快餐化小火锅'),
    ('09658','特海国际','火锅·海外'),
]

OUT='data/hk-restaurant.json'
res={}
for code,name,kind in COMPANIES:
    sc=code+'.HK'
    print('=== %s %s ==='%(name,code),flush=True)
    mi=get('RPT_HKF10_FN_MAININDICATOR',sc,40)
    inc=get('RPT_HKF10_FN_INCOME',sc,400)
    bal=get('RPT_HKF10_FN_BALANCE',sc,400)
    print('  main %d / income条目 %d / balance条目 %d'%(len(mi),len(inc),len(bal)),flush=True)
    if not mi:
        print('  ⚠️ 无数据，跳过'); continue

    # 年报筛选（REPORT_TYPE 含 年报/年度）
    years=[r for r in mi if '年报' in (r.get('REPORT_TYPE') or '') or '年度' in (r.get('REPORT_TYPE') or '')]
    print('  年报 %d 期'%len(years),flush=True)

    # 明细按日期分组
    def group(rows):
        g={}
        for r in rows:
            d=(r.get('REPORT_DATE') or '')[:10]
            g.setdefault(d,{})[r.get('ITEM_NAME') or r.get('STD_ITEM_CODE')]=r.get('AMOUNT')
        return g
    gi,gb=group(inc),group(bal)

    recs=[]
    for y in years[:8]:
        d=(y.get('REPORT_DATE') or '')[:10]
        recs.append({
            'date':d,
            'report_type':y.get('REPORT_TYPE'),
            'currency':y.get('CURRENCY'),
            'revenue':y.get('OPERATE_INCOME'),
            'gross_profit':y.get('GROSS_PROFIT'),
            'gross_margin':y.get('GROSS_PROFIT_RATIO'),
            'net_profit':y.get('HOLDER_PROFIT'),
            'net_margin':y.get('NET_PROFIT_RATIO'),
            'operate_profit':y.get('OPERATE_PROFIT'),
            'total_assets':y.get('TOTAL_ASSETS'),
            'total_liab':y.get('TOTAL_LIABILITIES'),
            'debt_ratio':y.get('DEBT_ASSET_RATIO'),
            'roe':y.get('ROE_AVG'),
            'netcash_operate':y.get('NETCASH_OPERATE'),
            'ar_days':y.get('ACCOUNTS_RECE_TDAYS'),
            'inv_days':y.get('INVENTORY_TDAYS'),
            'income_items':gi.get(d),
            'balance_items':gb.get(d),
        })
    res[code]={'name':name,'kind':kind,'annual':recs}
    if recs:
        a=recs[0]
        rev=a['revenue'] or 0
        print('  %s 营收%.2f亿 毛利%.1f%% 净利%.1f%% 负债率%.1f%%'%(
            a['date'],rev/1e8,a['gross_margin'] or 0,a['net_margin'] or 0,a['debt_ratio'] or 0),flush=True)
    time.sleep(0.8)

with open(OUT,'w',encoding='utf-8') as f:
    json.dump(res,f,ensure_ascii=False,indent=2)
print('\n✅ %s (%.0f KB)'%(OUT,os.path.getsize(OUT)/1024))
