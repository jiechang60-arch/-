// UI：开始界面（星级/开始游戏）、对局 HUD（馒头/波次/征兵/备战席）、胜负结算（乌云/卷轴）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R, A = ZY.adapter;

  var UI = {};
  var toasts = [];
  UI.buttons = {};
  // 头像选择弹窗状态
  UI.avatarPickerOpen = false;
  UI.avatarButtons = []; // 弹窗中各头像按钮区域

  // 读取当前头像（持久化，校验合法性）
  UI.currentAvatar = function () {
    var v = A.storageGet('zy_avatar');
    if (v && C.AVATARS.indexOf(v) >= 0) return v;
    return C.AVATAR_DEFAULT;
  };
  UI.setAvatar = function (ch) {
    if (C.AVATARS.indexOf(ch) < 0) return; // 仅接受合法头像
    A.storageSet('zy_avatar', ch);
  };

  UI.toast = function (text) {
    toasts.push({ text: text, t: 0, dur: 1.8 });
    if (toasts.length > 3) toasts.shift();
  };

  UI.update = function (dt) {
    for (var i = toasts.length - 1; i >= 0; i--) {
      toasts[i].t += dt;
      if (toasts[i].t >= toasts[i].dur) toasts.splice(i, 1);
    }
  };

  function drawToasts(ctx) {
    var DW = A.DW;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < toasts.length; i++) {
      var t = toasts[i];
      var alpha = t.t < 0.2 ? t.t / 0.2 : t.t > t.dur - 0.4 ? (t.dur - t.t) / 0.4 : 1;
      ctx.globalAlpha = alpha * 0.95;
      R.font(ctx, 30, true);
      var w = ctx.measureText(t.text).width + 50;
      var y = 300 + i * 56;
      ctx.fillStyle = 'rgba(160,60,40,0.92)';
      R.roundRect(ctx, DW / 2 - w / 2, y - 26, w, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#f7f0dc';
      ctx.fillText(t.text, DW / 2, y + 1);
    }
    ctx.restore();
  }

  // ---- 开始界面 ----
  UI.drawStart = function (ctx) {
    var DW = A.DW, DH = A.DH;
    R.paper(ctx, DW, DH);

    // 顶部：头像框 + 刀币
    ctx.save();
    R.avatar(ctx, 78, 72, 42, UI.currentAvatar(), false);
    // 头像点击区域（圆形按钮）
    UI.buttons.avatar = { x: 36, y: 30, w: 84, h: 84 };
    // 刀币胶囊
    ctx.fillStyle = 'rgba(50,40,28,0.85)';
    R.roundRect(ctx, 140, 44, 240, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#e8c53a';
    ctx.beginPath(); ctx.arc(172, 70, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a10';
    R.font(ctx, 22, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('刀', 172, 71);
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 30, true);
    ctx.fillText(String(A.storageGet('zy_coin') || 0), 290, 71);
    ctx.restore();

    // 标题
    ctx.save();
    R.font(ctx, 84, true);
    ctx.fillStyle = '#a8402c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(60,20,10,0.35)';
    ctx.lineWidth = 3;
    ctx.fillText('赵云与阿斗', DW / 2, DH * 0.18);
    ctx.strokeText('赵云与阿斗', DW / 2, DH * 0.18);
    // 段位（炫彩渐变）
    R.font(ctx, 34, true);
    var prog = ZY.Rank.load();
    var ry = DH * 0.18 + 78;
    var rGrad = ctx.createLinearGradient(DW / 2 - 120, ry, DW / 2 + 120, ry);
    rGrad.addColorStop(0, '#e8c53a');    // 金
    rGrad.addColorStop(0.5, '#e84858');  // 红
    rGrad.addColorStop(1, '#a85ef0');    // 紫
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(60,20,10,0.4)';
    ctx.strokeText(prog.rankName, DW / 2, ry);
    ctx.fillStyle = rGrad;
    ctx.fillText(prog.rankName, DW / 2, ry);
    // 星级
    for (var i = 0; i < C.STARS_PER_RANK; i++) {
      R.star(ctx, DW / 2 - 128 + i * 64, DH * 0.18 + 140, 26, i < prog.stars);
    }
    ctx.restore();

    // 中央装饰阵盘
    ctx.save();
    var by = DH * 0.46, bw = 440, bh = 170;
    var t = ZY.frameTime ? ZY.frameTime() : 0;
    ctx.translate(DW / 2, by);
    ctx.transform(1, 0, -0.28, 0.82, 0, 0); // 透视斜切
    ctx.fillStyle = '#f2eee0';
    R.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = 5;
    R.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 8);
    ctx.stroke();
    for (var gx = 1; gx < 4; gx++) {
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + gx * bw / 4, -bh / 2);
      ctx.lineTo(-bw / 2 + gx * bw / 4, bh / 2);
      ctx.lineWidth = 2; ctx.stroke();
    }
    // 草垫
    ctx.strokeStyle = 'rgba(110,130,90,0.8)';
    ctx.lineWidth = 3;
    for (var g2 = 0; g2 < 40; g2++) {
      var ga = g2 / 40 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ga) * (bw / 2 + 8), Math.sin(ga) * (bh / 2 + 8));
      ctx.lineTo(Math.cos(ga) * (bw / 2 + 26), Math.sin(ga) * (bh / 2 + 20));
      ctx.stroke();
    }
    ctx.restore();
    // 斗字（守将阿斗）：无框 + 左右摆动躲避 + 金箍 + 红心
    var monkX = DW / 2, monkY = by - 26, monkS = 110;
    // 赵云题字（跳动金字牌，放在左下）
    var wukongX = monkX - 140, wukongY = monkY + 96, wukongS = 78;
    // 亮银枪：紧贴赵云右侧，以枪中为锚点耍枪花
    ctx.save();
    var staffCx = wukongX + wukongS / 2, staffCy = wukongY; // 枪中心（紧贴赵云右边）
    var staffHalf = 70; // 半枪长
    // 两端初始位置（竖直），R.staff 内部会以中点为锚旋转
    var staffTailX = staffCx, staffTailY = staffCy + staffHalf;
    var staffHeadX = staffCx, staffHeadY = staffCy - staffHalf;
    // 先画亮银枪，拿到戳刺相位
    var pokePhase = R.staff(ctx, staffTailX, staffTailY, staffHeadX, staffHeadY, t, 1.2);
    // 再画斗字，传入戳刺相位让它摆动躲避
    R.monk(ctx, monkX, monkY, monkS, 3, 3, false, t, pokePhase);
    // 赵云题字
    R.livingTile(ctx, wukongX, wukongY, wukongS, '赵云', 'general', t);
    ctx.restore();

    // 开始按钮
    UI.buttons.start = { x: DW / 2 - 190, y: DH * 0.68, w: 380, h: 108, label: '开始游戏 ⚡', fs: 44 };
    R.redButton(ctx, UI.buttons.start);
    // 交叉双剑装饰
    ctx.save();
    ctx.translate(DW / 2, DH * 0.68 - 34);
    R.font(ctx, 52, false);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a6a78';
    ctx.fillText('⚔', 0, 0);
    ctx.restore();

    // 好友联机入口按钮（左下，与兵器库对称）
    UI.buttons.online = { x: 70, y: DH - 176, w: 180, h: 56, label: '好友联机 ⇄', fs: 28 };
    R.redButton(ctx, UI.buttons.online);

    // 武器库入口按钮（右下角，上移100左移50）
    UI.buttons.weaponLib = { x: DW - 250, y: DH - 176, w: 180, h: 56, label: '兵器库 ⚔', fs: 28 };
    R.redButton(ctx, UI.buttons.weaponLib);

    // 本版本的核心规则：开局不消耗体力，库存与穿戴永久保留。
    ctx.save();
    R.font(ctx, 22, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6a5c42';
    ctx.fillText('不限体力 · 随时开局　｜　道具永久保留 · 可自由替换', DW / 2, DH - 94);
    ctx.restore();

    var bestWave = parseInt(A.storageGet('zy_best') || '0', 10);
    if (bestWave > 0) {
      ctx.save();
      R.font(ctx, 26, false);
      ctx.fillStyle = '#6a5c42';
      ctx.textAlign = 'center';
      ctx.fillText('最佳战绩：第 ' + bestWave + ' 波', DW / 2, DH * 0.68 + 150);
      ctx.restore();
    }
    drawToasts(ctx);
    // 头像选择弹窗（覆盖在最上层）
    if (UI.avatarPickerOpen) UI.drawAvatarPicker(ctx);
  };

  // 头像选择弹窗：5个人物头像横排，点击切换头像
  UI.drawAvatarPicker = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    // 半透明遮罩
    ctx.fillStyle = 'rgba(30,26,20,0.7)';
    ctx.fillRect(0, 0, DW, DH);
    // 弹窗面板
    var n = C.AVATARS.length, ar = 60, gap = 28;
    var gridW = n * (ar * 2) + (n - 1) * gap;
    var pw = gridW + 80, ph = 320;
    var px = (DW - pw) / 2, py = (DH - ph) / 2;
    ctx.fillStyle = '#f4f0e4';
    R.roundRect(ctx, px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = 5;
    R.roundRect(ctx, px, py, pw, ph, 16);
    ctx.stroke();
    // 标题
    R.font(ctx, 36, true);
    ctx.fillStyle = '#5a4a34';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择头像', DW / 2, py + 48);
    // 5 个人物头像横排
    var startX = (DW - gridW) / 2 + ar;
    var cy = py + 160;
    var cur = UI.currentAvatar();
    UI.avatarButtons = [];
    for (var i = 0; i < n; i++) {
      var cx = startX + i * (ar * 2 + gap);
      var sel = (C.AVATARS[i] === cur);
      R.avatar(ctx, cx, cy, ar, C.AVATARS[i], sel);
      // 名称标签
      R.font(ctx, 24, true);
      ctx.fillStyle = sel ? '#b8860b' : '#6a5c42';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(C.AVATAR_LABELS[C.AVATARS[i]], cx, cy + ar + 24);
      UI.avatarButtons.push({ x: cx - ar, y: cy - ar, w: ar * 2, h: ar * 2, ch: C.AVATARS[i] });
    }
    ctx.restore();
  };

  // ---- 对局 HUD ----
  UI.drawHUD = function (ctx) {
    var G = ZY.G, L = ZY.L, DW = A.DW;

    // 暂停墨团
    ctx.save();
    ctx.fillStyle = 'rgba(40,34,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(66, 48, 34, 26, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    ctx.fillRect(56, 36, 7, 24);
    ctx.fillRect(70, 36, 7, 24);
    ctx.restore();
    UI.buttons.pause = { x: 30, y: 20, w: 74, h: 58 };

    // 馒头计数
    ctx.save();
    ctx.strokeStyle = 'rgba(40,34,26,0.9)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.quadraticCurveTo(110, 92, 190, 100);
    ctx.stroke();
    R.bun(ctx, 70, 96, 22);
    R.font(ctx, 34, true);
    ctx.fillStyle = '#28221a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(G.p.mantou), 104, 98);
    ctx.restore();

    // 关卡名 + 波次
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    R.font(ctx, 44, true);
    ctx.fillStyle = '#8a3a28';
    ctx.fillText(C.LEVEL_NAME, DW / 2, 44);
    ctx.fillStyle = 'rgba(40,34,26,0.88)';
    R.roundRect(ctx, DW / 2 - 66, 66, 132, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 26, true);
    ctx.fillText('第' + Math.max(1, G.wave) + '波', DW / 2, 87);
    ctx.restore();

    // 音效开关
    ctx.save();
    R.font(ctx, 30, true);
    ctx.fillStyle = 'rgba(40,34,26,0.8)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZY.sfxEnabled() ? '♪' : '×', DW - 46, 46);
    ctx.restore();
    UI.buttons.sound = { x: DW - 76, y: 20, w: 60, h: 52 };

    // 波次间隔提示
    if (G.waveState === 'idle' || G.waveState === 'cleared') {
      ctx.save();
      R.font(ctx, 28, true);
      ctx.fillStyle = 'rgba(90,50,36,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('敌军将至 ' + Math.max(0, G.restTimer).toFixed(1) + 's', DW / 2, L.mapY + L.cell * 5);
      ctx.restore();
    }

    // 备战席
    ctx.save();
    R.hut(ctx, L.benchX - 62, L.benchY + 6, 74);
    for (var i = 0; i < C.ECON.benchSize; i++) {
      var p = ZY.Board.benchSlotCenter(i);
      ctx.fillStyle = '#f4f0e4';
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,118,96,0.8)';
      ctx.lineWidth = 2;
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.stroke();
      var u = G.p.bench[i];
      var dg = ZY.Board.dragging();
      if (u && !(dg && dg.moved && dg.from.type === 'bench' && dg.from.idx === i)) {
        ZY.Board.drawUnit(ctx, u, p.x, p.y, L.benchSlot - 10, 1);
      }
    }
    ctx.restore();

    // 征兵按钮
    var rb = UI.buttons.recruit = {
      x: DW / 2 - 140, y: L.btnY, w: 280, h: 96,
      label: '征兵', fs: 40, bun: ZY.Board.recruitCost(G.p)
    };
    rb.disabled = G.p.mantou < rb.bun;
    R.redButton(ctx, rb);

    // 主动道具栏（征兵按钮左侧；被动道具在顶部单独显示）
    UI.itemButtons = [];
    if (ZY.Items) {
      var keys = C.ITEM_ACTIVE_KEYS;
      var ibW = 64, ibH = 68, ibGap = 10;
      var ibX = 16, ibY = L.btnY + 12;
      for (var ik = 0; ik < keys.length; ik++) {
        var id = keys[ik];
        var cfg = C.ITEMS[id];
        var cnt = ZY.Items.count(id);
        var bx = ibX, by = ibY + ik * (ibH + ibGap) - 40;
        // 底牌
        ctx.save();
        ctx.fillStyle = cnt > 0 ? 'rgba(58,49,38,0.92)' : 'rgba(120,110,90,0.35)';
        R.roundRect(ctx, bx, by, ibW, ibH, 8);
        ctx.fill();
        ctx.strokeStyle = cnt > 0 ? cfg.color : 'rgba(80,70,60,0.4)';
        ctx.lineWidth = 2;
        R.roundRect(ctx, bx, by, ibW, ibH, 8);
        ctx.stroke();
        // 名称（竖排小字）
        ctx.fillStyle = cnt > 0 ? '#f2ead2' : '#9a8a70';
        R.font(ctx, 17, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.name.slice(0, 3), bx + ibW / 2, by + 18);
        // 数量角标
        ctx.fillStyle = cnt > 0 ? cfg.color : '#9a8a70';
        R.font(ctx, 20, true);
        ctx.fillText('×' + cnt, bx + ibW / 2, by + 48);
        ctx.restore();
        UI.itemButtons.push({ x: bx, y: by, w: ibW, h: ibH, item: id });
      }
      // 被动农民状态：持有即生效，不需要点击且不会消耗。
      var farmerN = ZY.Items.count('farmer');
      if (farmerN > 0) {
        var remain = G.p && typeof G.p.farmerSpawnT === 'number' ? Math.max(0, G.p.farmerSpawnT) : C.ITEM_PASSIVE_CFG.farmer.spawnCD;
        ctx.save();
        ctx.fillStyle = 'rgba(55,86,42,0.9)';
        R.roundRect(ctx, 18, 154, 142, 42, 8); ctx.fill();
        ctx.fillStyle = '#f2ead2';
        R.font(ctx, 18, true);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('被动·农民 ×' + farmerN + '　' + Math.ceil(remain) + 's', 89, 175);
        ctx.restore();
      }
      // 瞄准模式提示
      if (ZY.Items.pending) {
        ctx.save();
        R.font(ctx, 22, true);
        ctx.fillStyle = '#a8402c';
        ctx.textAlign = 'center';
        ctx.fillText('【' + C.ITEMS[ZY.Items.pending].name + '】点击目标生效', DW / 2, L.mapY + L.cell * 5 - 40);
        ctx.restore();
      }
    }

    // PvP 联机状态（对手名字 + 连接状态 + 对方红心）
    if (G.mode === 'pvp' && ZY.MP) {
      ctx.save();
      var st = ZY.Net.state();
      var stTxt = st === 'connected' ? '● 联机中' : '○ 重连中';
      ctx.fillStyle = st === 'connected' ? 'rgba(42,122,58,0.85)' : 'rgba(160,60,40,0.85)';
      R.roundRect(ctx, DW - 150, 96, 134, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#f2ead2';
      R.font(ctx, 19, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stTxt, DW - 83, 114);
      // 对方红心
      ctx.fillStyle = '#5a4a34';
      R.font(ctx, 21, true);
      ctx.textAlign = 'left';
      ctx.fillText('敌', 12, 30);
      for (var eh = 0; eh < C.ECON.hearts; eh++) {
        R.heart(ctx, 44 + eh * 26, 30, 11, eh < G.e.hearts);
      }
      ctx.restore();
    }

    drawToasts(ctx);

    // 拖拽幽灵（画在 y-40，放置判定也用 y-40，保持一致）
    var d = ZY.Board.dragging();
    if (d && d.moved) {
      ZY.Board.drawUnit(ctx, d.unit, d.x, d.y - 40, L.cell + 10, 0.92);
      // 拖铲子时高亮所有可铲 block 格（玩家侧所有绿格）
      if (d.unit.kind === 'shovel') {
        for (var uc = 0; uc < ZY.Map.COLS; uc++) {
          for (var ur = 0; ur < ZY.Map.ROWS; ur++) {
            if (ZY.Map.isUnlockable(uc, ur, 'p')) {
              var upc = ZY.Map.cellCenter(uc, ur);
              ctx.save();
              ctx.strokeStyle = '#c9922e';
              ctx.lineWidth = 3;
              ctx.setLineDash([6, 4]);
              R.roundRect(ctx, upc.x - L.cell / 2 + 2, upc.y - L.cell / 2 + 2, L.cell - 4, L.cell - 4, 8);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }
        }
      } else {
        // 普通单位：高亮可放置格（用 buildCellAt 与放置判定一致）
        var cell = ZY.Map.buildCellAt(d.x, d.y - 40, 'p');
        if (cell) {
          var k = cell.c + '_' + cell.r;
          var t = G.p.units[k];
          var ok = !t || ZY.Board.tryMerge(d.unit, t) || !(t.kind === 'g' && t.half != null);
          var pc = ZY.Map.cellCenter(cell.c, cell.r);
          ctx.save();
          ctx.strokeStyle = ok ? '#c9922e' : 'rgba(160,60,40,0.8)';
          ctx.lineWidth = 4;
          R.roundRect(ctx, pc.x - L.cell / 2 + 2, pc.y - L.cell / 2 + 2, L.cell - 4, L.cell - 4, 8);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  // ---- 结算 ----
  UI.drawOver = function (ctx, win) {
    var G = ZY.G, DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = win ? 'rgba(214,205,182,0.96)' : 'rgba(176,186,196,0.96)';
    ctx.fillRect(0, 0, DW, DH);

    // 乌云/彩云横幅
    R.cloud(ctx, DW / 2, DH * 0.16, 340, 90, win ? '#b08a3e' : '#5a6068');
    R.font(ctx, 60, true);
    ctx.fillStyle = '#f5f0e2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(win ? '胜利' : '失败', DW / 2, DH * 0.16);

    // 卷轴 + 段位星级
    R.scroll(ctx, DW / 2, DH * 0.32, 400, 110);
    var prog = ZY.Rank.load();
    R.font(ctx, 30, true);
    ctx.fillStyle = '#e8dfc8';
    var maxed = ZY.Rank.isMaxed(prog);
    ctx.fillText(prog.rankName + (maxed ? '' : ' · ' + prog.stars + '/' + C.STARS_PER_RANK), DW / 2, DH * 0.32 - 26);
    var starShow = prog.stars;
    for (var i = 0; i < C.STARS_PER_RANK; i++) {
      R.star(ctx, DW / 2 - 128 + i * 64, DH * 0.32 + 18, 24, i < starShow);
    }
    // 晋升提示
    if (win && G.rankPromote && G.rankPromote.promoted) {
      ctx.fillStyle = '#e8c53a';
      R.font(ctx, 28, true);
      ctx.fillText('晋升！' + G.rankPromote.newRankName, DW / 2, DH * 0.32 + 56);
    }

    // 守将与贼群
    var ay = DH * 0.5;
    ctx.fillStyle = 'rgba(200,200,205,0.6)';
    ctx.beginPath();
    ctx.ellipse(DW / 2, ay + 20, 220, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    R.adou(ctx, DW / 2, ay, 84, Math.max(0, G.p.hearts), C.ECON.hearts, !win);
    if (!win) {
      var zs = [[-150, -20], [-90, 40], [90, 40], [150, -16], [0, 66]];
      for (var z = 0; z < zs.length; z++) {
        R.mahjong(ctx, DW / 2 + zs[z][0], ay + zs[z][1], 52, '贼', {});
      }
    }

    // 战利品
    ctx.fillStyle = '#e8c53a';
    ctx.beginPath();
    ctx.arc(DW / 2 - 40, DH * 0.63, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a10';
    R.font(ctx, 24, true);
    ctx.fillText('刀', DW / 2 - 40, DH * 0.63 + 1);
    ctx.fillStyle = '#3a3126';
    R.font(ctx, 40, true);
    ctx.textAlign = 'left';
    ctx.fillText('X' + G.coinReward, DW / 2 - 4, DH * 0.63 + 2);
    ctx.restore();

    UI.buttons.again = { x: DW / 2 - 180, y: DH * 0.70, w: 360, h: 92, label: '再 战', fs: 38 };
    if (G.mode === 'pvp' && ZY.MP) {
      var rs = ZY.MP.rematchState();
      UI.buttons.again.label = rs.my ? '等待对方…' : '再 战 一 局';
      if (rs.opp && !rs.my) UI.buttons.again.label = '对方想再战！';
      var stTxt = rs.my ? '等待 ' + (ZY.MP.oppName || '对手') + ' 确认…' : '与好友再战一局';
      ctx.save();
      R.font(ctx, 24, true);
      ctx.fillStyle = '#5a4a34';
      ctx.textAlign = 'center';
      ctx.fillText(stTxt, DW / 2, DH * 0.70 + 108);
      ctx.restore();
    }
    R.redButton(ctx, UI.buttons.again);
    UI.buttons.claim = { x: DW / 2 - 150, y: DH * 0.70 + 124, w: 300, h: 80, label: '领 取', fs: 32 };
    R.darkButton(ctx, UI.buttons.claim);
  };

  // ---- 暂停 ----
  UI.drawPause = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.6)';
    ctx.fillRect(0, 0, DW, DH);
    R.font(ctx, 56, true);
    ctx.fillStyle = '#f2ead2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂停中', DW / 2, DH * 0.4);
    ctx.restore();
    UI.buttons.resume = { x: DW / 2 - 160, y: DH * 0.5, w: 320, h: 96, label: '继续', fs: 40 };
    R.redButton(ctx, UI.buttons.resume);
    UI.buttons.home = { x: DW / 2 - 160, y: DH * 0.5 + 120, w: 320, h: 96, label: '返回首页', fs: 40 };
    R.darkButton(ctx, UI.buttons.home);
  };

  // ============ 武器库 ============
  // 武器库界面：顶部6角色装备槽 + 中间4品质武器列表 + 拖拽穿戴
  UI.weaponSlots = [];      // 角色装备槽区域 [{x,y,w,h,name}]
  UI.weaponItems = [];      // 武器列表项区域 [{x,y,w,h,wid,kind:'owned'|'frag'}]
  UI.weaponCraftBtns = [];  // 可合成武器的合成按钮 [{x,y,w,h,wid}]
  UI.weaponDrag = null;     // 拖拽中的武器 {wid,x,y}
  UI.weaponScroll = 0;      // 列表滚动偏移（暂未实现滚动，预留）

  UI.drawWeaponLib = function (ctx) {
    var DW = A.DW, DH = A.DH;
    var W = ZY.Weapon, C2 = C;
    R.paper(ctx, DW, DH);

    // 顶部标题 + 返回
    ctx.save();
    R.font(ctx, 48, true);
    ctx.fillStyle = '#8a3a28';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('兵器库', DW / 2, 60);
    R.font(ctx, 18, false);
    ctx.fillStyle = '#6a5c42';
    ctx.fillText('永久收藏 · 拖入槽位即可替换，旧武器自动回库', DW / 2, 92);
    ctx.restore();
    UI.buttons.wlibBack = { x: 20, y: 28, w: 110, h: 56, label: '返回', fs: 28 };
    R.darkButton(ctx, UI.buttons.wlibBack);

    // ===== 顶部5角色装备槽 =====
    UI.weaponSlots = [];
    var slotCount = C2.GENERAL_NAMES.length;
    var slotGap = 8;
    var slotW = Math.floor((DW - 36 - (slotCount - 1) * slotGap) / slotCount), slotH = 130;
    var slotsW = slotCount * slotW + (slotCount - 1) * slotGap;
    var slotStartX = (DW - slotsW) / 2;
    var slotY = 110;
    ctx.save();
    R.font(ctx, 24, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < C2.GENERAL_NAMES.length; i++) {
      var name = C2.GENERAL_NAMES[i];
      var sx = slotStartX + i * (slotW + slotGap);
      // 槽位底框
      ctx.fillStyle = 'rgba(60,50,40,0.12)';
      R.roundRect(ctx, sx, slotY, slotW, slotH, 10); ctx.fill();
      ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 2;
      R.roundRect(ctx, sx, slotY, slotW, slotH, 10); ctx.stroke();
      // 角色名
      ctx.fillStyle = '#5a4a30';
      R.font(ctx, 26, true);
      ctx.fillText(name, sx + slotW / 2, slotY + 22);
      // 当前装备的武器
      var eq = W.equipped(name);
      if (eq) {
        var qCfg = C2.WEAPON_QUALITY[eq.quality];
        // 武器图标方块
        ctx.fillStyle = qCfg.color;
        R.roundRect(ctx, sx + 14, slotY + 42, slotW - 28, 40, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        R.font(ctx, 20, true);
        ctx.fillText(eq.name, sx + slotW / 2, slotY + 62);
        // 加成
        ctx.fillStyle = '#6a5c42';
        R.font(ctx, 18, false);
        ctx.fillText('+' + eq.dmg + ' 攻击', sx + slotW / 2, slotY + 100);
        // 卸下提示
        ctx.fillStyle = '#a04848';
        R.font(ctx, 16, false);
        ctx.fillText('点击卸下', sx + slotW / 2, slotY + 118);
      } else {
        ctx.fillStyle = '#9a8a70';
        R.font(ctx, 18, false);
        ctx.fillText('未装备', sx + slotW / 2, slotY + 70);
        ctx.fillText('拖武器到此', sx + slotW / 2, slotY + 100);
      }
      UI.weaponSlots.push({ x: sx, y: slotY, w: slotW, h: slotH, name: name });
    }
    ctx.restore();

    // ===== 中间武器列表（按品质分组） =====
    UI.weaponItems = [];
    UI.weaponCraftBtns = [];
    var listY = slotY + slotH + 24;
    var itemW = 160, itemH = 90, itemGap = 10;
    var perRow = Math.floor((DW - 32) / (itemW + itemGap));
    var rowY = listY;

    ctx.save();
    C2.WEAPON_QUALITY_ORDER.forEach(function (qkey) {
      var qCfg = C2.WEAPON_QUALITY[qkey];
      // 品质标题
      ctx.fillStyle = qCfg.color;
      R.font(ctx, 28, true);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('● ' + qCfg.name + '（' + (qCfg.fragNeed > 0 ? qCfg.fragNeed + '碎片合成' : '成品掉落') + ' · 掉率' + (qCfg.drop * 100) + '%）', 24, rowY + 14);
      rowY += 34;
      // 该品质所有武器
      var pool = C2.WEAPONS.filter(function (w) { return w.quality === qkey; });
      var col = 0;
      for (var wi = 0; wi < pool.length; wi++) {
        var wp = pool[wi];
        var owns = W.owns(wp.id);
        var fragN = W.fragCount(wp.id);
        var need = qCfg.fragNeed;
        var x = 24 + col * (itemW + itemGap);
        var y = rowY;
        // 卡片底
        if (owns) {
          ctx.fillStyle = qCfg.color;
        } else if (need > 0 && fragN > 0) {
          ctx.fillStyle = 'rgba(120,110,90,0.25)';
        } else {
          ctx.fillStyle = 'rgba(120,110,90,0.12)';
        }
        R.roundRect(ctx, x, y, itemW, itemH, 8); ctx.fill();
        ctx.strokeStyle = owns ? qCfg.color : 'rgba(80,70,60,0.4)';
        ctx.lineWidth = owns ? 2 : 1;
        R.roundRect(ctx, x, y, itemW, itemH, 8); ctx.stroke();
        // 名称
        ctx.fillStyle = owns ? '#fff' : (fragN > 0 ? '#5a4a30' : '#9a8a70');
        R.font(ctx, 22, true);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(wp.name, x + itemW / 2, y + 24);
        // owner 限定标识
        if (wp.owner) {
          ctx.fillStyle = owns ? '#fff' : '#9a8a70';
          R.font(ctx, 16, false);
          ctx.fillText('【' + wp.owner + '专属】', x + itemW / 2, y + 46);
        }
        // 状态/碎片进度
        if (owns) {
          ctx.fillStyle = '#fff';
          R.font(ctx, 18, true);
          ctx.fillText('+' + wp.dmg + ' 攻', x + itemW / 2, y + 70);
          UI.weaponItems.push({ x: x, y: y, w: itemW, h: itemH, wid: wp.id, kind: 'owned' });
        } else if (need > 0) {
          ctx.fillStyle = fragN > 0 ? '#5a4a30' : '#9a8a70';
          R.font(ctx, 18, false);
          ctx.fillText(fragN + '/' + need + ' 碎片', x + itemW / 2, y + 70);
          // 可合成：合成按钮
          if (fragN >= need) {
            var cbX = x + itemW / 2 - 40, cbY = y + itemH - 8;
            UI.weaponCraftBtns.push({ x: cbX, y: cbY - 26, w: 80, h: 24, wid: wp.id });
          }
        } else {
          ctx.fillStyle = '#9a8a70';
          R.font(ctx, 16, false);
          ctx.fillText('未拥有', x + itemW / 2, y + 70);
        }
        col++;
        if (col >= perRow) { col = 0; rowY += itemH + 12; }
      }
      if (col > 0) rowY += itemH + 12;
      rowY += 8;
    });
    ctx.restore();

    // 合成按钮（画在最后，确保在最上层）
    ctx.save();
    UI.weaponCraftBtns.forEach(function (cb) {
      ctx.fillStyle = '#e8a23a';
      R.roundRect(ctx, cb.x, cb.y, cb.w, cb.h, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      R.font(ctx, 18, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('合成', cb.x + cb.w / 2, cb.y + cb.h / 2);
    });
    ctx.restore();

    // 拖拽中的武器幽灵
    if (UI.weaponDrag) {
      var wd = C2.WEAPON_MAP[UI.weaponDrag.wid];
      var qC = C2.WEAPON_QUALITY[wd.quality];
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = qC.color;
      R.roundRect(ctx, UI.weaponDrag.x - 50, UI.weaponDrag.y - 22, 100, 44, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      R.font(ctx, 20, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(wd.name, UI.weaponDrag.x, UI.weaponDrag.y);
      ctx.restore();
    }

    drawToasts(ctx);
  };

  ZY.UI = UI;
})();

