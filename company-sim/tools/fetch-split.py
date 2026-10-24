#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拉三张表：现金流量(人工) + 资产负债表(使用权资产/租赁负债) + 利润表(租金折旧/费用)
2026-10-24 肥鱼
"""
import subprocess, json, time, os

def curl_json(url, timeout=40):
    cmd=['curl','-sL','-m',str(timeout),'-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',url]
    try:
        r=subprocess.run(cmd,capture_output=True,timeout=timeout+10)
        t=r.stdout.decode('utf-8','ignore').strip()
        return json.loads(t) if t else None
    except Exception as e:
        print('  err:',e,flush=True); return None

def fetch(report, secucode, size=200):
    url=('https://datacenter.eastmoney.com/securities/api/data/v1/get?'
         'reportName='+report+'&columns=ALL'
         '&filter=(SECUCODE%3D%22'+secucode+'%22)'
         '&pageNumber=1&pageSize='+str(size)+'&sortColumns=REPORT_DATE&sortTypes=-1')
    d=curl_json(url)
    if not d or not d.get('result'): return []
    return d['result'].get('data') or []

def annual_only(rows):
    return [r for r in rows if (r.get('REPORT_DATE') or '')[:10].endswith('12-31')]

COMPANIES=[
    ('002186','全聚德','SZ','正餐·老字号'),
    ('603043','广州酒家','SH','餐饮+食品'),
    ('000721','西安饮食','SZ','正餐·地方'),
    ('605108','同庆楼','SH','正餐·连锁'),
    ('603866','桃李面包','SH','食品制造·参考'),
    ('002557','洽洽食品','SZ','食品制造·参考'),
    ('600600','青岛啤酒','SH','饮料制造·参考'),
]

OUT='data/split.json'
result={}
for code,name,mkt,kind in COMPANIES:
    sc=code+'.'+mkt
    print('=== %s %s ==='%(name,code),flush=True)
    cf=annual_only(fetch('RPT_F10_FINANCE_GCASHFLOW',sc))
    bs=annual_only(fetch('RPT_F10_FINANCE_GBALANCE',sc))
    inc=annual_only(fetch('RPT_F10_FINANCE_GINCOME',sc))
    print('  cashflow %d / balance %d / income %d'%(len(cf),len(bs),len(inc)),flush=True)

    def idx(rows):
        return {(r.get('REPORT_DATE') or '')[:10]: r for r in rows}
    cfi,bsi,inci=idx(cf),idx(bs),idx(inc)
    dates=sorted(set(cfi)|set(bsi)|set(inci), reverse=True)[:10]

    recs=[]
    for d in dates:
        c=cfi.get(d,{})
        b=bsi.get(d,{})
        i=inci.get(d,{})
        recs.append({
            'date':d,
            'revenue':i.get('TOTAL_OPERATE_INCOME'),
            'operate_cost':i.get('OPERATE_COST'),
            'staff_cash':c.get('PAY_STAFF_CASH'),
            'buy_services':c.get('BUY_SERVICES'),
            'sell_expense':i.get('SALE_EXPENSE'),
            'admin_expense':i.get('MANAGE_EXPENSE'),
            'fin_expense':i.get('FINANCE_EXPENSE'),
            'depreciation':i.get('ASSET_IMPAIRMENT_LOSS'),
            'useright_asset':b.get('USERIGHT_ASSET'),
            'lease_liab':b.get('LEASE_LIAB'),
            'lease_liab_1y':b.get('NONCURRENT_LIAB_1YEAR'),
            'total_assets':b.get('TOTAL_ASSETS'),
            'inventory':b.get('INVENTORY'),
            'ar':b.get('ACCOUNTS_RECE'),
            'ap':b.get('ACCOUNTS_PAYABLE'),
        })
    result[code]={'name':name,'kind':kind,'annual':recs}
    if recs:
        r=recs[0]
        rev=r['revenue'] or 0
        if rev:
            print('  %s 营收%.2f亿 人工占比%.1f%% 使用权资产%.2f亿 租赁负债%.2f亿'%(
                r['date'],rev/1e8,
                (r['staff_cash'] or 0)/rev*100,
                (r['useright_asset'] or 0)/1e8,
                (r['lease_liab'] or 0)/1e8),flush=True)
    time.sleep(0.8)

with open(OUT,'w',encoding='utf-8') as f:
    json.dump(result,f,ensure_ascii=False,indent=2)
print('\n✅ %s (%.0f KB)'%(OUT,os.path.getsize(OUT)/1024))
