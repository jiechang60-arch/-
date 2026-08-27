// 联机：PeerJS（WebRTC DataChannel）封装
// 房主以 "ZYAD-<房间码>" 注册在公共信令服务器；挑战者连接该 ID
// 断线重连：双方各自记录房间码，重连后由房主发送完整快照
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var NET = {};
  var peer = null, conn = null;
  var role = null;          // 'host' | 'guest'
  var roomCode = null;      // 6位房间码
  var onMessage = null;     // 由 mp.js 注入
  var onStateChange = null; // 状态回调（ lobby->connecting->connected->closed ）
  var state = 'idle';       // idle | registering | hosting | connecting | connected | closed | error
  var lastError = '';

  // 免费信令 + STUN + 公益 TURN 兜底（严格 NAT 时经 TURN 中继）
  // STUN 含国内可达节点（小米/洋葱），提升跨省直连成功率
  var ICE = {
    iceServers: [
      { urls: 'stun:stun.miwifi.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  function setState(s) {
    state = s;
    if (onStateChange) onStateChange(s, role, roomCode);
  }
  NET.state = function () { return state; };
  NET.role = function () { return role; };
  NET.roomCode = function () { return roomCode; };
  NET.connected = function () { return !!(conn && conn.open); };
  NET.lastError = function () { return lastError; };

  function peerId(code) { return 'ZYAD-' + code; }

  function genCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }
  NET.genCode = genCode;

  function wireConn(c) {
    conn = c;
    c.on('open', function () {
      setState('connected');
    });
    c.on('data', function (d) {
      if (onMessage) onMessage(d);
    });
    c.on('close', function () {
      if (conn === c) { conn = null; setState('closed'); }
    });
    c.on('error', function (err) {
      if (conn === c) { conn = null; lastError = (err && err.type) || 'datachannel-error'; setState('error'); }
    });
  }

  // ---- 房主 ----
  NET.host = function () {
    if (typeof Peer === 'undefined') {
      setState('error');
      return false;
    }
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    roomCode = genCode();
    role = 'host';
    lastError = '';
    setState('registering');
    peer = new Peer(peerId(roomCode), { config: ICE });
    peer.on('open', function () {
      setState('hosting'); // 信令已确认注册后才展示房间码
    });
    peer.on('connection', function (c) {
      if (conn && conn.open) { try { c.close(); } catch (e) {} return; } // 已有对手
      wireConn(c);
    });
    peer.on('error', function (err) {
      if (err && err.type === 'unavailable-id') {
        // 房间码撞车：换码重试
        try { peer.destroy(); } catch (e) {}
        setTimeout(function () { NET.host(); }, 200);
        return;
      }
      lastError = (err && err.type) || 'signal-error';
      setState('error');
    });
    return true;
  };

  // ---- 挑战者 ----
  NET.join = function (code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) return { ok: false, msg: '房间码格式不对（6位字母/数字）' };
    if (typeof Peer === 'undefined') return { ok: false, msg: '联机组件未加载' };
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    roomCode = code;
    role = 'guest';
    lastError = '';
    setState('connecting');
    peer = new Peer({ config: ICE });
    peer.on('open', function () {
      var attempts = 0;
      function connectAttempt() {
        attempts++;
        var c = peer.connect(peerId(code), { reliable: true, serialization: 'json' });
        wireConn(c);
        c.on('error', function (err) {
          // 房主刚创建时可能仍在信令注册，短暂重试可避免“房间不存在”误报。
          if (!c.open && attempts < 4 && err && (err.type === 'peer-unavailable' || err.type === 'network')) {
            setTimeout(connectAttempt, 1200);
          }
        });
      }
      connectAttempt();
      // 连接超时：25秒（移动网络/TURN 建链比局域网更慢）
      setTimeout(function () {
        if (!conn || !conn.open) {
          lastError = 'timeout';
          setState('error');
          if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
        }
      }, 25000);
    });
    peer.on('error', function (err) {
      lastError = (err && err.type) || 'signal-error';
      setState('error');
    });
    return { ok: true };
  };

  NET.send = function (msg) {
    if (conn && conn.open) {
      try { conn.send(msg); return true; } catch (e) {}
    }
    return false;
  };

  NET.close = function () {
    if (conn) { try { conn.close(); } catch (e) {} conn = null; }
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    role = null; roomCode = null;
    setState('idle');
  };

  // ---- 大厅 DOM UI（覆盖在 canvas 上，简洁主题风格）----
  // 用普通 DOM 实现：文字输入在 canvas 里太繁琐
  var lobbyEl = null;
  NET.setHandlers = function (onMsg, onState) { onMessage = onMsg; onStateChange = onState; };

  function h(tag, attrs, text) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') el.style.cssText = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    if (text != null) el.textContent = text;
    return el;
  }

  NET.showLobby = function (onStart) {
    if (lobbyEl) return;
    var backdrop = h('div', { style:
      'position:fixed;inset:0;background:rgba(24,20,14,0.72);display:flex;' +
      'align-items:center;justify-content:center;z-index:50;font-family:sans-serif;'
    });
    var panel = h('div', { style:
      'background:#f4f0e4;border:3px solid #3a3126;border-radius:14px;' +
      'padding:28px 32px;width:min(92vw,420px);box-shadow:0 12px 40px rgba(0,0,0,0.4);'
    });
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    lobbyEl = backdrop;

    var status = h('div', { style: 'min-height:40px;margin:14px 0;color:#5a4a34;font-size:15px;text-align:center;' }, '');
    var codeInput = h('input', { style:
      'width:100%;box-sizing:border-box;padding:12px;font-size:22px;letter-spacing:6px;' +
      'text-align:center;border:2px solid #8a6a40;border-radius:8px;background:#fff;' +
      'text-transform:uppercase;font-family:monospace;',
      maxlength: '6', placeholder: '输入6位房间码' });

    function refresh() {
      status.textContent = statusText();
      codeInput.style.display = (role === null || state === 'idle' || state === 'error') ? '' : 'none';
      joinBtn.style.display = (role === null || state === 'idle' || state === 'error') ? '' : 'none';
      hostBtn.style.display = (role === null || state === 'idle' || state === 'error') ? '' : 'none';
      codeShow.style.display = (state === 'hosting') ? '' : 'none';
      leaveBtn.style.display = (state !== 'idle' && state !== 'error') ? '' : 'none';
      // 连接成功后显示进入对局按钮
      enterBtn.style.display = (state === 'connected') ? '' : 'none';
    }

    var codeShow = h('div', { style:
      'display:none;text-align:center;margin:10px 0;' });
    var codeBig = h('div', { style:
      'font-size:34px;font-weight:800;letter-spacing:8px;color:#a8402c;font-family:monospace;' });
    var codeTip = h('div', { style: 'color:#8a6a40;font-size:13px;margin-top:6px;' }, '把房间码发给好友，等 TA 点击加入');
    codeShow.appendChild(codeBig); codeShow.appendChild(codeTip);

    var hostBtn = h('button', { style: btnStyle('#a8402c'), onclick: function () {
      NET.host(); refresh();
    }}, '创建房间（房主）');
    var joinBtn = h('button', { style: btnStyle('#4a8ad4'), onclick: function () {
      var r = NET.join(codeInput.value);
      if (!r.ok) { status.textContent = r.msg; return; }
      refresh();
    }}, '加入房间');
    var leaveBtn = h('button', { style: btnStyle('#8a6a40'), onclick: function () {
      NET.close(); refresh();
    }}, '退出房间');
    var enterBtn = h('button', { style: btnStyle('#2a7a3a'), onclick: function () {
      backdrop.remove(); lobbyEl = null;
      if (onStart) onStart(role);
    }}, '进入对局 ⚔');

    function statusText() {
      if (state === 'registering') return '正在发布房间，请稍候…';
      if (state === 'hosting') { codeBig.textContent = roomCode; return '房间已创建，等待好友加入…'; }
      if (state === 'connecting') return '正在连接房间 ' + roomCode + ' …';
      if (state === 'connected') return role === 'host' ? '好友已连上！' : '已连上房间！';
      if (state === 'closed') return '连接已断开（可重新创建/加入）';
      if (state === 'error') return '连接失败（' + (lastError || '网络') + '），请确认房主仍在房间后重试';
      return '选择创建或加入房间';
    }

    function btnStyle(bg) {
      return 'display:block;width:100%;margin:8px 0;padding:12px 0;font-size:17px;' +
        'color:#fff;background:' + bg + ';border:none;border-radius:8px;cursor:pointer;font-weight:600;';
    }

    var title = h('div', { style:
      'text-align:center;font-size:24px;font-weight:800;color:#3a3126;margin-bottom:4px;' }, '好友联机');
    var sub = h('div', { style:
      'text-align:center;color:#8a6a40;font-size:13px;margin-bottom:12px;' },
      '与好友各守半场，先失守者败');
    var close = h('div', { style:
      'position:absolute;top:10px;right:16px;font-size:22px;color:#8a6a40;cursor:pointer;', onclick: function () {
      // 关闭大厅不退出连接：进行中的房间保留
      backdrop.remove(); lobbyEl = null;
    }}, '×');
    panel.style.position = 'relative';
    panel.appendChild(close);

    panel.appendChild(title); panel.appendChild(sub);
    panel.appendChild(hostBtn);
    panel.appendChild(codeShow);
    panel.appendChild(codeInput);
    panel.appendChild(joinBtn);
    panel.appendChild(status);
    panel.appendChild(enterBtn);
    panel.appendChild(leaveBtn);

    // 状态变化时自动刷新 UI
    var prevOnState = onStateChange;
    onStateChange = function (s, r, code) {
      if (prevOnState) prevOnState(s, r, code);
      refresh();
    };

    refresh();
  };

  NET.closeLobby = function () {
    if (lobbyEl) { lobbyEl.remove(); lobbyEl = null; }
  };

  ZY.Net = NET;
})();

