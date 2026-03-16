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
    buildings: {},
    virtualA: 0,
    virtualAPrice: 40000,
    virtualAPriceHistory: [40000],
    stocks: {},
    entrepreneurLevel: 1,
    productionHistory: [0],
    unlockedAchievements: [],
};

let upgradesChart = null;
let buildingsChart = null;
let cryptoChart = null;
let stocksChart = null;
let tick = 0;

// 建物定義
const BUILDINGS = [
    { id: 'vegetable', name: '野菜農園',   desc: '農業×テクノロジーで世界を変える（言いすぎ）',        icon: '🥬', basePrice: 10,     baseProduction: 0.1, multiplier: 1.15 },
    { id: 'sns',       name: 'SNS配信局',  desc: '毎日更新が信者を生む。フォロワー数が影響力の証明',   icon: '📱', basePrice: 100,    baseProduction: 1,   multiplier: 1.15 },
    { id: 'rocket',    name: 'ロケット工場', desc: '宇宙から地球を見下ろす男の夢。規制なんか関係ない', icon: '🚀', basePrice: 1000,   baseProduction: 5,   multiplier: 1.15 },
    { id: 'media',     name: 'メディア帝国', desc: '情報こそ21世紀の石油だ。全チャンネル買収を目指せ', icon: '📺', basePrice: 10000,  baseProduction: 15,  multiplier: 1.15 },
    { id: 'exchange',  name: '取引所',     desc: '規制が来る前に稼ぎきれ。銀行なんていらない',        icon: '💰', basePrice: 100000, baseProduction: 50,  multiplier: 1.15 },
];

// 株式定義
const STOCKS = [
    { id: 'video', name: '動画配信株',     desc: 'ネット動画を牛耳る企業への投資',   basePrice: 100 },
    { id: 'space', name: '宇宙ビジネス株', desc: '民間ロケット企業。夢は大きく',     basePrice: 300 },
];

// 実績定義（旧スキル含む。解放で clickValue 上昇）
const ACHIEVEMENTS = [
    // ゲーム開始
    { id: 'first_click',   name: '最初のクリック',      icon: '🖱️',
      comment: '伝説の始まり',             condition: '1回クリック',
      check: gs => gs.totalTokensEarned > 0,
      bonus: 0 },

    // 施設系
    { id: 'veggie_eater',  name: '野菜を食べる',         icon: '🥕',
      comment: '健康は最大の自己投資',     condition: '野菜農園を1個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 1,
      bonus: 1 },

    { id: 'streamer',      name: '配信力の向上',         icon: '📹',
      comment: 'フォロワーが影響力になる', condition: 'SNS配信局を3個購入',
      check: gs => (gs.buildings['sns']?.count ?? 0) >= 3,
      bonus: 2 },

    { id: 'flamewar',      name: '炎上を制する',         icon: '🔥',
      comment: '炎上は無料の広告。論破！', condition: '施設を合計5個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 5,
      bonus: 5 },

    { id: 'network',       name: '人脈の多様化',         icon: '👯',
      comment: '常識外の人脈が革命を起こす', condition: '施設を合計10個購入',
      check: gs => Object.values(gs.buildings).reduce((a, b) => a + b.count, 0) >= 10,
      bonus: 15 },

    { id: 'tv_contract',   name: 'テレビ局との契約',     icon: '📡',
      comment: 'でもネットの方が自由だ',   condition: 'メディア帝国を1個購入',
      check: gs => (gs.buildings['media']?.count ?? 0) >= 1,
      bonus: 60 },

    { id: 'rocket_plan',   name: 'ロケット打ち上げ計画', icon: '🌌',
      comment: '笑った奴を宇宙から見下ろす', condition: 'ロケット工場を5個購入',
      check: gs => (gs.buildings['rocket']?.count ?? 0) >= 5,
      bonus: 100 },

    { id: 'veggie_love',   name: '究極の野菜愛',         icon: '🌱',
      comment: '野菜は裏切らない',         condition: '野菜農園を20個購入',
      check: gs => (gs.buildings['vegetable']?.count ?? 0) >= 20,
      bonus: 300 },

    // トークン系
    { id: 'fan_event',     name: '信者獲得イベント',     icon: '⭐',
      comment: '有料サロンで月額課金が基本', condition: '累計1万トークン',
      check: gs => gs.totalTokensEarned >= 10000,
      bonus: 40 },

    { id: 'philosophy',    name: '経営哲学の完成',       icon: '🧠',
      comment: '時間こそ唯一の有限資産',   condition: '累計10万トークン',
      check: gs => gs.totalTokensEarned >= 100000,
      bonus: 150 },

    { id: 'millionaire',   name: 'ミリオネア',           icon: '💰',
      comment: '金は時間で稼ぐ。論破！',   condition: '累計100万トークン',
      check: gs => gs.totalTokensEarned >= 1000000,
      bonus: 0 },

    // 仮想通貨系
    { id: 'crypto_know',   name: '仮想通貨の知識',       icon: '💎',
      comment: '中央銀行に依存するな',     condition: 'すげぇトークンを5個購入',
      check: gs => gs.virtualA >= 5,
      bonus: 10 },

    { id: 'crypto_trader', name: '仮想通貨の覇者',       icon: '📈',
      comment: 'ブロックチェーンは国家を超える', condition: 'すげぇトークンを50個購入',
      check: gs => gs.virtualA >= 50,
      bonus: 0 },

    // 株式系
    { id: 'bbs_peace',     name: '掲示板の人との和解',   icon: '🤝',
      comment: 'ネットの敵も酒を飲めば友達', condition: '株を5株以上保有',
      check: gs => Object.values(gs.stocks).reduce((a, s) => a + s.owned, 0) >= 5,
      bonus: 25 },

    { id: 'world_power',   name: '世界規模の影響力',     icon: '🌍',
      comment: '全メディア買収（予定）',   condition: '株を50株以上保有',
      check: gs => Object.values(gs.stocks).reduce((a, s) => a + s.owned, 0) >= 50,
      bonus: 200 },
];

// 初期化
function init() {
    loadData();
    initBuildings();
    initStocks();
    recalcClickValue();
    initCharts();
    render();
    setupEvents();
    setupTooltip();
    gameLoop();
}

function loadData() {
    try {
        const saved = localStorage.getItem('game');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(GameState, parsed);
            if (!GameState.unlockedAchievements) GameState.unlockedAchievements = [];
            if (!GameState.productionHistory)    GameState.productionHistory = [0];
            if (!GameState.virtualAPriceHistory) GameState.virtualAPriceHistory = [40000];
            BUILDINGS.forEach(b => {
                if (!GameState.buildings[b.id]) GameState.buildings[b.id] = { count: 0 };
            });
            STOCKS.forEach(s => {
                if (!GameState.stocks[s.id]) GameState.stocks[s.id] = { owned: 0, price: s.basePrice, history: [s.basePrice] };
            });
        }
    } catch (e) {
        console.error('Load data error:', e);
        localStorage.removeItem('game');
    }
}

// ロード後に解放済み実績からクリック値を再計算
function recalcClickValue() {
    GameState.clickValue = 1;
    ACHIEVEMENTS.forEach(ach => {
        if (ach.bonus && GameState.unlockedAchievements.includes(ach.id)) {
            GameState.clickValue += ach.bonus;
        }
    });
}

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

function initCharts() {
    // Chart.js は任意実装 - 現在は無効
}

function render() {
    renderAchievements();
    renderBuildings();
    renderCrypto();
    renderStocks();
}

function renderAchievements() {
    const el = document.getElementById('achievementsList');
    if (!el) return;
    el.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = GameState.unlockedAchievements.includes(ach.id);
        const item = document.createElement('div');
        item.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        item.textContent = unlocked ? ach.icon : '🔒';
        item.setAttribute('data-tooltip',
            unlocked ? `${ach.name}\n${ach.comment}` : `${ach.name}\n条件: ${ach.condition}`
        );
        el.appendChild(item);
    });
}

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
        const count = GameState.buildings[b.id].count;
        const prod  = count > 0 ? b.baseProduction * count * Math.pow(b.multiplier, count - 1) : 0;
        const p1    = bulkBuildingPrice(b, 1);
        const p10   = bulkBuildingPrice(b, 10);
        const p100  = bulkBuildingPrice(b, 100);
        const card  = document.createElement('div');
        card.className = `item-card ${GameState.tokens < p1 ? 'unaffordable' : ''}`;
        card.setAttribute('data-tooltip', b.desc);
        card.innerHTML = `
            <div class="item-info">
                <div class="item-name">${b.icon} ${b.name} <span class="item-count">${count}</span></div>
                <div class="item-effect">+${fmt(prod)}/s</div>
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

function renderCrypto() {
    const el = document.getElementById('cryptoListFull');
    if (!el) return;
    el.innerHTML = '';
    const prev   = GameState.virtualAPriceHistory[GameState.virtualAPriceHistory.length - 2] || GameState.virtualAPrice;
    const change = GameState.virtualAPrice - prev;
    const pct    = GameState.virtualAPriceHistory.length > 1 ? ((change / prev) * 100).toFixed(1) : 0;
    const p1     = GameState.virtualAPrice;
    const p10    = p1 * 10;
    const p100   = p1 * 100;
    const card   = document.createElement('div');
    card.className = `item-card ${GameState.tokens < p1 ? 'unaffordable' : ''}`;
    card.setAttribute('data-tooltip', '時間を価値に変える謎の通貨\n保有数 × 0.5/秒を生産');
    card.innerHTML = `
        <div class="item-info">
            <div class="item-name">⏰ すげぇトークン <span class="item-count">${GameState.virtualA}</span></div>
            <div class="item-effect" style="color:${change >= 0 ? '#4caf50' : '#f44336'}">
                $${fmt(p1)} (${pct > 0 ? '+' : ''}${pct}%)
            </div>
        </div>
        <div class="buy-group">
            <button class="buy-button" ${GameState.tokens < p1   ? 'disabled' : ''}>×1<span class="btn-price">${fmt(p1)}</span></button>
            <button class="buy-button" ${GameState.tokens < p10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(p10)}</span></button>
            <button class="buy-button" ${GameState.tokens < p100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(p100)}</span></button>
        </div>`;
    const btns = card.querySelectorAll('.buy-button');
    btns[0].onclick = () => buyCrypto(1);
    btns[1].onclick = () => buyCrypto(10);
    btns[2].onclick = () => buyCrypto(100);
    el.appendChild(card);
}

function renderStocks() {
    const el = document.getElementById('stocksListFull');
    if (!el) return;
    el.innerHTML = '';
    STOCKS.forEach(s => {
        const st   = GameState.stocks[s.id];
        const prev = st.history[st.history.length - 2] || st.price;
        const change = st.price - prev;
        const pct  = ((change / prev) * 100).toFixed(1);
        const p1   = st.price;
        const p10  = p1 * 10;
        const p100 = p1 * 100;
        const card = document.createElement('div');
        card.className = `item-card ${GameState.tokens < p1 ? 'unaffordable' : ''}`;
        card.setAttribute('data-tooltip', `${s.desc}\n保有株 × 価格 × 1%を2秒ごとに配当`);
        card.innerHTML = `
            <div class="item-info">
                <div class="item-name">${s.name} <span class="item-count">${st.owned}</span></div>
                <div class="item-effect" style="color:${change >= 0 ? '#4caf50' : '#f44336'}">
                    ¥${fmt(p1)} (${pct > 0 ? '+' : ''}${pct}%)
                </div>
            </div>
            <div class="buy-group">
                <button class="buy-button" ${GameState.tokens < p1   ? 'disabled' : ''}>×1<span class="btn-price">${fmt(p1)}</span></button>
                <button class="buy-button" ${GameState.tokens < p10  ? 'disabled' : ''}>×10<span class="btn-price">${fmt(p10)}</span></button>
                <button class="buy-button" ${GameState.tokens < p100 ? 'disabled' : ''}>×100<span class="btn-price">${fmt(p100)}</span></button>
            </div>`;
        const btns = card.querySelectorAll('.buy-button');
        btns[0].onclick = () => buyStock(s.id, 1);
        btns[1].onclick = () => buyStock(s.id, 10);
        btns[2].onclick = () => buyStock(s.id, 100);
        el.appendChild(card);
    });
}

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

// JS ベースのツールチップ（position:fixed でレイヤー問題なし）
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

function gameLoop() {
    setInterval(() => {
        let prod = 0;
        BUILDINGS.forEach(b => {
            const count = GameState.buildings[b.id].count;
            if (count > 0) prod += b.baseProduction * count * Math.pow(b.multiplier, count - 1);
        });
        prod += GameState.virtualA * 0.5;
        GameState.perSecond = prod;
        GameState.productionHistory.push(prod);
        if (GameState.productionHistory.length > 30) GameState.productionHistory.shift();
        GameState.tokens += prod;
        GameState.totalTokensEarned += prod;
        updateDisplay();
        updateGameDate();
        checkAchievements();
    }, 1000);

    setInterval(() => {
        tick++;
        GameState.virtualAPrice = Math.max(10000, GameState.virtualAPrice + (Math.random() - 0.5) * 4000);
        GameState.virtualAPriceHistory.push(GameState.virtualAPrice);
        if (GameState.virtualAPriceHistory.length > 30) GameState.virtualAPriceHistory.shift();

        STOCKS.forEach(s => {
            const st = GameState.stocks[s.id];
            st.price = Math.max(10, st.price + (Math.random() - 0.5) * 100);
            st.history.push(st.price);
            if (st.history.length > 30) st.history.shift();
        });

        let dividends = 0;
        STOCKS.forEach(s => {
            dividends += GameState.stocks[s.id].owned * GameState.stocks[s.id].price * 0.01;
        });
        GameState.tokens += dividends;
        GameState.totalTokensEarned += dividends;

        if (tick % 3 === 0) {
            updateCharts();
            render();
        }
    }, 2000);

    setInterval(() => localStorage.setItem('game', JSON.stringify(GameState)), 5000);
}

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

function buyBuilding(b, n = 1) {
    const price = bulkBuildingPrice(b, n);
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        GameState.buildings[b.id].count += n;
        GameState.purchaseCount += n;
        GameState.entrepreneurLevel = Math.floor(Math.sqrt(GameState.purchaseCount)) + 1;
        updateCharts();
        render();
        showNotification(`${b.icon} ${b.name} ×${n}`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function buyCrypto(n = 1) {
    const price = GameState.virtualAPrice * n;
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        GameState.virtualA += n;
        render();
        showNotification(`⏰ すげぇトークン ×${n}`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function buyStock(id, n = 1) {
    const s     = STOCKS.find(s => s.id === id);
    const st    = GameState.stocks[id];
    const price = st.price * n;
    if (GameState.tokens >= price) {
        GameState.tokens -= price;
        st.owned += n;
        render();
        showNotification(`📊 ${s.name} ×${n}`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`${fmt(price - GameState.tokens)} 不足`, 'error');
    }
}

function updateDisplay() {
    const el = id => document.getElementById(id);
    if (el('tokenCount'))      el('tokenCount').textContent      = fmt(GameState.tokens);
    if (el('perSecond'))       el('perSecond').textContent       = fmt(GameState.perSecond);
    if (el('totalTokens'))     el('totalTokens').textContent     = fmt(GameState.totalTokensEarned);
    if (el('clickValue'))      el('clickValue').textContent      = fmt(GameState.clickValue);
    if (el('arenaPerSecond'))  el('arenaPerSecond').textContent  = fmt(GameState.perSecond);
    if (el('entrepreneurLevel')) el('entrepreneurLevel').textContent = `Lv.${GameState.entrepreneurLevel}`;
    if (el('arenaLevel'))      el('arenaLevel').textContent      = GameState.entrepreneurLevel;

    let port = GameState.tokens;
    BUILDINGS.forEach(b => {
        const count = GameState.buildings[b.id].count;
        for (let i = 0; i < count; i++) port += b.basePrice * Math.pow(b.multiplier, i);
    });
    port += GameState.virtualA * GameState.virtualAPrice;
    STOCKS.forEach(s => { port += GameState.stocks[s.id].owned * GameState.stocks[s.id].price; });
    if (el('portfolioValue')) el('portfolioValue').textContent = fmt(port);
}

function updateCharts() {
    // Chart.js は任意実装 - 現在は無効
}

function initBuildings() {
    BUILDINGS.forEach(b => {
        if (!GameState.buildings[b.id]) GameState.buildings[b.id] = { count: 0 };
    });
}

function initStocks() {
    STOCKS.forEach(s => {
        if (!GameState.stocks[s.id]) GameState.stocks[s.id] = { owned: 0, price: s.basePrice, history: [s.basePrice] };
    });
}

window.addEventListener('DOMContentLoaded', init);
