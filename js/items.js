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
    if (!Array.isArray(s.activeLoadout)) s.activeLoadout = ['haste', 'shenbing'];
    return s;
  }
  function save(s) { A.storageSet(KEY, JSON.stringify(s)); }
  IT.load = load;
  IT.save = save;
  IT.count = function (k) { return load()[k] || 0; };
  IT.isPassiveActive = function (k) { return C.ITEM_PASSIVE_KEYS.indexOf(k) >= 0 && IT.count(k) > 0; };
  IT.activeKeys = function () { return load().activeLoadout.slice(0, C.ITEM_ACTIVE_SLOTS); };
  IT.cycleActive = function (slot) {
    var s = load(), now = s.activeLoadout[slot], i = C.ITEM_ACTIVE_KEYS.indexOf(now);
    for (var n = 1; n <= C.ITEM_ACTIVE_KEYS.length; n++) {
      var next = C.ITEM_ACTIVE_KEYS[(i + n) % C.ITEM_ACTIVE_KEYS.length];
      if ((s[next] || 0) > 0) { s.activeLoadout[slot] = next; save(s); return next; }
    }
    return null;
  };
  IT.buy = function (id) {
    if (!C.ITEMS[id]) return false;
    var cost = C.ITEM_COSTS[id] || 0;
    var coin = parseInt(A.storageGet('zy_coin') || '0', 10);
    if (coin < cost) { ZY.UI.toast('金币不足，需要 ' + cost); return false; }
    var s = load(); s[id] = (s[id] || 0) + 1; save(s);
    A.storageSet('zy_coin', String(coin - cost));
    ZY.UI.toast('购入：' + C.ITEMS[id].name); return true;
  };

  // ---- 被动道具 ----
  // 农民只要库存中持有至少 1 个就会生效，不消耗库存、不按日重置。
  // 每局独立计时，达到上限后暂停；有空位时继续刷新。
  IT.update = function (dt) {
    var G = ZY.G;
    if (!G || G.scene !== 'play' || !G.p) return;
    if (!G.p.passiveT) G.p.passiveT = { granary: 20, arsenal: 60, thunder: 45 };
    if (IT.isPassiveActive('granary') && (G.p.passiveT.granary -= dt) <= 0) {
      G.p.mantou += 5; G.p.passiveT.granary = 20; ZY.UI.toast('丰收令：馒头 +5');
    }
    if (IT.isPassiveActive('arsenal') && (G.p.passiveT.arsenal -= dt) <= 0) {
      for (var bi = 0; bi < G.p.bench.length; bi++) if (!G.p.bench[bi]) { G.p.bench[bi] = ZY.Board.makeShovel(); ZY.UI.toast('军械坊：铲子 +1'); break; }
      G.p.passiveT.arsenal = 60;
    }
    if (IT.isPassiveActive('thunder') && (G.p.passiveT.thunder -= dt) <= 0) {
      for (var ei = 0; ei < G.enemies.length; ei++) if (!G.enemies[ei].dead && G.enemies[ei].side === 'p') ZY.Enemies.damage(G.enemies[ei], 80);
      G.p.passiveT.thunder = 45; ZY.Battle.fx('roar', A.DW / 2, ZY.L.mapY + ZY.L.mapH * 0.72); ZY.UI.toast('落雷阵发动');
    }
    if (!IT.isPassiveActive('farmer')) return;
    var cfg = C.ITEM_PASSIVE_CFG.farmer;
    if (typeof G.p.farmerSpawnT !== 'number') G.p.farmerSpawnT = cfg.spawnCD;
    var farmers = 0;
    for (var uk in G.p.units) if (G.p.units[uk] && G.p.units[uk].kind === 'farm') farmers++;
    if (farmers >= cfg.maxUnits) return;
    G.p.farmerSpawnT -= dt;
    if (G.p.farmerSpawnT > 0) return;
    var spots = ZY.Map.buildOf('p');
    for (var i = 0; i < spots.length; i++) {
      var k = spots[i][0] + '_' + spots[i][1];
      if (!G.p.units[k]) {
        G.p.units[k] = ZY.Board.makeFarmer();
        var pos = ZY.Map.cellCenter(spots[i][0], spots[i][1]);
        ZY.Battle.fx('summon', pos.x, pos.y);
        ZY.Battle.fx('text', pos.x, pos.y - 42, '农民自动上阵', '#5a8a3a');
        ZY.UI.toast('被动道具：农民自动刷新');
        break;
      }
    }
    G.p.farmerSpawnT = cfg.spawnCD;
  };

  // ---- 目标选择状态 ----
  // 使用需指定目标的道具时进入"瞄准模式"：pending = 道具 id
  IT.pending = null;

  IT.beginTarget = function (id) {
    if (C.ITEMS[id] && C.ITEMS[id].target === 'passive') {
      ZY.UI.toast('农民是被动道具，持有后会自动生效');
      return false;
    }
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

