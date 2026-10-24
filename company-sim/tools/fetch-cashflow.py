#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拉现金流量表：人工成本、租金相关 2026-10-24"""
import subprocess, json, time

def curl_json(url, timeout=40):
    cmd = ['curl','-sL','-m',str(timeout),'-H','User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)', url]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout+10)
        t = r.stdout.decode('utf-8','ignore').strip()
        return json.loads(t) if t else None
    except Exception as e:
        print('  err:', e, flush=True); return None

def fetch(code):
    url = ('https://datacenter.eastmoney.com/securities/api/data/v1/get?'
           'reportName=RPT_F10_FINANCE_GCASHFLOW&columns=ALL'
           '&filter=(SECUCODE%3D%22' + code + '.SZ%22)'
           '&pageNumber=1&pageSize=8&sortColumns=REPORT_DATE&sortTypes=-1')
    return curl_json(url)

probe = fetch('002186')
if probe and probe.get('result'):
    row = probe['result']['data'][0]
    print('字段样例 (%d 个):' % len(row))
    for k,v in list(row.items()):
        print('  %s = %s' % (k,v))
else:
    print('探测失败:', json.dumps(probe, ensure_ascii=False)[:600] if probe else 'None')
