#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""汇总行业基准参数表 v2（修正字段缺失、港股未披露如实标注）2026-10-24"""
import json, statistics as st

def load(p):
    with open(p,encoding='utf-8') as f: return json.load(f)

A=load('data/split_full.json')
HK=load('data/hk-restaurant.json')
FF=load('data/fastfood.json')

def pct(v): return None if v is None else round(v,2)
def safe_div(a,b):
    if a is None or not b: return None
    return a/b

def safe_pct(a,b):
    v=safe_div(a,b)
    return None if v is None else pct(v*100)

def a_records(v):
    out=[]
    for r in v['annual']:
        rev=r.get('revenue') or 0
        if rev<=0: continue
        out.append({
            'date':r['date'],'revenue':rev,
            'gross_margin':pct((rev-(r.get('operate_cost') or 0))/rev*100),
            'staff_rate':safe_pct(r.get('staff_cash'),rev),
            'lease_rate':safe_pct(r.get('useright_asset'),rev),
            'admin_rate':safe_pct(r.get('admin_expense'),rev),
            'sell_rate':safe_pct(r.get('sell_expense'),rev),
            'net_margin':safe_pct(r.get('net_profit'),rev),
            'debt_ratio':safe_pct(r.get('total_liab'),r.get('total_assets')),
            'inv_days':(round(safe_div(r.get('inventory'),r.get('operate_cost'))*365,1) if safe_div(r.get('inventory'),r.get('operate_cost')) is not None else None),
            'ar_days':(round(safe_div(r.get('ar'),rev)*365,1) if safe_div(r.get('ar'),rev) is not None else None),
            'caliber':'A股·人工取自现金流量表',
        })
    return out

def hk_records(v):
    out=[]
    for r in v['annual']:
        rev=r.get('revenue') or 0
        if rev<=0: continue
        it=r.get('income_items') or {}
        staff=it.get('薪金福利支出')
        dep=it.get('折旧与摊销')
        out.append({
            'date':r['date'],'revenue':rev,
            'gross_margin':pct(r.get('gross_margin')),
            'staff_rate':pct(staff/rev*100) if staff else None,
            'dep_rate':pct(dep/rev*100) if dep else None,
            'admin_rate':pct(it.get('行政开支')/rev*100) if it.get('行政开支') else None,
            'sell_rate':pct(it.get('销售及分销费用')/rev*100) if it.get('销售及分销费用') else None,
            'net_margin':pct(r.get('net_margin')),
            'debt_ratio':pct(r.get('debt_ratio')),
            'inv_days':round(r['inv_days'],1) if r.get('inv_days') is not None else None,
            'ar_days':round(r['ar_days'],1) if r.get('ar_days') is not None else None,
            'caliber':'港股·人工取自利润表薪金福利' if staff else '港股·人工未单独披露',
        })
    return out

rows=[]
for c,v in A.items(): rows.append((v['name'],v['kind'],a_records(v)))
for c,v in HK.items(): rows.append((v['name'],v['kind'],hk_records(v)))
for c,v in FF.items(): rows.append((v['name'],v['kind'],hk_records(v)))

def avg(recs,key,n=5):
    vals=[r[key] for r in recs[:n] if r.get(key) is not None]
    return (pct(st.mean(vals)),len(vals)) if vals else (None,0)

table=[]
for name,kind,recs in rows:
    if not recs: continue
    L=recs[0]
    def pick(a,b):
        return L.get(a) if L.get(a) is not None else L.get(b)
    table.append({
        'company':name,'segment':kind,'latest_date':L['date'],
        'revenue_yi':round(L['revenue']/1e8,1),
        'latest':{
            'gross_margin':L.get('gross_margin'),
            'staff_rate':L.get('staff_rate'),
            'dep_or_lease_rate':pick('dep_rate','lease_rate'),
            'admin_rate':L.get('admin_rate'),
            'sell_rate':L.get('sell_rate'),
            'net_margin':L.get('net_margin'),
            'debt_ratio':L.get('debt_ratio'),
            'inv_days':L.get('inv_days'),'ar_days':L.get('ar_days'),
        },
        'avg5y':{
            'gross_margin':avg(recs,'gross_margin')[0],
            'staff_rate':avg(recs,'staff_rate')[0],
            'staff_sample':avg(recs,'staff_rate')[1],
            'dep_or_lease_rate':avg(recs,'dep_rate')[0] if avg(recs,'dep_rate')[0] is not None else avg(recs,'lease_rate')[0],
            'admin_rate':avg(recs,'admin_rate')[0],
            'sell_rate':avg(recs,'sell_rate')[0],
            'net_margin':avg(recs,'net_margin')[0],
            'debt_ratio':avg(recs,'debt_ratio')[0],
        },
        'years':len(recs),'caliber':L['caliber'],
    })

# 品类汇总：只统计真有值的
SEG_ORDER=['正餐','火锅','火锅+酸菜鱼','快餐','茶饮','食品制造','餐饮+食品','饮料制造']
groups={}
for t in table:
    seg=t['segment'].split('·')[0]
    groups.setdefault(seg,[]).append(t)

summary=[]
for seg in SEG_ORDER+[s for s in groups if s not in SEG_ORDER]:
    items=groups.get(seg)
    if not items: continue
    def col(k):
        vals=[i['avg5y'][k] for i in items if i['avg5y'].get(k) is not None]
        if not vals: return None
        return {'min':pct(min(vals)),'median':pct(st.median(vals)),'max':pct(max(vals)),'n':len(vals),
                'missing':[i['company'] for i in items if i['avg5y'].get(k) is None]}
    summary.append({'segment':seg,'companies':[i['company'] for i in items],'n':len(items),
        'gross_margin':col('gross_margin'),'staff_rate':col('staff_rate'),
        'dep_or_lease_rate':col('dep_or_lease_rate'),'admin_rate':col('admin_rate'),
        'sell_rate':col('sell_rate'),'net_margin':col('net_margin'),'debt_ratio':col('debt_ratio')})

out={'generated':'2026-10-24','source':'东方财富 datacenter（A股年报 + 港股年报）',
     'caliber_note':'A股人工=现金流量表「支付给职工」；港股人工=利润表「薪金福利支出」。港股多数公司未单独披露人工，缺者为 null，不补零。',
     'companies':table,'segments':summary}
with open('data/benchmark.json','w',encoding='utf-8') as f: json.dump(out,f,ensure_ascii=False,indent=2)

print('%-9s %-16s %7s %7s %7s %7s %7s %7s %7s %6s'%('公司','品类','毛利','人工','折旧/租','管理','销售','净利','负债','年数'))
for t in table:
    a=t['avg5y']; f=lambda x:('%7.1f'%x) if x is not None else '      -'
    print('%-9s %-16s %s %s %s %s %s %s %s %6d'%(t['company'],t['segment'][:16],f(a['gross_margin']),f(a['staff_rate']),
        f(a['dep_or_lease_rate']),f(a['admin_rate']),f(a['sell_rate']),f(a['net_margin']),f(a['debt_ratio']),t['years']))

print('\n===== 品类基准（5年均值 min/中位/max）=====')
for s in summary:
    print('\n【%s】%s'%(s['segment'],'、'.join(s['companies'])))
    for k,label in [('gross_margin','毛利率'),('staff_rate','人工率'),('dep_or_lease_rate','折旧/租金'),('admin_rate','管理率'),('sell_rate','销售率'),('net_margin','净利率'),('debt_ratio','负债率')]:
        c=s[k]
        if c:
            miss=('  ⚠未披露:'+','.join(c['missing'])) if c['missing'] else ''
            print('   %-8s %6.1f / %6.1f / %6.1f  (n=%d)%s'%(label,c['min'],c['median'],c['max'],c['n'],miss))
print('\n✅ data/benchmark.json')
