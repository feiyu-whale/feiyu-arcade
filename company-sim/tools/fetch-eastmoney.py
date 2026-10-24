#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从东方财富拉餐饮上市公司历年财报数据（结构化，非PDF）
数据源：datacenter-web.eastmoney.com（公开接口）
2026-10-24 肥鱼
"""
import subprocess, json, os, time

OUT = '/home/admin/.openclaw/workspace/projects/company-sim/data/financials.json'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# 餐饮相关上市公司（A股）
COMPANIES = [
    ('002186', '全聚德',     '正餐·老字号'),
    ('603043', '广州酒家',   '餐饮+食品'),
    ('000721', '西安饮食',   '正餐·地方'),
    ('605108', '同庆楼',     '正餐·连锁'),
    ('603866', '桃李面包',   '食品制造·参考'),
    ('002557', '洽洽食品',   '食品制造·参考'),
    ('600600', '青岛啤酒',   '饮料制造·参考'),
]

def curl_json(url, timeout=40):
    cmd = ['curl', '-sL', '-m', str(timeout), '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)', url]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout+10)
        txt = r.stdout.decode('utf-8','ignore').strip()
        if not txt: return None
        return json.loads(txt)
    except Exception as e:
        print('  err:', e, flush=True)
        return None

def fetch_company(code, page_size=40):
    """拉某公司历年主要指标"""
    url = ('https://datacenter-web.eastmoney.com/api/data/v1/get?'
           'reportName=RPT_LICO_FN_CPD&columns=ALL'
           f'&filter=(SECURITY_CODE%3D%22{code}%22)'
           f'&pageNumber=1&pageSize={page_size}&sortColumns=REPORTDATE&sortTypes=-1')
    d = curl_json(url)
    if not d or not d.get('result'):
        return []
    return d['result'].get('data') or []

def main():
    result = {}
    for code, name, kind in COMPANIES:
        print(f'=== {name} ({code}) {kind} ===', flush=True)
        rows = fetch_company(code)
        print(f'  拿到 {len(rows)} 期财报', flush=True)
        if not rows:
            continue

        # 提取关键字段，年报优先
        annual = []
        for r in rows:
            rd = (r.get('REPORTDATE') or '')[:10]
            if not rd.endswith('12-31'):
                continue
            annual.append({
                'date': rd,
                'revenue': r.get('TOTAL_OPERATE_INCOME'),
                'net_profit': r.get('PARENT_NETPROFIT'),
                'gross_margin': r.get('XSMLL'),
                'roe': r.get('WEIGHTAVG_ROE'),
                'revenue_yoy': r.get('YSTZ'),
                'profit_yoy': r.get('SJLTZ'),
                'eps': r.get('BASIC_EPS'),
                'bps': r.get('BPS'),
            })

        result[code] = {
            'name': name,
            'kind': kind,
            'annual': annual,
            'latest_quarterly': rows[0] if rows else None,
        }
        print(f'  年报 {len(annual)} 期', flush=True)
        if annual:
            a = annual[0]
            print(f'    最近年报 {a["date"]}: 营收 {a["revenue"]/1e8:.2f}亿, 净利 {a["net_profit"]/1e8 if a["net_profit"] else 0:.2f}亿, 毛利率 {a["gross_margin"]}%', flush=True)
        time.sleep(1)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'\n✅ 写入 {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)')
    print(f'   公司数: {len(result)}')

if __name__ == '__main__':
    main()
