// 游戏数值配置（对齐原版：刀枪弓骑平行兵种 + 金色武将碎片 + 馒头经济）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof window !== 'undefined') ? window : globalThis;
  var ZY = root.ZY = root.ZY || {};

  var C = {};

  // 四大基础兵种：同字同级二合一升级，等级 1~5
  C.SOLDIERS = {
    '刀': { name: '刀兵', dmg: 16, itv: 0.75, range: 1.35, hp: 120 },
    '枪': { name: '枪兵', dmg: 24, itv: 0.95, range: 1.8,  hp: 110 },
    '弓': { name: '弓兵', dmg: 13, itv: 0.55, range: 3.2,  hp: 80  },
    '骑': { name: '骑兵', dmg: 34, itv: 1.15, range: 1.5,  hp: 150 }
  };
  C.SOLDIER_CHARS = ['刀', '枪', '弓', '骑'];
  C.MAX_LV = 5;
  C.lvMul = function (lv) { return Math.pow(2.1, lv - 1); };

  // 武将：征兵抽到金色单字碎片（不能作战，纯占格），拼齐姓名觉醒
  // 三国版：赵云、马超、关羽、张飞、黄忠、刘备（五虎上将 + 仁主）
  C.FRAG_MAP = {
    '赵': ['赵云', '云'], '云': ['赵云', '赵'],
    '马': ['马超', '超'], '超': ['马超', '马'],
    '关': ['关羽', '羽'], '羽': ['关羽', '关'],
    '张': ['张飞', '飞'], '飞': ['张飞', '张'],
    '黄': ['黄忠', '忠'], '忠': ['黄忠', '黄'],
    '刘': ['刘备', '备'], '备': ['刘备', '刘']
  };
  C.FRAG_CHARS = ['赵', '云', '马', '超', '关', '羽', '张', '飞', '黄', '忠', '刘', '备'];

  // 武将基础数值（已下调，需配武器才能恢复强度）
  // 未装备武器时只有基础攻击；装备武器后伤害+武器加成，攻击特效变为武器造型
  C.GENERALS = {
    '赵云': { dmg: 90,  itv: 0.7,  range: 3.6, skill: 'pierce',  desc: '七进七出·单骑贯穿' },
    '马超': { dmg: 84,  itv: 0.85, range: 3.2, skill: 'pierce',  desc: '西凉铁骑·冲阵贯穿' },
    '关羽': { dmg: 156, itv: 1.3,  range: 2.2, skill: 'execute', desc: '青龙偃月·斩杀残敌' },
    '张飞': { dmg: 72,  itv: 1.2,  range: 1.8, skill: 'stun',    desc: '当阳断喝·震慑群敌' },
    '黄忠': { dmg: 51,  itv: 0.38, range: 4.5, skill: 'snipe',   desc: '百步穿杨·箭无虚发' },
    '刘备': { dmg: 36,  itv: 1.0,  range: 2.6, skill: 'aura',    desc: '仁德·友军攻击+20%' }
  };
  // 6位主角名（用于武器装备绑定）
  C.GENERAL_NAMES = ['赵云', '马超', '关羽', '张飞', '黄忠', '刘备'];

  // 征兵抽取权重（每次征兵直接替换整个备战席为5张随机卡牌，原版机制）
  C.RECRUIT_POOL = [
    { kind: 's', w: 70 },    // 士兵
    { kind: 'f', w: 26 },    // 武将碎片
    { kind: 'shovel', w: 4 } // 铲子道具（可解锁任意绿色 block 格为 build 格）
  ];

  // 敌人（曹军）
  C.ENEMIES = {
    zei:  { ch: '兵', hp: 60,   spd: 1.05, mantou: 2, size: 0.62 },
    dao:  { ch: '卒', hp: 130,  spd: 0.9,  mantou: 3, size: 0.66 },
    kou:  { ch: '将', hp: 280,  spd: 0.75, mantou: 5, size: 0.7  },
    fei:  { ch: '骑', hp: 150,  spd: 1.5,  mantou: 4, size: 0.6  },
    boss: { ch: '曹', hp: 1100, spd: 0.5,  mantou: 30, size: 0.95, boss: true }
  };
  C.hpMul = function (wave) {
    return 1 + (wave - 1) * 0.3 + Math.pow(Math.max(0, wave - 6), 1.5) * 0.12;
  };

  C.ECON = {
    startMantou: 20,
    recruitBase: 10,
    recruitInc: 2,
    hearts: 3,
    benchSize: 5,
    waveBonus: function (w) { return 8 + w * 2; }
  };

  C.LEVEL_NAME = '长坂坡';
  C.MAX_WAVE = 10; // 撑过即判定胜利（若对手先失守则提前胜利）

  // 玩家头像（三国6位主角，程序化绘制人物画像）
  C.AVATARS = ['zhaoyun', 'machao', 'guanyu', 'zhangfei', 'huangzhong', 'liubei'];
  C.AVATAR_LABELS = { zhaoyun: '赵云', machao: '马超', guanyu: '关羽', zhangfei: '张飞', huangzhong: '黄忠', liubei: '刘备' };
  C.AVATAR_DEFAULT = 'zhaoyun';

  // ============ 技能道具（永久保留，永不重置） ============
  // 对齐原版的主动道具：农民/招贤令/陨石/攻速符/神兵符
  C.ITEMS = {
    farmer:   { name: '农民',   ch: '农', color: '#5a8a3a', desc: '上阵产粮：每8秒+2馒头', target: 'cell',   cd: 0 },
    zhaoxian: { name: '招贤令', ch: '贤', color: '#4a8ad4', desc: '免费重抽备战席5张卡',   target: 'none',   cd: 0 },
    meteor:   { name: '陨石',   ch: '陨', color: '#a8402c', desc: '天降陨石：范围内敌军重创（约150伤）', target: 'any', cd: 0 },
    haste:    { name: '攻速符', ch: '速', color: '#a85ef0', desc: '全军攻击速度×2，持续8秒', target: 'none',  cd: 0 },
    shenbing: { name: '神兵符', ch: '神', color: '#e8a23a', desc: '选择一名武将，等级+1（上限Lv5）', target: 'general', cd: 0 }
  };
  C.ITEM_KEYS = ['farmer', 'zhaoxian', 'meteor', 'haste', 'shenbing'];
  // 新玩家初始道具
  C.ITEM_START = { farmer: 2, zhaoxian: 2, meteor: 1, haste: 1, shenbing: 1 };

  // ============ 武器系统 ============
  // 4品质 × 6件 = 24件武器
  C.WEAPON_QUALITY = {
    green:  { name: '凡品', color: '#5aa860', drop: 0.10, fragNeed: 0 },
    blue:   { name: '良品', color: '#4a8ad4', drop: 0.05, fragNeed: 0 },
    purple: { name: '珍品', color: '#a85ef0', drop: 0.02, fragNeed: 3 },
    orange: { name: '神器', color: '#e8a23a', drop: 0.01, fragNeed: 5 }
  };
  C.WEAPON_QUALITY_ORDER = ['green', 'blue', 'purple', 'orange'];

  // 武器列表：每件武器有 id/name/quality/owner(可选,角色名)/dmg(加成)/shape(弹道造型)
  C.WEAPONS = [
    // ===== 橙色神器（6件，主角专属，5碎片合成） =====
    { id: 'longdan',  name: '龙胆亮银枪', quality: 'orange', owner: '赵云', dmg: 90, shape: 'spear',   desc: '常山赵子龙·龙胆亮银' },
    { id: 'shenwei',  name: '虎头湛金枪', quality: 'orange', owner: '马超', dmg: 85, shape: 'spear',   desc: '西凉锦马超·神威虎枪' },
    { id: 'yanyue',   name: '青龙偃月刀', quality: 'orange', owner: '关羽', dmg: 130, shape: 'monkspade', desc: '美髯公关羽·八十二斤' },
    { id: 'zhangba',  name: '丈八蛇矛',   quality: 'orange', owner: '张飞', dmg: 80, shape: 'whip',    desc: '燕人张翼德·万军取首' },
    { id: 'wanshi',   name: '万石宝弓',   quality: 'orange', owner: '黄忠', dmg: 50, shape: 'bow',     desc: '老将黄汉升·宝雕弓' },
    { id: 'shuanggu', name: '双股剑',     quality: 'orange', owner: '刘备', dmg: 40, shape: 'sword',   desc: '昭烈帝刘备·雌雄双剑' },

    // ===== 紫色珍品（6件，3碎片合成） =====
    { id: 'qixing',   name: '七星宝刀',   quality: 'purple', dmg: 65, shape: 'sword',  desc: '司徒王允·斩奸除佞' },
    { id: 'fangtian', name: '方天画戟',   quality: 'purple', dmg: 60, shape: 'spear',  desc: '温侯吕布·辕门射戟' },
    { id: 'qinggang', name: '青釭剑',     quality: 'purple', dmg: 55, shape: 'sword',  desc: '夏侯恩佩·赵云夺之' },
    { id: 'shuangji', name: '双铁戟',     quality: 'purple', dmg: 50, shape: 'axe',   desc: '恶来典韦·古之恶来' },
    { id: 'liannu',   name: '诸葛连弩',   quality: 'purple', dmg: 45, shape: 'bow',   desc: '武侯诸葛·一弩十矢' },
    { id: 'hongying', name: '红缨枪',     quality: 'purple', dmg: 48, shape: 'spear',  desc: '军中利器·红缨如火' },

    // ===== 蓝色良品（5件，成品直接掉落） =====
    { id: 'huanshou', name: '环首刀',   quality: 'blue', dmg: 30, shape: 'sword',  desc: '汉军制式·寒光凛凛' },
    { id: 'tieshe',   name: '铁脊蛇矛', quality: 'blue', dmg: 28, shape: 'spear',  desc: '矛脊如蛇·刚劲有力' },
    { id: 'dahuang',  name: '大黄弩',   quality: 'blue', dmg: 24, shape: 'bow',    desc: '强弩之王·穿杨裂石' },
    { id: 'jinggang', name: '精钢盾',   quality: 'blue', dmg: 22, shape: 'shield', desc: '百炼精钢·坚不可摧' },
    { id: 'hantie',   name: '寒铁刀',   quality: 'blue', dmg: 26, shape: 'knife',  desc: '寒铁铸就·削铁如泥' },

    // ===== 绿色凡品（5件，成品直接掉落） =====
    { id: 'chaidao',  name: '柴刀',   quality: 'green', dmg: 12, shape: 'knife',  desc: '乡野常见·聊胜于无' },
    { id: 'muqiang',  name: '木枪',   quality: 'green', dmg: 14, shape: 'spear',  desc: '白蜡杆制·轻便灵活' },
    { id: 'liegong',  name: '猎弓',   quality: 'green', dmg: 10, shape: 'bow',    desc: '猎户标配·精度尚可' },
    { id: 'mudun',    name: '木盾',   quality: 'green', dmg: 8,  shape: 'shield', desc: '硬木蒙皮·抵御流矢' },
    { id: 'tiefu',    name: '铁斧',   quality: 'green', dmg: 16, shape: 'axe',   desc: '粗铁打造·力大无穷' }
  ];
  C.WEAPON_MAP = {};
  C.WEAPONS.forEach(function (w) { C.WEAPON_MAP[w.id] = w; });

  // 玩家军职（11 级）：每级 5 阶，每阶满 5 星后再通关一次升下一阶
  C.RANKS = [
    '士卒', '伍长', '什长', '都伯', '百人将',
    '军侯', '司马', '都尉', '校尉', '中郎将',
    '大将军'
  ];
  C.SUB_LEVELS = ['一', '二', '三', '四', '五'];
  C.SUB_LEVELS_PER_RANK = 5;
  C.STARS_PER_RANK = 5;

  ZY.C = C;
})();
