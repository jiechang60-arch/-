// 技能道具：农民/招贤令/陨石/攻速符/神兵符
// 库存永久保留在 localStorage（zyad_items_v1），无任何每日/定期重置
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, A = ZY.adapter;

  var IT = {};
  var KEY = 'zyad_items_v1';

  // ---- 库存（持久化）----
  function load() {
    var raw = A.storageGet(KEY);
    var s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) {} }
    if (!s || typeof s !== 'object') s = { fresh: false };
    if (s.fresh === false && s.granted === undefined) {
      // 首次进入：送新手礼包（永久，只送一次）
      s = { granted: true };
      C.ITEM_KEYS.forEach(function (k) { s[k] = C.ITEM_START[k] || 0; });
      save(s);
    }
    C.ITEM_KEYS.forEach(function (k) { if (typeof s[k] !== 'number' || isNaN(s[k])) s[k] = 0; });
    return s;
  }
  function save(s) { A.storageSet(KEY, JSON.stringify(s)); }
  IT.load = load;
  IT.save = save;
  IT.count = function (k) { return load()[k] || 0; };

  // ---- 目标选择状态 ----
  // 使用需指定目标的道具时进入"瞄准模式"：pending = 道具 id
  IT.pending = null;

  IT.beginTarget = function (id) {
    if (!IT.count(id)) { ZY.UI.toast('道具数量不足'); return false; }
    IT.pending = id;
    ZY.UI.toast('点击' + targetHint(id));
    return true;
  };
  function targetHint(id) {
    var t = C.ITEMS[id].target;
    if (t === 'cell') return '空地放置农民';
    if (t === 'any') return '敌军所在区域释放陨石';
    if (t === 'general') return '选择一名武将升级';
    return '';
  }
  IT.cancel = function () { IT.pending = null; };

  // 点击地图（瞄准模式）：x,y 为设计坐标
  // 返回 true 表示已消耗（上层应停止普通拖放处理）
  IT.onMapClick = function (x, y) {
    if (!IT.pending) return false;
    var id = IT.pending;
    var G = ZY.G;
    var cell = ZY.Map.cellAt(x, y);
    var t = C.ITEMS[id].target;
    if (t === 'cell') {
      if (!cell) return false;
      var k = cell.c + '_' + cell.r;
      if (ZY.Map.cellType[k] !== 'build_p' || G.p.units[k]) { ZY.UI.toast('请选择我方空地'); return true; }
      consume(id);
      G.p.units[k] = ZY.Board.makeFarmer();
      ZY.Battle.fx('summon', x, y);
      ZY.UI.toast('农民下地，开始产粮');
      IT.pending = null;
      return true;
    }
    if (t === 'any') {
      // 陨石：以点击位置为圆心的范围伤害（我方半场敌军）
      var hit = 0;
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (e.dead || e.side !== 'p') continue;
        var d = Math.hypot(e.x - x, e.y - y);
        if (d <= ZY.L.cell * 2.2) {
          ZY.Enemies.damage(e, 150);
          hit++;
        }
      }
      if (!hit) { ZY.UI.toast('范围内没有敌军'); return true; }
      consume(id);
      ZY.Battle.fx('roar', x, y);
      ZY.Battle.fx('text', x, y - 60, '陨石天降！', '#a8402c');
      IT.pending = null;
      return true;
    }
    return false;
  };

  // 点击武将（神兵符）：unitKey 为格子 key
  IT.onUnitClick = function (unitKey) {
    if (!IT.pending) return false;
    var id = IT.pending;
    if (C.ITEMS[id].target !== 'general') return false;
    var G = ZY.G;
    var u = G.p.units[unitKey];
    if (!u || u.kind !== 'g') { ZY.UI.toast('请选择一名武将'); return true; }
    var lv = u.lv || 1;
    if (lv >= C.GEN_MAX_LV) { ZY.UI.toast('该武将已满级'); return true; }
    consume(id);
    u.lv = lv + 1;
    if (u.pairedKey && G.p.units[u.pairedKey]) G.p.units[u.pairedKey].lv = lv + 1;
    var cr = unitKey.split('_');
    var p = ZY.Map.cellCenter(+cr[0], +cr[1]);
    ZY.Battle.fx('summon', p.x, p.y);
    ZY.Battle.fx('text', p.x, p.y - 70, u.name + ' Lv.' + (lv + 1) + '！', '#b8860b');
    ZY.sfx('summon');
    IT.pending = null;
    return true;
  };

  // 无目标道具：招贤令（重抽）/ 攻速符（全军加速）
  IT.useInstant = function (id) {
    if (!IT.count(id)) { ZY.UI.toast('道具数量不足'); return false; }
    var G = ZY.G;
    if (!G || G.scene !== 'play') return false;
    if (id === 'zhaoxian') {
      for (var i = 0; i < C.ECON.benchSize; i++) {
        G.p.bench[i] = ZY.Board.rollCard(G.p);
      }
      consume(id);
      ZY.sfx('coin');
      ZY.UI.toast('招贤令·重抽备战席');
      return true;
    }
    if (id === 'haste') {
      G.p.hasteT = 8;
      consume(id);
      ZY.Battle.fx('roar', A.DW / 2, ZY.L.mapY + ZY.L.mapH * 0.75);
      ZY.UI.toast('攻速符·全军攻速×2（8秒）');
      return true;
    }
    return false;
  };

  function consume(id) {
    var s = load();
    if (s[id] > 0) s[id]--;
    save(s);
    ZY.sfx('click');
  }

  // ---- 获取途径（对局内调用；永久累积，绝不重置）----
  // 过波奖励：30% 几率随机 +1 道具
  IT.onWaveCleared = function (wave) {
    if (!(ZY.G && ZY.G.mode === 'pvp' ? true : wave >= 2)) return; // PvP 与单机同规则
    if (Math.random() < 0.3) grantRandom();
  };
  // Boss 击杀：随机 +2
  IT.onBossKill = function () {
    grantRandom();
    grantRandom();
  };
  function grantRandom() {
    var k = C.ITEM_KEYS[(Math.random() * C.ITEM_KEYS.length) | 0];
    var s = load();
    s[k] = (s[k] || 0) + 1;
    save(s);
    ZY.UI.toast('获得道具：' + C.ITEMS[k].name);
  }

  // 存档导出/导入（换电脑迁移用）
  IT.export = function () { return JSON.stringify(load()); };
  IT.import = function (str) {
    try {
      var d = JSON.parse(str);
      if (d && typeof d === 'object') {
        C.ITEM_KEYS.forEach(function (k) { if (typeof d[k] !== 'number') d[k] = 0; });
        save(d);
        return true;
      }
    } catch (e) {}
    return false;
  };

  ZY.Items = IT;
})();
