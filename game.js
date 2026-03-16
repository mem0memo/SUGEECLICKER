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
    stocks: {},
    totalStockTraded: 0,
    productionHistory: [0],
    unlockedAchievements: [],
    cryptoTrends: {},  // { [id]: { trend, duration } }
    stockTrends: {},   // { [id]: { trend, duration } }
};

let tick = 0;

// ===== 施設定義（10種）=====
// 流れ: 農業 → SNS → 健康 → 宇宙 → ブログ → メルマガ → メディア → 夜の店 → 取引所
// autoClick: trueの施設はproductionではなくclickValue×countを毎秒加算
// autoTrade: trueの施設は毎秒自動売買を行う
const BUILDINGS = [
    { id: 'vegetable', name: '野菜農園',      desc: '農業で世界変革（言いすぎ）',          icon: '🥬', basePrice: 10,      baseProduction: 0.1,  multiplier: 1.15, unlockCondition: null },
    { id: 'wagyu',     name: '和牛農場',      desc: '肉は権力の象徴',                      icon: '🐄', basePrice: 60,      baseProduction: 0.5,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['vegetable']?.count ?? 0) >= 1 },
    { id: 'sns',       name: 'SNS配信局',     desc: '所持数×クリック/秒 自動稼ぎ',         icon: '📱', basePrice: 300,     baseProduction: 0,    multiplier: 1.15, autoClick: true,       unlockCondition: gs => (gs.buildings['wagyu']?.count ?? 0) >= 1 },
    { id: 'health',    name: 'お笑いプロダクション', desc: '笑いは最強のコンテンツ',        icon: '🎤', basePrice: 2000,    baseProduction: 4,    multiplier: 1.15, unlockCondition: gs => (gs.buildings['sns']?.count ?? 0) >= 1 },
    { id: 'rocket',    name: 'ロケット工場',  desc: '規制なんか関係ない',                  icon: '🚀', basePrice: 15000,   baseProduction: 12,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['health']?.count ?? 0) >= 1 },
    { id: 'blog',      name: 'ブログポータル', desc: '記事が金になる',                     icon: '📝', basePrice: 80000,   baseProduction: 35,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['rocket']?.count ?? 0) >= 1 },
    { id: 'mailmag',   name: '有料メルマガ',  desc: '月額課金で信者を囲い込め',            icon: '💌', basePrice: 200000,  baseProduction: 65,   multiplier: 1.15, unlockCondition: gs => (gs.buildings['blog']?.count ?? 0) >= 1 },
    { id: 'media',     name: 'メディア帝国',  desc: '情報は21世紀の石油',                  icon: '📺', basePrice: 400000,  baseProduction: 100,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['mailmag']?.count ?? 0) >= 1 },
    { id: 'salon',     name: '夜の社交場',    desc: '一杯飲んでちょめちょめ',              icon: '🌙', basePrice: 1500000, baseProduction: 300,  multiplier: 1.15, unlockCondition: gs => (gs.buildings['media']?.count ?? 0) >= 1 },
    { id: 'newhalf',   name: 'ニューハーフ',  desc: '株式自動売買。保有数=毎秒取引数',     icon: '💃', basePrice: 3500000, baseProduction: 0,    multiplier: 1.15, autoTradeStocks: true, unlockCondition: gs => (gs.buildings['salon']?.count ?? 0) >= 1 },
    { id: 'exchange',  name: '取引所',        desc: '全資産自動売買。所持数=同時取引数',   icon: '💰', basePrice: 8000000, baseProduction: 0,    multiplier: 1.15, autoTrade: true,       unlockCondition: gs => (gs.buildings['newhalf']?.count ?? 0) >= 1 },
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
        desc: '時間を価値に変える謎の通貨\n保有数 × 20/秒を生産',
        icon: '⏰',
        basePrice: 400000,
        production: 20,
        trendStrength: 80000,
        noise: 60000,
        minPrice: 40000,
        bearBias: 0.48,
        unlockCondition: gs => (gs.buildings['blog']?.count ?? 0) >= 2,
        unlockDesc: 'ブログポータルを2個購入で解放',
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

// ===== 株式定義（4種、解放条件付き）=====
const STOCKS = [
    {
        id: 'video',
        name: '動画配信株',
        desc: 'ネット動画を牛耳る企業への投資',
        icon: '📹',
        basePrice: 200,
        dividendRate: 0.005,
        trendStrength: 80,
        noise: 60,
        unlockCondition: null,
        unlockDesc: null,
    },
    {
        id: 'space',
        name: '宇宙ビジネス株',
        desc: '民間ロケット企業。夢は大きく',
        icon: '🛸',
        basePrice: 2000,
        dividendRate: 0.005,
        trendStrength: 500,
        noise: 400,
        unlockCondition: gs => (gs.buildings['rocket']?.count ?? 0) >= 2,
        unlockDesc: 'ロケット工場を2個購入で解放',
    },
    {
        id: 'media',
        name: 'メディア株',
        desc: '情報を制する者が市場を制す',
        icon: '📡',
        basePrice: 15000,
        dividendRate: 0.004,
        trendStrength: 3000,
        noise: 2500,
        unlockCondition: gs => (gs.buildings['media']?.count ?? 0) >= 1,
        unlockDesc: 'メディア帝国を1個購入で解放',
    },
    {
        id: 'finance',
        name: '金融プラットフォーム株',
        desc: '規制前に市場を取れ。高リスク高リターン',
        icon: '🏦',
        basePrice: 100000,
        dividendRate: 0.003,
        trendStrength: 20000,
        noise: 18000,
        unlockCondition: gs => (gs.buildings['exchange']?.count ?? 0) >= 1,
        unlockDesc: '取引所を1個購入で解放',
    },
];

// ===== 実績定義（25種・施設→取引→実績の流れ）=====
const ACHIEVEMENTS = [
    // ===== ゲーム開始 =====
    { id: 'first_click',    name: '最初のクリック',      icon: '🖱️',
      comment: '伝説の始まり',                      condition: '1回クリック',
      check: gs => gs.totalTokensEarned > 0,        bonus: 0 },

    // ===== 施設系（序盤）=====
    { id: 'veggie_start',   name: '農業への目覚め',      icon: '🥬',
      comment: '土を触ったことはないけど',          condition: '野菜農園を1個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 1,
      bonus: 2 },

    { id: 'wagyu_owner',    name: '和牛オーナー',        icon: '🐄',
      comment: '高級和牛で差をつけろ',              condition: '和牛農場を1個購入',
      check: gs => (gs.buildings['wagyu']?.count ?? 0) >= 1,
      bonus: 3 },

    { id: 'sns_start',      name: '配信デビュー',        icon: '📱',
      comment: '毎日更新が信者を作る',              condition: 'SNS配信局を1個購入',
      check: gs => (gs.buildings['sns']?.count ?? 0) >= 1,
      bonus: 6 },

    { id: 'health_start',   name: 'R入り初舞台',         icon: '🎤',
      comment: '笑いを取れた瞬間、世界が変わった', condition: 'お笑いプロダクションを1個購入',
      check: gs => (gs.buildings['health']?.count ?? 0) >= 1,
      bonus: 10 },

    // ===== 施設系（中盤）=====
    { id: 'building_15',    name: '施設コレクター',      icon: '🏗️',
      comment: 'まだまだ規模が足りない',            condition: '施設を合計100個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 100,
      bonus: 25 },

    { id: 'wagyu_ranch',    name: '和牛農場の拡大',      icon: '🥩',
      comment: 'サシが入るまで育てろ',              condition: '和牛農場を100個購入',
      check: gs => (gs.buildings['wagyu']?.count ?? 0) >= 100,
      bonus: 60 },

    { id: 'blog_empire',    name: 'ブログの帝王',        icon: '📝',
      comment: '某社に先を越されたが負けてない',    condition: 'ブログポータルを50個購入',
      check: gs => (gs.buildings['blog']?.count ?? 0) >= 50,
      bonus: 200 },

    { id: 'rocket_mass',    name: 'ロケット量産体制',    icon: '🚀',
      comment: '空を見上げるな、宇宙を見ろ',       condition: 'ロケット工場を80個購入',
      check: gs => (gs.buildings['rocket']?.count ?? 0) >= 80,
      bonus: 300 },

    { id: 'salon_legend',   name: '夜の伝説',            icon: '🌙',
      comment: '一杯飲んでちょめちょめ（詳細不明）', condition: '夜の社交場を30個購入',
      check: gs => (gs.buildings['salon']?.count ?? 0) >= 30,
      bonus: 600 },

    { id: 'night_diversity', name: '夜の多様な出会い',   icon: '💃',
      comment: '多様な人脈が人間力を磨く。偏見は時代遅れ', condition: 'ニューハーフを50人雇用',
      check: gs => (gs.buildings['newhalf']?.count ?? 0) >= 50,
      bonus: 1200 },

    { id: 'comedy_king',    name: 'R入り王者',           icon: '🎤',
      comment: '一芸で笑いを取ったら起業家より稼げた', condition: 'お笑いプロダクションを100個購入',
      check: gs => (gs.buildings['health']?.count ?? 0) >= 100,
      bonus: 400 },

    // ===== 施設系（後半）=====
    { id: 'media_empire',   name: 'メディア完全制覇',    icon: '📺',
      comment: '全チャンネルで俺の顔を流せ',       condition: 'メディア帝国を50個購入',
      check: gs => (gs.buildings['media']?.count ?? 0) >= 50,
      bonus: 800 },

    { id: 'exchange_open',  name: '取引所開設',          icon: '💹',
      comment: '銀行は時代遅れ。論破',              condition: '取引所を20個購入',
      check: gs => (gs.buildings['exchange']?.count ?? 0) >= 20,
      bonus: 1000 },

    { id: 'veggie_farm',    name: '野菜王国の礎',        icon: '🌾',
      comment: 'ニンジンで世界征服',               condition: '野菜農園を200個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 200,
      bonus: 150 },

    { id: 'building_100',   name: '千施設帝国',          icon: '🏙️',
      comment: 'もはや一個人の規模じゃない',       condition: '施設を合計1000個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 1000,
      bonus: 3000 },

    // ===== トークン累計系 =====
    { id: 'token_100k',     name: '最初の壁',            icon: '💴',
      comment: '10万なんてケタが違う（そうでもない）', condition: '累計10万トークン',
      check: gs => gs.totalTokensEarned >= 100000,
      bonus: 30 },

    { id: 'millionaire',    name: 'ミリオネア',          icon: '💰',
      comment: '金は時間で稼ぐ。論破！',           condition: '累計100万トークン',
      check: gs => gs.totalTokensEarned >= 1000000,
      bonus: 150 },

    { id: 'billionaire',    name: '億り人',              icon: '💎',
      comment: 'ようやくスタートライン',            condition: '累計1億トークン',
      check: gs => gs.totalTokensEarned >= 100000000,
      bonus: 1500 },

    { id: 'ex_con_ceo',     name: '前科持ち社長',        icon: '⛓️',
      comment: '塀の中で多くを学んだ（自称）',     condition: '累計10億トークン',
      check: gs => gs.totalTokensEarned >= 1000000000,
      bonus: 6000 },

    // ===== 株取引系 =====
    { id: 'stock_debut',    name: '株式デビュー',        icon: '📊',
      comment: 'チャートの読み方を学べ',           condition: '株取引累計5,000',
      check: gs => (gs.totalStockTraded ?? 0) >= 5000,
      bonus: 20 },

    { id: 'stock_trader',   name: 'トレーダー覚醒',      icon: '📈',
      comment: '感情で売買するな。でも俺はする',   condition: '株取引累計10万',
      check: gs => (gs.totalStockTraded ?? 0) >= 100000,
      bonus: 200 },

    { id: 'wall_st',        name: 'ウォール街の申し子',  icon: '🗽',
      comment: '規制なんて恐れない',               condition: '株取引累計100万',
      check: gs => (gs.totalStockTraded ?? 0) >= 1000000,
      bonus: 1000 },

    { id: 'major_holder',   name: '大株主',              icon: '🤵',
      comment: '議決権で世界を動かす',             condition: '保有株合計500株以上',
      check: gs => Object.values(gs.stocks).reduce((a, s) => a + s.owned, 0) >= 500,
      bonus: 500 },

    // ===== 暗号資産系 =====
    { id: 'maamaa_5',       name: 'まあまあ保有',        icon: '😐',
      comment: 'すごくはないが、ないよりマシ',     condition: 'すごくないトークンを50個保有',
      check: gs => (gs.cryptos['maamaa']?.owned ?? 0) >= 50,
      bonus: 30 },

    { id: 'sanao_miracle',  name: '奇跡の入手',          icon: '🌀',
      comment: '買えたのか…なぜ？',               condition: 'サナオトークンを1個保有',
      check: gs => (gs.cryptos['sanao']?.owned ?? 0) >= 1,
      bonus: 10000 },
];

// ===== 初期化 =====
function init() {
    loadData();
    initBuildings();
    initCryptos();
    initStocks();
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
        if (!GameState.stocks)               GameState.stocks = {};
        if (!GameState.totalStockTraded)     GameState.totalStockTraded = 0;

        BUILDINGS.forEach(b => {
            if (!GameState.buildings[b.id]) GameState.buildings[b.id] = { count: 0 };
        });
        CRYPTOS.forEach(c => {
            if (!GameState.cryptos[c.id]) GameState.cryptos[c.id] = { owned: 0, price: c.basePrice, history: [c.basePrice] };
        });
        STOCKS.forEach(s => {
            if (!GameState.stocks[s.id]) GameState.stocks[s.id] = { owned: 0, price: s.basePrice, history: [s.basePrice] };
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
        if (!GameState.cryptos[c.id]) GameState.cryptos[c.id] = { owned: 0, price: c.basePrice, history: [c.basePrice] };
    });
}

function initStocks() {
    STOCKS.forEach(s => {
        if (!GameState.stocks[s.id]) GameState.stocks[s.id] = { owned: 0, price: s.basePrice, history: [s.basePrice] };
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
    renderStocks();
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
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = GameState.unlockedAchievements.includes(ach.id);
        const item = document.createElement('div');
        item.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        item.textContent = unlocked ? ach.icon : '🔒';
        const tooltip = unlocked
            ? `${ach.name}\n${ach.comment}`
            : `???\n条件: ${maskLockedNames(ach.condition)}`;
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
        } else if (b.autoTradeStocks) {
            effectText = count > 0 ? `📊 ${count}取引/s 株式自動売買` : '📊 株式自動売買';
        } else if (b.autoTrade) {
            effectText = count > 0 ? `🤖 ${count}取引/s 全資産自動売買` : '🤖 全資産自動売買';
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
                    <div class="buy-group">
                        <button class="buy-button"  ${GameState.tokens < cr.price     ? 'disabled' : ''}>×1<span class="btn-price">${fmt(cr.price)}</span></button>
                        <button class="buy-button"  ${GameState.tokens < cr.price*10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(cr.price*10)}</span></button>
                        <button class="buy-button"  ${GameState.tokens < cr.price*100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(cr.price*100)}</span></button>
                    </div>
                </div>
                <div class="trade-row">
                    <span class="trade-label sell-label">売</span>
                    <div class="buy-group">
                        <button class="sell-button" ${cr.owned < 1   ? 'disabled' : ''}>×1<span class="btn-price">${fmt(cr.price)}</span></button>
                        <button class="sell-button" ${cr.owned < 10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(cr.price*10)}</span></button>
                        <button class="sell-button" ${cr.owned < 100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(cr.price*100)}</span></button>
                    </div>
                </div>
            </div>`;
        const buyBtns  = card.querySelectorAll('.buy-button');
        const sellBtns = card.querySelectorAll('.sell-button');
        buyBtns[0].onclick  = () => buyCrypto(c.id, 1);
        buyBtns[1].onclick  = () => buyCrypto(c.id, 10);
        buyBtns[2].onclick  = () => buyCrypto(c.id, 100);
        sellBtns[0].onclick = () => sellCrypto(c.id, 1);
        sellBtns[1].onclick = () => sellCrypto(c.id, 10);
        sellBtns[2].onclick = () => sellCrypto(c.id, 100);
        el.appendChild(card);
    });
}

// ===== 株式描画 =====
function renderStocks() {
    const el = document.getElementById('stocksListFull');
    if (!el) return;
    el.innerHTML = '';
    STOCKS.forEach(s => {
        const isUnlocked = !s.unlockCondition || s.unlockCondition(GameState);
        const card = document.createElement('div');

        if (!isUnlocked) {
            card.className = 'item-card locked-card';
            card.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${s.icon} ??? 🔒</div>
                    <div class="item-effect locked-hint">${s.unlockDesc}</div>
                </div>`;
            el.appendChild(card);
            return;
        }

        const st     = GameState.stocks[s.id];
        const prev   = st.history[st.history.length - 2] || st.price;
        const change = st.price - prev;
        const pct    = ((change / prev) * 100).toFixed(1);
        const trendColor = change >= 0 ? '#4caf50' : '#f44336';

        card.className = 'item-card trade-card';
        card.setAttribute('data-tooltip', `${s.desc}\n配当: 保有株 × 価格 × ${(s.dividendRate * 100).toFixed(1)}%/秒`);
        card.innerHTML = `
            <div class="item-info">
                <div class="item-name">${s.icon} ${s.name} <span class="item-count">${st.owned}</span></div>
                <div class="item-effect" style="color:${trendColor}">
                    ¥${fmt(st.price)} (${pct > 0 ? '+' : ''}${pct}%)
                </div>
                ${chartHTML(st.history, trendColor, s.id)}
            </div>
            <div class="item-trade">
                <div class="trade-row">
                    <span class="trade-label buy-label">買</span>
                    <div class="buy-group">
                        <button class="buy-button"  ${GameState.tokens < st.price     ? 'disabled' : ''}>×1<span class="btn-price">${fmt(st.price)}</span></button>
                        <button class="buy-button"  ${GameState.tokens < st.price*10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(st.price*10)}</span></button>
                        <button class="buy-button"  ${GameState.tokens < st.price*100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(st.price*100)}</span></button>
                    </div>
                </div>
                <div class="trade-row">
                    <span class="trade-label sell-label">売</span>
                    <div class="buy-group">
                        <button class="sell-button" ${st.owned < 1   ? 'disabled' : ''}>×1<span class="btn-price">${fmt(st.price)}</span></button>
                        <button class="sell-button" ${st.owned < 10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(st.price*10)}</span></button>
                        <button class="sell-button" ${st.owned < 100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(st.price*100)}</span></button>
                    </div>
                </div>
            </div>`;
        const buyBtns  = card.querySelectorAll('.buy-button');
        const sellBtns = card.querySelectorAll('.sell-button');
        buyBtns[0].onclick  = () => buyStock(s.id, 1);
        buyBtns[1].onclick  = () => buyStock(s.id, 10);
        buyBtns[2].onclick  = () => buyStock(s.id, 100);
        sellBtns[0].onclick = () => sellStock(s.id, 1);
        sellBtns[1].onclick = () => sellStock(s.id, 10);
        sellBtns[2].onclick = () => sellStock(s.id, 100);
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

    STOCKS.forEach(s => {
        if (!GameState.stockTrends[s.id] || GameState.stockTrends[s.id].duration <= 0) {
            GameState.stockTrends[s.id] = {
                trend:    (Math.random() - 0.48) * s.trendStrength,
                duration: 5 + Math.floor(Math.random() * 16),
            };
        }
        GameState.stockTrends[s.id].duration--;
        const st    = GameState.stocks[s.id];
        const noise = (Math.random() - 0.5) * s.noise;
        st.price = Math.max(1, st.price + GameState.stockTrends[s.id].trend + noise);
        st.history.push(st.price);
        if (st.history.length > 60) st.history.shift();
    });
}

// ===== ニューハーフトレードエフェクト =====
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

// ===== 自動売買ヘルパー =====
function autoTradeStock(s, label) {
    const st = GameState.stocks[s.id];
    if (st.history.length < 10) return false;
    if (s.unlockCondition && !s.unlockCondition(GameState)) return false;

    const recentMin  = Math.min(...st.history);
    const recentMax  = Math.max(...st.history);
    const buyThresh  = recentMin * 1.05;
    const sellThresh = recentMax * 0.95;

    if (st.price <= buyThresh && GameState.tokens >= st.price) {
        GameState.tokens -= st.price;
        st.owned++;
        GameState.totalStockTraded += st.price;
        // 自動売買通知はオフ
        return true;
    } else if (st.price >= sellThresh && st.owned > 0) {
        const earned = st.price;
        st.owned--;
        GameState.tokens += earned;
        GameState.totalTokensEarned += earned;
        GameState.totalStockTraded += earned;
        // 自動売買通知はオフ
        return true;
    }
    return false;
}

// ===== 取引所・夜の株式ディーラー 自動売買 =====
function autoTrade() {
    // 夜の株式ディーラー: 株式のみ自動売買
    const newhalfCount = GameState.buildings['newhalf']?.count ?? 0;
    if (newhalfCount > 0) {
        let stockTradesLeft = newhalfCount;
        for (const s of STOCKS) {
            if (stockTradesLeft <= 0) break;
            if (autoTradeStock(s, '💃')) {
                showHeartFloat();
                stockTradesLeft--;
            }
        }
    }

    // 取引所: 暗号資産＋株式を全対象
    const exchangeCount = GameState.buildings['exchange']?.count ?? 0;
    if (exchangeCount === 0) return;

    let tradesLeft = exchangeCount;

    // 暗号資産
    for (const c of CRYPTOS) {
        if (tradesLeft <= 0) break;
        if (c.unlockCondition && !c.unlockCondition(GameState)) continue;
        const cr = GameState.cryptos[c.id];
        if (cr.history.length < 10) continue;

        const recentMin  = Math.min(...cr.history);
        const recentMax  = Math.max(...cr.history);
        const buyThresh  = recentMin * 1.05;
        const sellThresh = recentMax * 0.95;

        if (cr.price <= buyThresh && GameState.tokens >= cr.price) {
            GameState.tokens -= cr.price;
            cr.owned++;
            GameState.totalStockTraded += cr.price;
            // 自動売買通知はオフ
            tradesLeft--;
        } else if (cr.price >= sellThresh && cr.owned > 0) {
            const earned = cr.price;
            cr.owned--;
            GameState.tokens += earned;
            GameState.totalTokensEarned += earned;
            // 自動売買通知はオフ
            tradesLeft--;
        }
    }

    // 株式
    for (const s of STOCKS) {
        if (tradesLeft <= 0) break;
        if (autoTradeStock(s, '🤖')) tradesLeft--;
    }
}

// ===== ゲームループ =====
function gameLoop() {
    setInterval(() => {
        tick++;

        // 通常施設からの生産（autoClick/autoTrade施設を除く）
        let prod = 0;
        BUILDINGS.forEach(b => {
            if (b.autoClick || b.autoTrade || b.autoTradeStocks) return;
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

        // 株式配当（毎秒）
        STOCKS.forEach(s => {
            const dividends = GameState.stocks[s.id].owned * GameState.stocks[s.id].price * s.dividendRate;
            GameState.tokens += dividends;
            GameState.totalTokensEarned += dividends;
        });

        // 取引所 自動売買
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
    render();
    updateDisplay();
    showNotification(`${c.icon} ${c.name} ×${n} 売却 +${fmt(earned)}`, 'sell');
}

function buyStock(id, n = 1) {
    const s   = STOCKS.find(s => s.id === id);
    const st  = GameState.stocks[id];
    const price = st.price * n;
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        st.owned += n;
        GameState.totalStockTraded += price;
        render();
        showNotification(`${s.icon} ${s.name} ×${n} 購入`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function sellStock(id, n = 1) {
    const s  = STOCKS.find(s => s.id === id);
    const st = GameState.stocks[id];
    if (st.owned < n) { showNotification(`保有数が足りません`, 'error'); return; }
    const earned = st.price * n;
    st.owned -= n;
    GameState.tokens += earned;
    GameState.totalTokensEarned += earned;
    GameState.totalStockTraded += earned;
    render();
    updateDisplay();
    showNotification(`${s.icon} ${s.name} ×${n} 売却 +${fmt(earned)}`, 'sell');
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
    STOCKS.forEach(s => {
        port += GameState.stocks[s.id].owned * GameState.stocks[s.id].price;
    });
    if (el('portfolioValue')) el('portfolioValue').textContent = fmt(port);
}

function updateCharts() {}

window.addEventListener('DOMContentLoaded', init);
