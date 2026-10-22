# Third-Party Notices / 第三方开源声明

本项目 `feiyu-calendar-toolkit` 使用了以下开源成果。感谢原作者的无私分享。
完整许可原文请见 [`LICENSES/`](LICENSES/) 目录。

---

## 一、代码 / 引擎类

| 组件 | 作者 / 来源 | 许可 | 用途 | 许可原文 |
|---|---|---|---|---|
| **lunar-javascript** | 6tail | MIT | 农历 / 干支 / 节气（八字、黄历、大六壬基座）| `LICENSES/lunar-javascript-MIT.txt` |
| **iztro** | iztro | MIT | 紫微斗数排盘 | `LICENSES/iztro-MIT.txt` |
| **3meta** | 3meta | MIT | 奇门遁甲排盘 | `LICENSES/3meta-MIT.txt` |
| **mingpan** | ChesterRa | Apache-2.0 | 大六壬排盘（算法参考 kentang2017/kinliuren）| `LICENSES/mingpan-Apache-2.0.txt` |
| **react-taiyi / kintaiyi** | 移植自 kentang2017/kintaiyi | MIT | 太乙神数排盘 | `LICENSES/taiyi-MIT.txt` |
| **celestine** | celestine | MIT | 西洋占星（行星位置、宫位、相位）| `LICENSES/celestine-MIT.txt` |
| **@hnw/date-tibetan** | hnw | MIT | 藏历换算（算法据 Svante Janson《Tibetan calendar mathematics》, 2007/2014）| `LICENSES/date-tibetan-MIT.txt` |

---

## 二、数据类（★ 来源已追溯）

| 数据 | 来源 | 许可 | 用途 | 许可原文 |
|---|---|---|---|---|
| **中国行政区划数据**（省/市/区 + 经纬度）| 基于**国家公开行政区划数据**整理 | **木兰宽松许可证 v2（MulanPSL-2.0）** | 星盘城市搜索、经纬度测距 | `LICENSES/cities-data.txt` |
| **星表 / 深空 / 银河数据** | **d3-celestial**（fork，原作者 **Olaf Frohn**；fork by **Fekete László**）| **BSD 3-Clause** | 星空图 | `LICENSES/stardata-BSD-3-Clause.txt` |

### 星表数据的完整署名（据上游 NOTICE）

`celestial-chart` 是 [d3-celestial](https://github.com/ofrohn/d3-celestial)
（作者 **Olaf Frohn**，BSD 3-Clause）的 fork。该包同时内联了以下 **D3 模块**
（© **Mike Bostock**，**ISC 许可**）：

```
d3-dispatch  d3-fetch     d3-geo        d3-geo-projection
d3-interpolate d3-scale   d3-selection  d3-shape
d3-time-format d3-transition d3-zoom    versor
```

**算法参考**：行星位置算法参考 Paul Schlyter《How to compute planetary positions》
与 Jean Meeus《Astronomical Algorithms》。

> 依 BSD 3-Clause 第 3 条：原作者姓名**仅用于标识代码来源**，不代表对本项目的认可或背书。
> 本项目与 Olaf Frohn、D3 项目**无隶属关系**。

---

## 三、纯算法实现（无第三方依赖）

以下模块为本项目的**独立纯算法实现**，不含第三方代码：

- **玛雅历**（长计历 / 卓尔金历 / 哈布历 / 历法轮）—— 公历 ⇄ 儒略日（JDN），
  GMT 相关系数 584283（Goodman-Martinez-Thompson）。
- **回历**（伊斯兰历）—— 浏览器原生 `Intl.DateTimeFormat`（`islamic-umalqura` 口径）。
- **东正教历**（儒略历 / 复活节）—— Meeus 复活节算法 + 儒略日换算。

**另：塔罗牌义与六爻卦名属"传统数据"（无代码依赖）**，来源见上节「三之二」。

---

## 三之二、传统牌义 / 卦名数据来源

以下两类数据**无第三方代码依赖**，但**牌义与卦名表格取自公开通行版本**，来源列明如下：

| 数据 | 来源 | 用途 |
|---|---|---|
| **塔罗 78 张牌义**（大阿卡纳 22 张 + 小阿卡纳 56 张，含正/逆位）| **韦特—史密斯（Rider-Waite-Smith, 1909）** 经典牌义体系，参照 A.E. Waite《The Pictorial Key to the Tarot》(1911) 通行牌义归纳 | 塔罗抽牌解读 |
| **六爻 64 卦卦名 / 八卦爻序** | **《周易》通行本**（64 卦卦名、上下卦对应关系）；爻序自下而上，以二进制编码 | 六爻起卦成卦 |
| **欧甘树文 20 符**（Beith-Luis-Nin，4 aicme × 5）| 中世纪爱尔兰《Auraicept na n-Éces》（学者入门书）所载标准字母表，符名与本义取通行学界转写 | 欧甘占卜 |
| **古弗萨克 24 符文**（Elder Futhark）| 通行卢恩字母表；逆位义取北欧 **merkstave（默叉）** 传统，非塔罗式硬套 | 卢恩占卜 |
| **日本御神签等级序列** | 通行的 大吉→吉→中吉→小吉→末吉→凶→大凶 排列（各神社体系略有差异，取通行版）| 御神签 |
| **黄道十二宫 / 十二宫位关键字** | 西方占星通行体系归纳（宫位关键字为通行解读表述）| 占星骰子 |

> 说明：以上为**传统文化数据整理**，非受版权保护的具体文本复制；牌义为通行体系归纳表述，卦名为公有领域经典名称。
> 塔罗、六爻与其余术数工具**均定位为传统文化/娱乐参考**，不作科学结论。

---

## 四、字体与图标

本项目**未引入任何外部字体或图标库**——全部使用系统字体与 Emoji，无额外许可负担。

---

## 五、说明

- 本项目**不包含任何 GPL / AGPL 许可的依赖**（保持 MIT 兼容）。
- 如对上表信息的准确性有疑问，请以 `LICENSES/` 目录中的许可原文为准。
- 本项目为个人学习与技术交流作品；如你是上述任一组件的作者且希望调整署名方式，欢迎联系。
