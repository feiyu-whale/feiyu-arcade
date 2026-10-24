#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重拉A股三表，补齐 net_profit / total_liab / 应收应付 / 折旧 2026-10-24"""
import subprocess, json, time, os

def curl_json(url,t=40):
    r=subprocess.run(['curl','-sL','-m',str(t),'-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',url],capture_output=True,timeout=t+10)
    txt=r.stdout.decode('utf-8','ignore').strip()
    try: return json.loads(txt) if txt else None
    except: return None

def get(rep,sc,size=200):
    u=('https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName='+rep+'&columns=ALL'
       '&filter=(SECUCODE%3D%22'+sc+'%22)&pageNumber=1&pageSize='+str(size)+'&sortColumns=REPORT_DATE&sortTypes=-1')
    d=curl_json(u)
    return (d['result'].get('data') or []) if d and d.get('result') else []

def ann(rows):
    return { (r.get('REPORT_DATE') or '')[:10]: r for r in rows if (r.get('REPORT_DATE') or '')[:10].endswith('12-31') }

COMPANIES=[
    ('002186','全聚德','SZ','正餐·老字号'),
    ('603043','广州酒家','SH','餐饮+食品'),
    ('000721','西安饮食','SZ','正餐·地方'),
    ('605108','同庆楼','SH','正餐·连锁'),
    ('603866','桃李面包','SH','食品制造·参考'),
    ('002557','洽洽食品','SZ','食品制造·参考'),
    ('600600','青岛啤酒','SH','饮料制造·参考'),
]

OUT='data/split_full.json'
res={}
for code,name,mkt,kind in COMPANIES:
    sc=code+'.'+mkt
    cf=ann(get('RPT_F10_FINANCE_GCASHFLOW',sc))
    bs=ann(get('RPT_F10_FINANCE_GBALANCE',sc))
    inc=ann(get('RPT_F10_FINANCE_GINCOME',sc))
    dates=sorted(set(cf)|set(bs)|set(inc),reverse=True)[:12]
    recs=[]
    for d in dates:
        c,b,i=cf.get(d,{}),bs.get(d,{}),inc.get(d,{})
        recs.append({
            'date':d,
            'revenue':i.get('TOTAL_OPERATE_INCOME'),
            'operate_cost':i.get('OPERATE_COST'),
            'net_profit':i.get('PARENT_NETPROFIT') or i.get('NETPROFIT'),
            'sell_expense':i.get('SALE_EXPENSE'),
            'admin_expense':i.get('MANAGE_EXPENSE'),
            'fin_expense':i.get('FINANCE_EXPENSE'),
            'operate_profit':i.get('OPERATE_PROFIT'),
            'staff_cash':c.get('PAY_STAFF_CASH'),
            'buy_services':c.get('BUY_SERVICES'),
            'useright_asset':b.get('USERIGHT_ASSET'),
            'lease_liab':b.get('LEASE_LIAB'),
            'total_assets':b.get('TOTAL_ASSETS'),
            'total_liab':b.get('TOTAL_LIABILITIES'),
            'total_equity':b.get('TOTAL_PARENT_EQUITY'),
            'inventory':b.get('INVENTORY'),
            'ar':b.get('ACCOUNTS_RECE'),
            'ap':b.get('ACCOUNTS_PAYABLE'),
            'cash':b.get('MONETARYFUNDS'),
        })
    res[code]={'name':name,'kind':kind,'annual':recs}
    r=recs[0]
    rev=r['revenue'] or 0
    print('%s %s 营收%.1f亿 净利%s 负债率%.1f%%' % (
        name, r['date'], rev/1e8,
        ('%.2f亿'%(r['net_profit']/1e8)) if r['net_profit'] else 'None',
        ((r['total_liab'] or 0)/(r['total_assets'] or 1)*100)),flush=True)
    time.sleep(0.7)

with open(OUT,'w',encoding='utf-8') as f: json.dump(res,f,ensure_ascii=False,indent=2)
print('\n✅',OUT, os.path.getsize(OUT)//1024,'KB')
