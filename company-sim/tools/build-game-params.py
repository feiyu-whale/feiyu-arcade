#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""基准表 → 游戏参数表（每品类一套，含 min/typical/max）2026-10-24 肥鱼"""
import json, statistics as st

d=json.load(open('data/benchmark.json'))
buckets={}
for t in d['companies']:
    seg=t['segment'].split('·')[0]
    buckets.setdefault(seg,[]).append(t)

def rng(items,key):
    vals=[i['latest'][key] for i in items if i['latest'].get(key) is not None]
    if not vals: return None
    return {'typical':round(st.median(vals),1),'min':round(min(vals),1),'max':round(max(vals),1),'n':len(vals)}

FIELDS=[('gross_margin','毛利率'),('staff_rate','人工率'),('dep_or_lease_rate','折旧租金率'),
        ('admin_rate','管理率'),('sell_rate','销售率'),('net_margin','净利率'),('debt_ratio','负债率')]

params={}
for seg,items in buckets.items():
    entry={'companies':[i['company'] for i in items],'n':len(items),'params':{}}
    for k,label in FIELDS:
        r=rng(items,k)
        if r: entry['params'][k]={'label':label,**r}
    params[seg]=entry

out={
 'version':'v0.1.0-游戏参数 20261024',
 'note':'数值=最新年报中位数。n=1 的品类视为单点参考，不可当区间用。',
 'missing_note':'快餐、茶饮的人工率与折旧率，港股未单独披露，故缺失；游戏里这两项按行业常识另行给定并标注来源。',
 'segments':params,
}
with open('data/game-params.json','w',encoding='utf-8') as f:
    json.dump(out,f,ensure_ascii=False,indent=2)
print('✅ data/game-params.json')
print('品类:',list(params.keys()))
