/**
 * 真太阳时 + 中国夏令时（移植自 Renhuai123/ziwei-doushu，GPL-3.0 → 本项目就地重写为 ES5 兼容写法）
 *
 * 口径（与原项目一致）：
 *   地方真太阳时 = 钟表时间 + 经度修正 + 均时差
 *   经度修正 = (出生地经度 − 时区中央经线) × 4 分钟
 *   国内中央经线 = 120°（东八区）
 * 均时差采用 NOAA fractional-year 近似式：
 *   https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 *
 * 夏令时按通行口径 XLS_CN 表（起止日均含），只提示、不自动减 1 小时。
 */
(function (root) {
  'use strict';

  var SECONDS_PER_DAY = 86400;

  function mod(v, base) { return ((v % base) + base) % base; }

  function isLeapYear(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }

  function isValidGregorianDate(y, m, d) {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }

  function dayOfYear(y, m, d) {
    return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  }

  /** NOAA 均时差，返回分钟；正 = 真太阳时快于平太阳时 */
  function equationOfTimeMinutes(y, m, d, hh, mm) {
    if (!isValidGregorianDate(y, m, d)) return 0;
    var daysInYear = isLeapYear(y) ? 366 : 365;
    var fracHour = hh + (mm || 0) / 60;
    var gamma = (2 * Math.PI / daysInYear) * (dayOfYear(y, m, d) - 1 + (fracHour - 12) / 24);
    return 229.18 * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040849 * Math.sin(2 * gamma)
    );
  }

  /** 由一天内的分钟数求时辰序号（0=子 23-01 … 11=亥 21-23） */
  function branchFromSolarMinutes(minutes) {
    if (minutes >= 1380 || minutes < 60) return 0;
    return Math.floor((minutes - 60) / 120) + 1;
  }

  /**
   * 计算真太阳时
   * @param {Object} o {year,month,day,clockHour,clockMinute,longitude?,utcOffsetMinutes?}
   */
  function calculateTrueSolarTime(o) {
    var dateValid = isValidGregorianDate(o.year, o.month, o.day);
    var corrected = typeof o.longitude === 'number' && isFinite(o.longitude);
    var meridian = (typeof o.utcOffsetMinutes === 'number' && isFinite(o.utcOffsetMinutes))
      ? o.utcOffsetMinutes / 4 : 120;
    var lonCorr = corrected ? (o.longitude - meridian) * 4 : 0;
    var eot = (corrected && dateValid)
      ? equationOfTimeMinutes(o.year, o.month, o.day, o.clockHour, o.clockMinute) : 0;
    var totalCorr = lonCorr + eot;
    var rawMinutes = o.clockHour * 60 + o.clockMinute + totalCorr;

    var roundedSeconds = Math.round(rawMinutes * 60);
    var dayOffset = Math.floor(roundedSeconds / SECONDS_PER_DAY);
    var secondOfDay = mod(roundedSeconds, SECONDS_PER_DAY);
    var hour = Math.floor(secondOfDay / 3600);
    var minute = Math.floor((secondOfDay % 3600) / 60);
    var second = secondOfDay % 60;
    var normalizedMinutes = secondOfDay / 60;

    return {
      dateValid: dateValid,
      corrected: corrected,
      longitudeCorrectionMinutes: lonCorr,
      equationOfTimeMinutes: eot,
      totalCorrectionMinutes: totalCorr,
      rawMinutes: rawMinutes,
      normalizedMinutes: normalizedMinutes,
      dayOffset: dayOffset,
      hour: hour,
      minute: minute,
      second: second,
      branch: branchFromSolarMinutes(normalizedMinutes)
    };
  }

  /** 真太阳日偏移 + 晚子时流派规则 → 最终排盘日相对输入日的偏移 */
  function resolveZiweiDayOffset(solar, lateZishi) {
    var rule = lateZishi || 'next-day';
    var nextDayRule = rule === 'next-day';
    var isLateZishi = solar.branch === 0 && solar.normalizedMinutes >= 1380;
    if (solar.dayOffset < 0 && isLateZishi) return nextDayRule ? solar.dayOffset + 1 : solar.dayOffset;
    if (solar.dayOffset !== 0) return solar.dayOffset;
    if (isLateZishi) return nextDayRule ? 1 : 0;
    return 0;
  }

  function formatTrueSolarClock(solar, withSeconds) {
    var base = pad2(solar.hour) + ':' + pad2(solar.minute);
    return withSeconds ? base + ':' + pad2(solar.second) : base;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ── 中国夏令时（通行口径 XLS_CN，起止日均含）──────────────────
  var XLS_CN = [
    [1935,5,1,9,30],[1936,5,1,9,30],[1937,5,1,9,30],[1938,5,1,9,30],
    [1939,5,1,9,30],[1940,5,1,9,30],[1941,5,1,9,30],[1942,5,1,9,30],
    [1943,5,1,9,30],[1944,5,1,9,30],[1945,5,1,9,30],[1946,5,1,9,30],
    [1947,5,1,9,30],[1948,5,1,9,30],[1949,5,1,9,30],[1950,5,1,9,30],
    [1951,5,1,9,30],[1952,3,1,10,31],[1953,4,1,10,31],[1954,4,1,10,31],
    [1955,5,1,9,30],[1956,5,1,9,30],[1957,4,1,9,30],[1958,4,1,9,30],
    [1959,4,1,9,30],[1960,6,1,9,30],[1961,6,1,9,30],[1974,4,1,10,31],
    [1975,4,1,10,31],[1979,7,1,9,30],[1986,5,4,9,14],[1987,4,12,9,13],
    [1988,4,10,9,11],[1989,4,16,9,17],[1990,4,15,9,16],[1991,4,14,9,15]
  ];

  /** 该公历日期是否在中国大陆夏令时期间（纯按日期，不看小时） */
  function isChinaDST(y, m, d) {
    for (var i = 0; i < XLS_CN.length; i++) {
      var r = XLS_CN[i];
      if (y !== r[0]) continue;
      var m1 = r[1], d1 = r[2], m2 = r[3], d2 = r[4];
      if (m > m1 && m < m2) return true;
      if (m === m1) {
        if (d >= d1) return true;
      } else if (m === m2) {
        if (d <= d2) return true;
      }
    }
    return false;
  }

  function isChinaDSTYear(y) {
    for (var i = 0; i < XLS_CN.length; i++) if (XLS_CN[i][0] === y) return true;
    return false;
  }

  function chinaDSTRange(y) {
    for (var i = 0; i < XLS_CN.length; i++) {
      var r = XLS_CN[i];
      if (r[0] === y) return { start: r[1] + ' 月 ' + r[2] + ' 日', end: r[3] + ' 月 ' + r[4] + ' 日' };
    }
    return null;
  }

  root.ZW = root.ZW || {};
  root.ZW.solar = {
    isValidGregorianDate: isValidGregorianDate,
    equationOfTimeMinutes: equationOfTimeMinutes,
    branchFromSolarMinutes: branchFromSolarMinutes,
    calculateTrueSolarTime: calculateTrueSolarTime,
    resolveZiweiDayOffset: resolveZiweiDayOffset,
    formatTrueSolarClock: formatTrueSolarClock,
    isChinaDST: isChinaDST,
    isChinaDSTYear: isChinaDSTYear,
    chinaDSTRange: chinaDSTRange
  };
})(window);
