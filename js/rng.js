// 种子随机数（mulberry32）：联机时双方用同一 seed 生成完全一致的波次队列
// 单机模式走默认随机源，不影响原手感
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var R = {
    // 当前随机源：默认 Math.random
    rand: Math.random,
    // 设置全局种子（联机对局开始时调用）
    seed: function (s) {
      R.rand = mulberry32(s);
      R.curSeed = s;
    },
    // 用独立派生种子创建一个一次性发生器（波次队列等，互不干扰）
    derive: function (s) {
      return mulberry32((s ^ 0x9E3779B9) >>> 0);
    },
    reset: function () { R.rand = Math.random; R.curSeed = null; }
  };

  ZY.Rng = R;
})();

