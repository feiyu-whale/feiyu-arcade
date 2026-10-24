#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从巨潮资讯网抓餐饮上市公司年报/招股书，提取真实经营指标
数据源：cninfo.com.cn（深交所指定披露平台）
2026-10-24 肥鱼
"""
import subprocess, json, time, os, re, sys

OUT_DIR = '/home/admin/.openclaw/workspace/projects/company-sim/data'
os.makedirs(OUT_DIR, exist_ok=True)

BASE = 'http://www.cninfo.com.cn'

def curl(url, data=None, timeout=40, outfile=None):
    cmd = ['curl', '-sL', '-m', str(timeout), '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
           '-H', 'Referer: http://www.cninfo.com.cn/new/commonUrl?url=disclosure/list/notice']
    if data:
        cmd += ['-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8']
        for k, v in data.items():
            cmd += ['--data-urlencode', f'{k}={v}']
    if outfile:
        cmd += ['-o', outfile]
    cmd.append(url)
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout + 10)
        return r.stdout
    except Exception as e:
        print('  curl err:', e, flush=True)
        return b''

def search_announcements(keyword, page_size=30):
    """搜索公告"""
    data = {
        'pageNum': 1, 'pageSize': page_size, 'column': 'szse',
        'tabName': 'fulltext', 'searchkey': keyword, 'seDate': '',
        'sortName': '', 'sortType': '', 'isHLtitle': 'true',
    }
    raw = curl(f'{BASE}/new/hisAnnouncement/query', data)
    try:
        d = json.loads(raw.decode('utf-8', 'ignore'))
        return d.get('announcements') or []
    except Exception as e:
        print('  解析失败:', e, flush=True)
        return []

def download_pdf(adjunct_url, outname):
    url = f'{BASE}/{adjunct_url.lstrip("/")}'
    outpath = os.path.join(OUT_DIR, outname)
    if os.path.exists(outpath) and os.path.getsize(outpath) > 10240:
        print(f'  已存在，跳过: {outname}', flush=True)
        return outpath
    curl(url, outfile=outpath, timeout=90)
    if os.path.exists(outpath):
        sz = os.path.getsize(outpath)
        print(f'  下载 {outname}: {sz/1024:.0f} KB', flush=True)
        return outpath if sz > 10240 else None
    return None

TARGETS = [
    ('全聚德', '002186'),
    ('广州酒家', '603043'),
    ('西安饮食', '000721'),
    ('同庆楼', '605108'),
]

def main():
    report = {}
    for name, code in TARGETS:
        print(f'=== {name} ({code}) ===', flush=True)
        anns = search_announcements(name, 30)
        print(f'  公告总数: {len(anns)}', flush=True)

        # 优先找"年度报告"
        yearly = [a for a in anns if '年度报告' in (a.get('announcementTitle') or '') and '摘要' not in (a.get('announcementTitle') or '')]
        # 再找"招股说明书"
        ipo = [a for a in anns if '招股' in (a.get('announcementTitle') or '')]

        picked = []
        if yearly:
            picked.append(yearly[0])
            print(f'  年报: {yearly[0]["announcementTitle"][:50]}', flush=True)
        if ipo:
            picked.append(ipo[0])
            print(f'  招股书: {ipo[0]["announcementTitle"][:50]}', flush=True)

        if not picked:
            # 没找到就取前 3 条
            picked = anns[:3]
            for a in picked:
                print(f'  兜底: {a["announcementTitle"][:50]}', flush=True)

        report[name] = {'code': code, 'files': []}
        for i, a in enumerate(picked[:2]):
            fn = f'{code}_{name}_{i}.pdf'
            p = download_pdf(a['adjunctUrl'], fn)
            if p:
                report[name]['files'].append({'title': a['announcementTitle'], 'file': fn, 'size': os.path.getsize(p)})
        time.sleep(1.5)

    with open(os.path.join(OUT_DIR, 'download-report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print('\n=== 汇总 ===')
    for k, v in report.items():
        print(f'  {k}: {len(v["files"])} 个文件')
        for f_ in v['files']:
            print(f'    - {f_["file"]} ({f_["size"]/1024:.0f} KB)')

if __name__ == '__main__':
    main()
