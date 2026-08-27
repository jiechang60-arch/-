// PvP 粘合层：把联机消息接入对局
// 架构：双方各自权威模拟自己半场（操作零延迟），互发快照（含对方半场状态）
// 房主额外负责：生成对局种子、地图选择、开波时序（对方收到后跟随）
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, A = ZY.adapter;

  var MP = {};
  MP.active = false;      // 当前处于 PvP 对局
  MP.role = null;         // 'host' | 'guest'
  MP.oppName = '对手';
  var snapT = 0;          // 快照发送计时
  var remoteSide = null;  // 对方权威侧数据（本地显示用）
  var lastMsgT = 0;       // 最近收到消息时间（检测断线）
  var rematch = { host: null, guest: null }; // 再战意向
  var pingT = 0;

  var MSG = {
    HELLO: 'hello',       // 双方初始握手（名字）
    READY: 'ready',       // 客机->房主：已进入对局，请求开局参数
    START: 'start',       // 房主->客机：种子/地图
    SNAPSHOT: 'snap',     // 双方持续互发：己方半场状态
    WAVE: 'wave',         // 房主->客机：开波
    DEFEAT: 'defeat',     // 一方宣布自己失守
    REMATCH: 'rematch',   // 再战意向
    PING: 'ping',         // 心跳保活
    CHAT: 'chat'          // 快捷喊话
  };

  function send(m) {
    m.t = Date.now();
    return ZY.Net.send(m);
  }

  // ---- 开始对局 ----
  var pendingStart = null; // 客机缓存：比"进入对局"更早到达的开局参数
  MP.startMatch = function (role) {
    MP.role = role;
    MP.active = true;
    rematch = { host: null, guest: null };
    if (role === 'host') {
      var seed = (Math.random() * 0xFFFFFFFF) >>> 0;
      var mapIdx = (Math.random() * 4) | 0;
      send({ k: MSG.START, seed: seed, mapIdx: mapIdx });
      beginGame(seed, mapIdx);
    } else {
      // 告知房主"我已就位"，房主会重发开局参数
      send({ k: MSG.READY });
      if (pendingStart) {
        var ps = pendingStart;
        pendingStart = null;
        beginGame(ps.seed, ps.mapIdx);
      } else {
        // 客机等待 START 消息（beginGame 在收到时调用）
        ZY.UI.toast('等待房主开局…');
      }
    }
  };

  function beginGame(seed, mapIdx) {
    ZY.Rng.seed(seed);
    ZY.Map.pickIndex(mapIdx);
    ZY.Main.newGame();
    ZY.G.mode = 'pvp';
    ZY.G.mpSeed = seed;
    ZY.G.mpMap = mapIdx;
    snapT = 0;
    lastMsgT = Date.now();
    ZY.UI.toast('联机对局开始！各守半场，先失守者败');
  }

  // ---- 消息处理 ----
  MP.onMessage = function (m) {
    if (!m || !m.k) return;
    lastMsgT = Date.now();
    switch (m.k) {
      case MSG.HELLO:
        MP.oppName = m.name || '对手';
        break;
      case MSG.READY:
        // 客机已就位：房主重发当前对局参数（若对局已在进行则同步进行中的状态）
        if (MP.role === 'host') {
          if (ZY.G && ZY.G.mode === 'pvp') {
            send({ k: MSG.START, seed: ZY.G.mpSeed, mapIdx: ZY.G.mpMap });
          }
        }
        break;
      case MSG.START:
        if (MP.role === 'guest') {
          if (MP.active && ZY.G && ZY.G.scene === 'play') break; // 已在对局中，忽略重复
          if (MP.active) {
            beginGame(m.seed, m.mapIdx);
          } else {
            // 消息早于"进入对局"：缓存，待 startMatch 时使用
            pendingStart = { seed: m.seed, mapIdx: m.mapIdx };
          }
        }
        break;
      case MSG.SNAPSHOT:
        remoteSide = m.side;
        // 快照里带的对局参数：纠正地图/种子（防不一致）
        if (ZY.G && ZY.G.mode === 'pvp' && m.meta) {
          if (ZY.G.mpSeed !== m.meta.seed || ZY.G.mpMap !== m.meta.mapIdx) {
            ZY.Rng.seed(m.meta.seed);
            ZY.Map.pickIndex(m.meta.mapIdx);
            ZY.G.mpSeed = m.meta.seed;
            ZY.G.mpMap = m.meta.mapIdx;
          }
        }
        break;
      case MSG.WAVE:
        if (MP.role === 'guest' && ZY.G && ZY.G.scene === 'play') {
          ZY.Enemies.startWaveRemote(m.wave);
        }
        break;
      case MSG.DEFEAT:
        if (ZY.G && ZY.G.mode === 'pvp' && ZY.G.scene === 'play') {
          // 对方宣布失守：我方胜利
          ZY.G.e.hearts = 0;
          ZY.G.oppResigned = true;
          ZY.Main.matchEnd();
        }
        break;
      case MSG.REMATCH:
        rematch[m.from === 'host' ? 'host' : 'guest'] = m.want;
        if (rematch.host && rematch.guest) {
          if (MP.role === 'host') {
            // 房主重新开局（重新发 START）
            var seed = (Math.random() * 0xFFFFFFFF) >>> 0;
            var mapIdx = (Math.random() * 4) | 0;
            send({ k: MSG.START, seed: seed, mapIdx: mapIdx });
            beginGame(seed, mapIdx);
          }
          rematch = { host: null, guest: null };
        } else {
          ZY.UI.toast('对方想再来一局！');
        }
        break;
      case MSG.PING:
        // 收到对方心跳：保持连接活跃
        break;
      case MSG.CHAT:
        ZY.UI.toast(MP.oppName + '：' + m.text);
        break;
    }
  };

  // ---- 各钩子（游戏逻辑调用）----
  // 房主开波时广播
  MP.onWaveStart = function (wave) {
    if (MP.role === 'host') send({ k: MSG.WAVE, wave: wave });
  };

  // 本地失守
  MP.onLocalDefeat = function () {
    if (ZY.G.scene !== 'play') return;
    send({ k: MSG.DEFEAT });
    ZY.G.p.hearts = 0;
    ZY.Main.matchEnd();
  };

  // 结算界面"再战"按钮
  MP.wantRematch = function () {
    var want = !(rematch[MP.role === 'host' ? 'host' : 'guest']);
    rematch[MP.role === 'host' ? 'host' : 'guest'] = want;
    send({ k: MSG.REMATCH, want: want, from: MP.role });
    if (want) ZY.UI.toast('已请求再战，等待对方…');
    return want;
  };
  MP.rematchState = function () {
    return { my: !!rematch[MP.role === 'host' ? 'host' : 'guest'], opp: !!(MP.role === 'host' ? rematch.guest : rematch.host) };
  };

  // 快捷喊话
  MP.chat = function (text) {
    send({ k: MSG.CHAT, text: text });
  };

  // ---- 帧驱动（main.js 每帧调用）----
  // 镜像 cell key：8列×10行 地图是上下对称的，把对手的 (c, r) 翻到自己的对称位置
  // 这样对手的"我方半场"显示在 guest 的上半屏
  function mirrorKey(k) {
    var cr = k.split('_');
    return (7 - +cr[0]) + '_' + (9 - +cr[1]);
  }
  function mirrorUnits(units) {
    var out = {};
    for (var k in units) {
      var u = units[k];
      var copy = {};
      for (var k2 in u) copy[k2] = u[k2];
      if (u.pairedKey) copy.pairedKey = mirrorKey(u.pairedKey);
      out[mirrorKey(k)] = copy;
    }
    return out;
  }

  MP.update = function (dt) {
    if (!MP.active) return;
    var G = ZY.G;
    if (!G) return;

    // 心跳保活 + 断线检测：每 2s 发送 ping，6s 无任何消息则视作断线
    if (ZY.Net.connected()) {
      pingT -= dt;
      if (pingT <= 0) {
        pingT = 2;
        send({ k: MSG.PING });
      }
      if (Date.now() - lastMsgT > 6000) {
        ZY.UI.toast('与对手连接断开…');
        ZY.Net.close();
        MP.leave();
      }
    } else if (ZY.Net.state() !== 'closed' && ZY.Net.state() !== 'error' && ZY.Net.state() !== 'idle') {
      // 已从 connected 变为非连接状态：可能对端断电/关页（PeerJS close 事件未必触发）
      if (Date.now() - lastMsgT > 6000) {
        ZY.UI.toast('与对手连接断开…');
        MP.leave();
      }
    }

    // 定期发快照（150ms 一次，约 6-7KB/s，DataChannel 足够）
    snapT -= dt;
    if (snapT <= 0) {
      snapT = 0.15;
      if (G.scene === 'play' && ZY.Net.connected()) {
        send({
          k: MSG.SNAPSHOT,
          side: {
            mantou: G.p.mantou,
            hearts: G.p.hearts,
            units: G.p.units,
            bench: G.p.bench,
            hasteT: G.p.hasteT || 0,
            enemyCount: G.enemies.filter(function (e) { return !e.dead && e.side === 'p'; }).length
          },
          meta: { seed: G.mpSeed, mapIdx: G.mpMap, wave: G.wave, scene: G.scene }
        });
      }
    }

    // 应用远端快照到 e 侧（显示层）：单位 cell key 与 pairedKey 需镜像
    if (remoteSide && G.scene === 'play') {
      G.e.mantou = remoteSide.mantou;
      G.e.hearts = remoteSide.hearts;
      G.e.hasteT = remoteSide.hasteT;
      G.e.units = mirrorUnits(remoteSide.units);
      G.e.bench = remoteSide.bench;
    }
  };

  // 断开
  MP.leave = function () {
    MP.active = false;
    MP.role = null;
    remoteSide = null;
    ZY.Rng.reset();
    ZY.Net.close();
  };

  // 开始界面"好友联机"入口
  MP.openLobby = function () {
    ZY.Net.showLobby(function (role) {
      MP.startMatch(role);
    });
  };

  // 模块加载即接管网络消息（不依赖大厅 UI 是否打开过）
  if (ZY.Net && ZY.Net.setHandlers) {
    ZY.Net.setHandlers(MP.onMessage, function () {});
  }

  ZY.MP = MP;
})();

