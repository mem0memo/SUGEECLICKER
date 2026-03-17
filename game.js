// 数値フォーマット
function fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    n = Math.floor(n);
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

// ゲーム状態
const GameState = {
    tokens: 0,
    totalTokensEarned: 0,
    clickValue: 1,
    perSecond: 0,
    purchaseCount: 0,
    entrepreneurLevel: 1,
    buildings: {},
    cryptos: {},
    productionHistory: [0],
    unlockedAchievements: [],
    cryptoTrends: {},  // { [id]: { trend, duration } }
};

let tick = 0;

// ===== 施設定義（9種）=====
// 流れ: 農業 → SNS → 健康 → 宇宙 → ブログ → メルマガ → メディア → 夜の店 → ニューハーフ
// autoClick: trueの施設はproductionではなくclickValue×countを毎秒加算
// autoCrypto: trueの施設は毎秒暗号資産自動売買を行う
const BUILDINGS = [
    { id: 'vegetable', name: '野菜農園',      desc: '農業で世界変革（おいしい）',          icon: '🥬', basePrice: 10,      baseProduction: 0.1,  multiplier: 1.15, unlockCondition: null },
    { id: 'wagyu',     name: '和牛農場',      desc: '肉は権力の象徴',                      icon: '🐄', basePrice: 60,      baseProduction: 0.5,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['vegetable']?.count ?? 0) >= 1 },
    { id: 'sns',       name: 'SNS配信局',     desc: '所持数×クリック/秒 自動稼ぎ',         icon: '📱', basePrice: 300,     baseProduction: 0,    multiplier: 1.15, autoClick: true,       unlockCondition: gs => (gs.buildings['wagyu']?.count ?? 0) >= 1 },
    { id: 'health',    name: 'お笑いプロダクション', desc: '笑いは最強のコンテンツ',        icon: '🎤', basePrice: 2000,    baseProduction: 4,    multiplier: 1.15, unlockCondition: gs => (gs.buildings['sns']?.count ?? 0) >= 1 },
    { id: 'rocket',    name: 'ロケット工場',  desc: '規制なんか関係ない',                  icon: '🚀', basePrice: 15000,   baseProduction: 12,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['health']?.count ?? 0) >= 1 },
    { id: 'blog',      name: 'ブログポータル', desc: '記事が金になる',                     icon: '📝', basePrice: 80000,   baseProduction: 35,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['rocket']?.count ?? 0) >= 1 },
    { id: 'mailmag',   name: '有料メルマガ',  desc: '月額課金で信者を囲い込め',            icon: '💌', basePrice: 200000,  baseProduction: 65,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['blog']?.count ?? 0) >= 1 },
    { id: 'media',     name: 'メディア帝国',  desc: '情報は21世紀の石油',                  icon: '📺', basePrice: 400000,  baseProduction: 100,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['mailmag']?.count ?? 0) >= 1 },
    { id: 'salon',     name: '夜の社交場',    desc: '一杯飲んでちょめちょめ',              icon: '🌙', basePrice: 1500000, baseProduction: 300,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['media']?.count ?? 0) >= 1 },
    { id: 'newhalf',   name: 'ニューハーフ',  desc: '夜の顔を持つ敏腕トレーダー。保有数=毎秒取引数', icon: '💃', basePrice: 3500000, baseProduction: 0,    multiplier: 1.15, autoCrypto: true,      unlockCondition: gs => (gs.buildings['salon']?.count ?? 0) >= 1 },
];

// ===== 暗号資産定義（4種）=====
// 解放順: 普通のトークン → すごくないトークン → すげぇトークン → サナオトークン
// bearBias: 0.5=中立, 0.7=ベア寄り, 0.8=ほぼ常にベア
const CRYPTOS = [
    {
        id: 'futsuu',
        name: '普通のトークン',
        desc: '可もなく不可もない安定資産\n保有数 × 2/秒を生産',
        icon: '🪙',
        basePrice: 3000,
        production: 2,
        trendStrength: 3000,
        noise: 2000,
        minPrice: 800,
        bearBias: 0.48,
        unlockCondition: null,
        unlockDesc: null,
    },
    {
        id: 'maamaa',
        name: 'すごくないトークン',
        desc: 'まあまあなデジタル資産\n保有数 × 0.3/秒を生産',
        icon: '😐',
        basePrice: 500,
        production: 0.3,
        trendStrength: 2000,
        noise: 1500,
        minPrice: 150,
        bearBias: 0.48,
        unlockCondition: gs => (gs.buildings['wagyu']?.count ?? 0) >= 5,
        unlockDesc: '和牛農場を5個購入で解放',
    },
    {
        id: 'sugee',
        name: 'すげぇトークン',
        desc: '時間を価値に変える謎の通貨\n保有数 × 50/秒を生産\n相場が激しい',
        icon: '⏰',
        basePrice: 400000,
        production: 50,
        trendStrength: 220000,
        noise: 160000,
        minPrice: 15000,
        bearBias: 0.46,
        unlockCondition: gs => (gs.buildings['mailmag']?.count ?? 0) >= 10,
        unlockDesc: '有料メルマガを10個購入で解放',
    },
    {
        id: 'sanao',
        name: 'サナオトークン',
        desc: 'なぜか稼げない謎の通貨\n保有数 × 5/秒を生産（一応）',
        icon: '🌀',
        basePrice: 2000000,
        production: 5,
        trendStrength: 120000,
        noise: 90000,
        minPrice: 100000,
        bearBias: 0.8,  // 80%の確率でベア相場
        unlockCondition: gs => (gs.buildings['salon']?.count ?? 0) >= 1,
        unlockDesc: '夜の社交場を1個購入で解放',
    },
];


// ===== 一括取引ティア =====
// unlockAt: その銘柄の累計取引数（買い＋売り）が達したら解放
const TRADE_TIERS = [
    { amount: 1,             unlockAt: 0 },
    { amount: 10,            unlockAt: 0 },
    { amount: 100,           unlockAt: 0 },
    { amount: 1000,          unlockAt: 1000 },
    { amount: 10000,         unlockAt: 10000 },
    { amount: 100000,        unlockAt: 100000 },
    { amount: 1000000,       unlockAt: 1000000 },
    { amount: 10000000,      unlockAt: 10000000 },
    { amount: 100000000,     unlockAt: 100000000 },
    { amount: 1000000000,    unlockAt: 1000000000 },
    { amount: 10000000000,   unlockAt: 10000000000 },
    { amount: 100000000000,  unlockAt: 100000000000 },
];

// 取引ティア用の単位表示（万・億・兆）
function fmtTier(n) {
    if (n >= 1e12) return (n / 1e12) + '兆';
    if (n >= 1e8)  return (n / 1e8)  + '億';
    if (n >= 1e7)  return (n / 1e7)  + '千万';
    if (n >= 1e4)  return (n / 1e4)  + '万';
    if (n >= 1e3)  return (n / 1e3)  + '千';
    return String(n);
}

// ===== 実績定義（26種）=====
// tier: 'easy'(緑) / 'normal'(青) / 'hard'(紫) / 'legendary'(金)
const ACHIEVEMENTS = [
    // ===== Easy: 序盤10分で解除できるもの =====
    { id: 'first_click',    name: '最初のクリック',      icon: '🖱️', tier: 'easy',
      comment: '伝説の始まり',                      condition: '1回クリック',
      check: gs => gs.totalTokensEarned > 0,        bonus: 0 },

    { id: 'first_farm',     name: '農業への目覚め',      icon: '🥬', tier: 'easy',
      comment: '土を触ったことはないけど',          condition: '野菜農園を1個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 1,
      bonus: 2 },

    { id: 'first_wagyu',    name: '和牛オーナーの卵',    icon: '🐄', tier: 'easy',
      comment: 'とりあえず1頭から始めよう',         condition: '和牛農場を1個購入',
      check: gs => (gs.buildings['wagyu']?.count ?? 0) >= 1,
      bonus: 3 },

    { id: 'token_10k',      name: '１万の男',            icon: '💴', tier: 'easy',
      comment: '１万も大事にしない奴に10億は来ない', condition: '累計1万トークン',
      check: gs => gs.totalTokensEarned >= 10000,   bonus: 5 },

    // ===== Normal: 序盤〜中盤で解除 =====
    { id: 'health_start',   name: 'R入り初舞台',         icon: '🎤', tier: 'normal',
      comment: '笑いを取れた瞬間、世界が変わった', condition: 'お笑いプロダクションを1個購入',
      check: gs => (gs.buildings['health']?.count ?? 0) >= 1,
      bonus: 10 },

    { id: 'sns_start',      name: '配信デビュー',        icon: '📱', tier: 'normal',
      comment: '毎日更新が信者を作る',              condition: 'SNS配信局を10個購入',
      check: gs => (gs.buildings['sns']?.count ?? 0) >= 10,
      bonus: 15 },

    { id: 'wagyu_ranch',    name: '和牛農場の拡大',      icon: '🥩', tier: 'normal',
      comment: 'サシが入るまで育てろ',              condition: '和牛農場を25個購入',
      check: gs => (gs.buildings['wagyu']?.count ?? 0) >= 25,
      bonus: 40 },

    { id: 'building_50',    name: '施設コレクター',      icon: '🏗️', tier: 'normal',
      comment: 'まだまだ規模が足りない',            condition: '施設を合計50個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 50,
      bonus: 60 },

    { id: 'token_100k',     name: '最初の壁',            icon: '💵', tier: 'normal',
      comment: '10万なんてケタが違う（そうでもない）', condition: '累計10万トークン',
      check: gs => gs.totalTokensEarned >= 100000,  bonus: 50 },

    { id: 'maamaa_5',       name: 'まあまあ保有',        icon: '😐', tier: 'hard',
      comment: 'すごくはないが、ないよりマシ',      condition: 'すごくないトークンを200個保有',
      check: gs => (gs.cryptos['maamaa']?.owned ?? 0) >= 200,
      bonus: 80 },

    // ===== Hard: 中盤〜後半で解除 =====
    { id: 'comedy_king',    name: 'R入り王者',           icon: '🎤', tier: 'hard',
      comment: '一芸で笑いを取ったら起業家より稼げた', condition: 'お笑いプロダクションを100個購入',
      check: gs => (gs.buildings['health']?.count ?? 0) >= 100,
      bonus: 400 },

    { id: 'rocket_mass',    name: 'ロケット量産体制',    icon: '🚀', tier: 'hard',
      comment: '空を見上げるな、宇宙を見ろ',       condition: 'ロケット工場を50個購入',
      check: gs => (gs.buildings['rocket']?.count ?? 0) >= 50,
      bonus: 300 },

    { id: 'blog_empire',    name: 'ブログの帝王',        icon: '📝', tier: 'hard',
      comment: '某社に先を越されたが負けてない',    condition: 'ブログポータルを50個購入',
      check: gs => (gs.buildings['blog']?.count ?? 0) >= 50,
      bonus: 500 },

    { id: 'media_empire',   name: 'メディア完全制覇',    icon: '📺', tier: 'hard',
      comment: '全チャンネルで俺の顔を流せ',       condition: 'メディア帝国を50個購入',
      check: gs => (gs.buildings['media']?.count ?? 0) >= 50,
      bonus: 800 },

    { id: 'building_100',   name: '百施設帝国',          icon: '🏙️', tier: 'hard',
      comment: '個人の限界を超えた',               condition: '施設を合計100個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 100,
      bonus: 200 },

    { id: 'millionaire',    name: 'ミリオネア',          icon: '💰', tier: 'hard',
      comment: '金は時間で稼ぐ。論破！',           condition: '累計100万トークン',
      check: gs => gs.totalTokensEarned >= 1000000, bonus: 150 },

    { id: 'salon_legend',   name: '夜の伝説',            icon: '🌙', tier: 'hard',
      comment: '一杯飲んでちょめちょめ（詳細不明）', condition: '夜の社交場を10個購入',
      check: gs => (gs.buildings['salon']?.count ?? 0) >= 10,
      bonus: 600 },

    // ===== Legendary: 長時間プレイで解除 =====
    { id: 'night_diversity', name: '夜の多様な出会い',   icon: '💃', tier: 'legendary',
      comment: '多様な人脈が人間力を磨く。偏見は時代遅れ', condition: 'ニューハーフを50人雇用',
      check: gs => (gs.buildings['newhalf']?.count ?? 0) >= 50,
      bonus: 1200 },

    { id: 'veggie_farm',    name: '野菜王国の礎',        icon: '🌾', tier: 'legendary',
      comment: 'ニンジンで世界征服',               condition: '野菜農園を200個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 200,
      bonus: 500 },

    { id: 'wagyu_owner',    name: '和牛オーナー',        icon: '🥩', tier: 'legendary',
      comment: '高級和牛で差をつけろ',             condition: '和牛農場を100個購入',
      check: gs => (gs.buildings['wagyu']?.count ?? 0) >= 100,
      bonus: 800 },

    { id: 'sns_master',     name: 'SNS制圧',             icon: '📱', tier: 'legendary',
      comment: 'フォロワー無限。もはや国民皆フォロワー', condition: 'SNS配信局を50個購入',
      check: gs => (gs.buildings['sns']?.count ?? 0) >= 50,
      bonus: 1000 },

    { id: 'building_500',   name: '五百施設帝国',         icon: '🏙️', tier: 'legendary',
      comment: 'もはや一個人の規模じゃない',       condition: '施設を合計500個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 500,
      bonus: 3000 },

    { id: 'billionaire',    name: '億り人',              icon: '💎', tier: 'legendary',
      comment: 'ようやくスタートライン',            condition: '累計1億トークン',
      check: gs => gs.totalTokensEarned >= 100000000,
      bonus: 1500 },

    { id: 'ex_con_ceo',     name: '前科持ち社長',        icon: '⛓️', tier: 'legendary',
      comment: '塀の中で多くを学んだ（自称）',     condition: '累計10億トークン',
      check: gs => gs.totalTokensEarned >= 1000000000,
      bonus: 6000 },

    { id: 'sanao_miracle',  name: '奇跡の入手',          icon: '🌀', tier: 'legendary',
      comment: '買えたのか…なぜ？',               condition: 'サナオトークンを100個保有',
      check: gs => (gs.cryptos['sanao']?.owned ?? 0) >= 100,
      bonus: 10000 },

    { id: 'veggie_godhand', name: '農業革命',            icon: '🥬', tier: 'legendary',
      comment: '一人で農業を変えた男。えらい！', condition: '野菜農園を500個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 500,
      bonus: 5000 },
];

// ===== 初期化 =====
function init() {
    loadData();
    initBuildings();
    initCryptos();
    recalcClickValue();
    render();
    setupEvents();
    setupTooltip();
    gameLoop();
}

function loadData() {
    try {
        const saved = localStorage.getItem('game');
        if (!saved) return;
        const parsed = JSON.parse(saved);

        // 旧データ移行: virtualA → cryptos.sugee
        if (parsed.virtualA !== undefined && (!parsed.cryptos || !parsed.cryptos.sugee)) {
            parsed.cryptos = parsed.cryptos || {};
            parsed.cryptos.sugee = {
                owned: parsed.virtualA || 0,
                price: parsed.virtualAPrice || 40000,
                history: parsed.virtualAPriceHistory || [40000],
            };
        }
        // 旧データ移行: cryptoTrend → cryptoTrends.sugee
        if (parsed.cryptoTrend !== undefined && !parsed.cryptoTrends) {
            parsed.cryptoTrends = {
                sugee: { trend: parsed.cryptoTrend || 0, duration: parsed.cryptoTrendDuration || 0 },
            };
        }

        Object.assign(GameState, parsed);
        if (!GameState.unlockedAchievements) GameState.unlockedAchievements = [];
        if (!GameState.productionHistory)    GameState.productionHistory = [0];
        if (!GameState.cryptoTrends)         GameState.cryptoTrends = {};
        if (!GameState.cryptos)              GameState.cryptos = {};

        BUILDINGS.forEach(b => {
            if (!GameState.buildings[b.id]) GameState.buildings[b.id] = { count: 0 };
        });
        CRYPTOS.forEach(c => {
            if (!GameState.cryptos[c.id]) GameState.cryptos[c.id] = { owned: 0, price: c.basePrice, history: [c.basePrice], tradeVolume: 0 };
            if (GameState.cryptos[c.id].tradeVolume === undefined) GameState.cryptos[c.id].tradeVolume = 0;
        });
    } catch (e) {
        console.error('Load data error:', e);
        localStorage.removeItem('game');
    }
}

function recalcClickValue() {
    GameState.clickValue = 1;
    ACHIEVEMENTS.forEach(ach => {
        if (ach.bonus && GameState.unlockedAchievements.includes(ach.id)) {
            GameState.clickValue += ach.bonus;
        }
    });
}

function initBuildings() {
    BUILDINGS.forEach(b => {
        if (!GameState.buildings[b.id]) GameState.buildings[b.id] = { count: 0 };
    });
}

function initCryptos() {
    CRYPTOS.forEach(c => {
        if (!GameState.cryptos[c.id]) GameState.cryptos[c.id] = { owned: 0, price: c.basePrice, history: [c.basePrice], tradeVolume: 0 };
        if (GameState.cryptos[c.id].tradeVolume === undefined) GameState.cryptos[c.id].tradeVolume = 0;
    });
}

// ===== 通知 =====
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    document.getElementById('notifications').appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function updateGameDate() {
    const el = document.getElementById('current-date');
    if (el) el.textContent = new Date().toLocaleDateString('ja-JP');
}

// ===== 実績チェック =====
function checkAchievements() {
    ACHIEVEMENTS.forEach(ach => {
        if (GameState.unlockedAchievements.includes(ach.id)) return;
        if (ach.check(GameState)) {
            GameState.unlockedAchievements.push(ach.id);
            if (ach.bonus) GameState.clickValue += ach.bonus;
            showNotification(`🏆 ${ach.name}`, 'achievement');
            renderAchievements();
        }
    });
}

function initCharts() {}

function render() {
    renderAchievements();
    renderBuildings();
    renderCrypto();
}

// 未解放の施設・暗号資産名を「???」に置き換える
function maskLockedNames(text) {
    BUILDINGS.forEach(b => {
        if (b.unlockCondition && !b.unlockCondition(GameState)) {
            text = text.replaceAll(b.name, '???');
        }
    });
    CRYPTOS.forEach(c => {
        if (c.unlockCondition && !c.unlockCondition(GameState)) {
            text = text.replaceAll(c.name, '???');
        }
    });
    return text;
}

// ===== 実績描画 =====
function renderAchievements() {
    const el = document.getElementById('achievementsList');
    if (!el) return;
    el.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    const tierLabel = { easy: '⭐ かんたん', normal: '⭐⭐ ふつう', hard: '⭐⭐⭐ むずかしい', legendary: '👑 レジェンダリー' };
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = GameState.unlockedAchievements.includes(ach.id);
        const tier = ach.tier || 'normal';
        const item = document.createElement('div');
        item.className = `achievement-item tier-${tier} ${unlocked ? 'unlocked' : 'locked'}`;
        item.textContent = unlocked ? ach.icon : '🔒';
        const label = tierLabel[tier] || '';
        const tooltip = unlocked
            ? `${ach.name}\n${ach.comment}\n条件: ${ach.condition}\n${label}`
            : `???\n条件: ${maskLockedNames(ach.condition)}\n${label}`;
        item.setAttribute('data-tooltip', tooltip);
        grid.appendChild(item);
    });
    el.appendChild(grid);
}

// ===== 施設描画 =====
function bulkBuildingPrice(b, n) {
    const count = GameState.buildings[b.id].count;
    const r = b.multiplier;
    return b.basePrice * Math.pow(r, count) * (Math.pow(r, n) - 1) / (r - 1);
}

function renderBuildings() {
    const el = document.getElementById('buildingsListFull');
    if (!el) return;
    el.innerHTML = '';
    BUILDINGS.forEach(b => {
        const isUnlocked = !b.unlockCondition || b.unlockCondition(GameState);
        const card = document.createElement('div');

        if (!isUnlocked) {
            card.className = 'item-card locked-card';
            // 解放条件を探す（前の施設名はまだ公開中なので表示可）
            const prevIdx = BUILDINGS.indexOf(b) - 1;
            const prevName = prevIdx >= 0 ? BUILDINGS[prevIdx].name : '';
            card.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${b.icon} ??? 🔒</div>
                    <div class="item-effect locked-hint">${prevName}を1個購入で解放</div>
                </div>`;
            el.appendChild(card);
            return;
        }

        const count = GameState.buildings[b.id].count;
        const p1    = bulkBuildingPrice(b, 1);
        const p10   = bulkBuildingPrice(b, 10);
        const p100  = bulkBuildingPrice(b, 100);

        // 効果表示: autoClickはclickValue×count、autoTrade/autoTradeStocksは自動売買、それ以外は/s
        let effectText;
        if (b.autoClick) {
            const autoVal = count * GameState.clickValue;
            effectText = count > 0 ? `🖱️ ${fmt(autoVal)}/s 自動クリック` : '🖱️ 自動クリック';
        } else if (b.autoCrypto) {
            effectText = count > 0 ? `💹 ${count}取引/s 暗号資産自動売買` : '💹 暗号資産自動売買';
        } else {
            const prod = count > 0 ? b.baseProduction * count * Math.pow(b.multiplier, count - 1) : 0;
            effectText = `+${fmt(prod)}/s`;
        }

        card.className = `item-card ${GameState.tokens < p1 ? 'unaffordable' : ''}`;
        card.setAttribute('data-tooltip', b.desc);
        card.innerHTML = `
            <div class="item-info">
                <div class="item-name">${b.icon} ${b.name} <span class="item-count">${count}</span></div>
                <div class="item-effect">${effectText}</div>
            </div>
            <div class="buy-group">
                <button class="buy-button" ${GameState.tokens < p1   ? 'disabled' : ''}>×1<span class="btn-price">${fmt(p1)}</span></button>
                <button class="buy-button" ${GameState.tokens < p10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(p10)}</span></button>
                <button class="buy-button" ${GameState.tokens < p100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(p100)}</span></button>
            </div>`;
        const btns = card.querySelectorAll('.buy-button');
        btns[0].onclick = () => buyBuilding(b, 1);
        btns[1].onclick = () => buyBuilding(b, 10);
        btns[2].onclick = () => buyBuilding(b, 100);
        el.appendChild(card);
    });
}

// ===== チャートHTML =====
function chartHTML(history, color, chartId) {
    if (history.length < 2) return '';
    const VW = 200, VH = 54;
    const L = 2, R = 2, T = 4, B = 4;
    const CW = VW - L - R, CH = VH - T - B;

    const min     = Math.min(...history);
    const max     = Math.max(...history);
    const range   = max - min || 1;
    const current = history[history.length - 1];
    const toX = i => (L + (i / (history.length - 1)) * CW).toFixed(1);
    const toY = v => (T + CH - ((v - min) / range) * CH).toFixed(1);

    const pts     = history.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const lastX   = toX(history.length - 1);
    const curY    = toY(current);
    const fillPts = `${pts} ${(L + CW)},${T + CH} ${L},${T + CH}`;
    const gradId  = `sg${chartId}`;

    const grids = [0.25, 0.5, 0.75].map(t => {
        const gy = (T + t * CH).toFixed(1);
        return `<line x1="${L}" y1="${gy}" x2="${L + CW}" y2="${gy}" stroke="#252525" stroke-width="0.8"/>`;
    }).join('');

    const svg = `<svg class="sparkline-svg" viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" preserveAspectRatio="none">
        <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="${color}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
            </linearGradient>
        </defs>
        <rect x="${L}" y="${T}" width="${CW}" height="${CH}" fill="#111" rx="1"/>
        ${grids}
        <polygon points="${fillPts}" fill="url(#${gradId})"/>
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <line x1="${L}" y1="${curY}" x2="${L + CW}" y2="${curY}" stroke="${color}" stroke-width="0.7" stroke-dasharray="3,3" opacity="0.6"/>
        <circle cx="${lastX}" cy="${curY}" r="2.5" fill="${color}"/>
    </svg>`;

    return `<div class="chart-area">
        ${svg}
        <div class="chart-labels">
            <span class="chart-extremes">${fmt(max)}</span>
            <span class="chart-price" style="color:${color}">${fmt(current)}</span>
            <span class="chart-extremes">${fmt(min)}</span>
        </div>
    </div>`;
}

// ===== 暗号資産描画 =====
function renderCrypto() {
    const el = document.getElementById('cryptoListFull');
    if (!el) return;
    el.innerHTML = '';
    CRYPTOS.forEach(c => {
        const isUnlocked = !c.unlockCondition || c.unlockCondition(GameState);
        const card = document.createElement('div');

        if (!isUnlocked) {
            card.className = 'item-card locked-card';
            card.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${c.icon} ??? 🔒</div>
                    <div class="item-effect locked-hint">${c.unlockDesc}</div>
                </div>`;
            el.appendChild(card);
            return;
        }

        const cr     = GameState.cryptos[c.id];
        const prev   = cr.history[cr.history.length - 2] || cr.price;
        const change = cr.price - prev;
        const pct    = cr.history.length > 1 ? ((change / prev) * 100).toFixed(1) : 0;
        const trendColor = change >= 0 ? '#4caf50' : '#f44336';

        const volume = cr.tradeVolume || 0;
        const unlockedTiers = TRADE_TIERS.filter(t => volume >= t.unlockAt);
        const nextTier = TRADE_TIERS.find(t => volume < t.unlockAt);

        const buyBtnsHTML = unlockedTiers.map(t =>
            `<button class="buy-button" data-amount="${t.amount}" ${GameState.tokens < cr.price * t.amount ? 'disabled' : ''}>×${fmtTier(t.amount)}<span class="btn-price">${fmt(cr.price * t.amount)}</span></button>`
        ).join('');
        const sellBtnsHTML = unlockedTiers.map(t =>
            `<button class="sell-button" data-amount="${t.amount}" ${cr.owned < t.amount ? 'disabled' : ''}>×${fmtTier(t.amount)}<span class="btn-price">${fmt(cr.price * t.amount)}</span></button>`
        ).join('');
        const progressHTML = nextTier
            ? `<div class="trade-progress">🔒 次の解放: ×${fmtTier(nextTier.amount)} まであと ${fmtTier(nextTier.unlockAt - volume)} 回取引</div>`
            : '';

        card.className = 'item-card trade-card';
        card.setAttribute('data-tooltip', c.desc);
        card.innerHTML = `
            <div class="item-info">
                <div class="item-name">${c.icon} ${c.name} <span class="item-count">${cr.owned}</span></div>
                <div class="item-effect" style="color:${trendColor}">
                    ${fmt(cr.price)} (${pct > 0 ? '+' : ''}${pct}%)
                </div>
                ${chartHTML(cr.history, trendColor, c.id)}
            </div>
            <div class="item-trade">
                <div class="trade-row">
                    <span class="trade-label buy-label">買</span>
                    <div class="buy-group">${buyBtnsHTML}</div>
                </div>
                <div class="trade-row">
                    <span class="trade-label sell-label">売</span>
                    <div class="buy-group">${sellBtnsHTML}</div>
                </div>
                ${progressHTML}
            </div>`;
        card.querySelectorAll('.buy-button').forEach(btn => {
            btn.onclick = () => buyCrypto(c.id, parseInt(btn.dataset.amount));
        });
        card.querySelectorAll('.sell-button').forEach(btn => {
            btn.onclick = () => sellCrypto(c.id, parseInt(btn.dataset.amount));
        });
        el.appendChild(card);
    });
}

// ===== イベント設定 =====
function setupEvents() {
    const btn = document.getElementById('tokenButton');
    if (btn) btn.addEventListener('click', () => click());

    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', e => {
        document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const el = document.getElementById(e.target.getAttribute('data-tab'));
        if (el) el.classList.add('active');
    }));
}

// ===== ツールチップ =====
function setupTooltip() {
    const tip = document.createElement('div');
    tip.id = 'game-tooltip';
    tip.className = 'tooltip-box';
    document.body.appendChild(tip);

    document.addEventListener('mousemove', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) { tip.style.display = 'none'; return; }
        tip.textContent = el.getAttribute('data-tooltip');
        tip.style.display = 'block';
        const m = 14, tw = tip.offsetWidth, th = tip.offsetHeight;
        let x = e.clientX + m, y = e.clientY + m;
        if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - m;
        if (y + th > window.innerHeight - 8) y = e.clientY - th - m;
        tip.style.left = x + 'px';
        tip.style.top  = y + 'px';
    });

    document.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

// ===== 相場変動（ブル/ベア）=====
function tickMarket() {
    CRYPTOS.forEach(c => {
        if (!GameState.cryptoTrends[c.id] || GameState.cryptoTrends[c.id].duration <= 0) {
            GameState.cryptoTrends[c.id] = {
                trend:    (Math.random() - c.bearBias) * c.trendStrength,
                duration: 5 + Math.floor(Math.random() * 16),
            };
        }
        GameState.cryptoTrends[c.id].duration--;
        const noise = (Math.random() - 0.5) * c.noise;
        const cr = GameState.cryptos[c.id];
        cr.price = Math.max(c.minPrice, cr.price + GameState.cryptoTrends[c.id].trend + noise);
        cr.history.push(cr.price);
        if (cr.history.length > 60) cr.history.shift();
    });

}

// ===== 俺に入れてもらうことできるか？ =====
function showHeartFloat() {
    const btn = document.getElementById('tokenButton');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const hearts = ['💕', '💗', '💖', '💓', '💝'];
    const numHearts = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numHearts; i++) {
        setTimeout(() => {
            const float = document.createElement('div');
            float.className = 'click-float heart-float';
            float.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            const angle  = (Math.PI * 2 / numHearts) * i + (Math.random() - 0.5);
            const radius = 20 + Math.random() * 40;
            float.style.left = (rect.left + rect.width / 2 + Math.cos(angle) * radius) + 'px';
            float.style.top  = (rect.top  + rect.height / 2 + Math.sin(angle) * radius - 10) + 'px';
            document.body.appendChild(float);
            setTimeout(() => float.remove(), 1100);
        }, i * 120);
    }
}

// ===== SNS自動クリックエフェクト =====
function showAutoClickFloats(totalValue, count) {
    const btn = document.getElementById('tokenButton');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const numFloats = Math.min(Math.max(1, Math.floor(Math.log2(count + 1))), 6);
    const perFloat  = Math.floor(totalValue / numFloats);
    for (let i = 0; i < numFloats; i++) {
        setTimeout(() => {
            const float = document.createElement('div');
            float.className = 'click-float auto-click-float';
            float.textContent = `+${fmt(perFloat)}`;
            const angle  = (Math.PI * 2 / numFloats) * i + (Math.random() - 0.5) * 0.8;
            const radius = 30 + Math.random() * 30;
            float.style.left = (rect.left + rect.width / 2 + Math.cos(angle) * radius) + 'px';
            float.style.top  = (rect.top  + rect.height / 2 + Math.sin(angle) * radius - 10) + 'px';
            document.body.appendChild(float);
            setTimeout(() => float.remove(), 900);
        }, i * 80);
    }
}

// ===== 敏腕トレーダー 暗号資産自動売買 =====
function autoTrade() {
    const newhalfCount = GameState.buildings['newhalf']?.count ?? 0;
    if (newhalfCount === 0) return;

    // 解放済み銘柄に均等に取引枠を配分
    const unlocked = CRYPTOS.filter(c => !c.unlockCondition || c.unlockCondition(GameState));
    if (unlocked.length === 0) return;
    const perCrypto = Math.max(1, Math.floor(newhalfCount / unlocked.length));

    for (const c of unlocked) {
        const cr = GameState.cryptos[c.id];
        if (cr.history.length < 10) continue;

        const recentMin  = Math.min(...cr.history);
        const recentMax  = Math.max(...cr.history);
        const buyThresh  = recentMin * 1.05;
        const sellThresh = recentMax * 0.95;

        if (cr.price <= buyThresh && GameState.tokens >= cr.price) {
            // 所持トークンで買えるだけ買う（perCrypto上限）
            const n = Math.min(perCrypto, Math.floor(GameState.tokens / cr.price));
            if (n > 0) {
                GameState.tokens -= cr.price * n;
                cr.owned += n;
                cr.tradeVolume = (cr.tradeVolume || 0) + n;
                showHeartFloat();
            }
        } else if (cr.price >= sellThresh && cr.owned > 0) {
            // 保有数をすべて売る（perCrypto上限）
            const n = Math.min(perCrypto, cr.owned);
            cr.owned -= n;
            GameState.tokens += cr.price * n;
            GameState.totalTokensEarned += cr.price * n;
            cr.tradeVolume = (cr.tradeVolume || 0) + n;
            showHeartFloat();
        }
    }
}

// ===== ゲームループ =====
function gameLoop() {
    setInterval(() => {
        tick++;

        // 通常施設からの生産（autoClick/autoTrade施設を除く）
        let prod = 0;
        BUILDINGS.forEach(b => {
            if (b.autoClick || b.autoCrypto) return;
            const count = GameState.buildings[b.id].count;
            if (count > 0) prod += b.baseProduction * count * Math.pow(b.multiplier, count - 1);
        });

        // SNS自動クリック（clickValue × count）
        const snsCount = GameState.buildings['sns']?.count ?? 0;
        if (snsCount > 0) {
            const autoClickValue = snsCount * GameState.clickValue;
            prod += autoClickValue;
            showAutoClickFloats(autoClickValue, snsCount);
        }

        // 暗号資産からの生産
        CRYPTOS.forEach(c => {
            const owned = GameState.cryptos[c.id]?.owned ?? 0;
            if (owned > 0) prod += c.production * owned;
        });

        GameState.perSecond = prod;
        GameState.productionHistory.push(prod);
        if (GameState.productionHistory.length > 30) GameState.productionHistory.shift();
        GameState.tokens += prod;
        GameState.totalTokensEarned += prod;

        // 相場変動（毎秒）
        tickMarket();

        // 暗号資産自動売買
        autoTrade();

        updateDisplay();
        updateGameDate();
        checkAchievements();
        render();
    }, 1000);

    setInterval(() => localStorage.setItem('game', JSON.stringify(GameState)), 5000);
}

// ===== クリック =====
function click() {
    GameState.tokens += GameState.clickValue;
    GameState.totalTokensEarned += GameState.clickValue;
    updateDisplay();
    showClickFloat(GameState.clickValue);
    checkAchievements();
}

function showClickFloat(value) {
    const btn = document.getElementById('tokenButton');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = 'click-float';
    float.textContent = `+${fmt(value)}`;
    float.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 60) + 'px';
    float.style.top  = (rect.top  + rect.height / 2 - 10) + 'px';
    document.body.appendChild(float);
    setTimeout(() => float.remove(), 900);
}

// ===== 購入・売却 =====
function buyBuilding(b, n = 1) {
    const price = bulkBuildingPrice(b, n);
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        GameState.buildings[b.id].count += n;
        GameState.purchaseCount += n;
        GameState.entrepreneurLevel = Math.floor(Math.sqrt(GameState.purchaseCount)) + 1;
        render();
        showNotification(`${b.icon} ${b.name} ×${n}`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function buyCrypto(id, n = 1) {
    const c  = CRYPTOS.find(c => c.id === id);
    const cr = GameState.cryptos[id];
    const price = cr.price * n;
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        cr.owned += n;
        const prev = cr.tradeVolume || 0;
        cr.tradeVolume = prev + n;
        for (const tier of TRADE_TIERS) {
            if (tier.unlockAt > 0 && prev < tier.unlockAt && cr.tradeVolume >= tier.unlockAt) {
                showNotification(`🔓 ${c.icon} ×${fmtTier(tier.amount)} 一括取引 解放！`, 'achievement');
            }
        }
        render();
        showNotification(`${c.icon} ${c.name} ×${n} 購入`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function sellCrypto(id, n = 1) {
    const c  = CRYPTOS.find(c => c.id === id);
    const cr = GameState.cryptos[id];
    if (cr.owned < n) { showNotification(`保有数が足りません`, 'error'); return; }
    const earned = cr.price * n;
    cr.owned -= n;
    GameState.tokens += earned;
    GameState.totalTokensEarned += earned;
    const prev = cr.tradeVolume || 0;
    cr.tradeVolume = prev + n;
    for (const tier of TRADE_TIERS) {
        if (tier.unlockAt > 0 && prev < tier.unlockAt && cr.tradeVolume >= tier.unlockAt) {
            showNotification(`🔓 ${c.icon} ×${fmtTier(tier.amount)} 一括取引 解放！`, 'achievement');
        }
    }
    render();
    updateDisplay();
    showNotification(`${c.icon} ${c.name} ×${n} 売却 +${fmt(earned)}`, 'sell');
    checkAchievements();
}

// ===== 表示更新 =====
function updateDisplay() {
    const el = id => document.getElementById(id);
    if (el('tokenCount'))        el('tokenCount').textContent        = fmt(GameState.tokens);
    if (el('perSecond'))         el('perSecond').textContent         = fmt(GameState.perSecond);
    if (el('totalTokens'))       el('totalTokens').textContent       = fmt(GameState.totalTokensEarned);
    if (el('clickValue'))        el('clickValue').textContent        = fmt(GameState.clickValue);
    if (el('arenaPerSecond'))    el('arenaPerSecond').textContent    = fmt(GameState.perSecond);
    if (el('entrepreneurLevel')) el('entrepreneurLevel').textContent = `Lv.${GameState.entrepreneurLevel}`;
    if (el('arenaLevel'))        el('arenaLevel').textContent        = GameState.entrepreneurLevel;

    let port = GameState.tokens;
    BUILDINGS.forEach(b => {
        const count = GameState.buildings[b.id].count;
        for (let i = 0; i < count; i++) port += b.basePrice * Math.pow(b.multiplier, i);
    });
    CRYPTOS.forEach(c => {
        const cr = GameState.cryptos[c.id];
        if (cr) port += cr.owned * cr.price;
    });
    if (el('portfolioValue')) el('portfolioValue').textContent = fmt(port);
}

function updateCharts() {}

window.addEventListener('DOMContentLoaded', init);
