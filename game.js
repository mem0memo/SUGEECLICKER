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
    achievements: 0,
    clickValueHistory: [1],
    productionHistory: [0],
    unlockedAchievements: [],
    purchasedUpgrades: []
};

let upgradesChart = null;
let buildingsChart = null;
let cryptoChart = null;
let stocksChart = null;
let tick = 0;

// 建物定義
const BUILDINGS = [
    { id: 'vegetable', name: '野菜農園', desc: '新鮮な野菜をたくさん育てる', icon: '🥬', basePrice: 10, baseProduction: 0.1, multiplier: 1.15 },
    { id: 'sns', name: 'SNS配信局', desc: '信者獲得マシーン', icon: '📱', basePrice: 100, baseProduction: 1, multiplier: 1.15 },
    { id: 'rocket', name: 'ロケット工場', desc: '宇宙ビジネスに投資', icon: '🚀', basePrice: 1000, baseProduction: 5, multiplier: 1.15 },
    { id: 'media', name: 'メディア帝国', desc: '言論統制のための情報機関', icon: '📺', basePrice: 10000, baseProduction: 15, multiplier: 1.15 },
    { id: 'exchange', name: '取引所', desc: '仮想通貨を扱う市場', icon: '💰', basePrice: 100000, baseProduction: 50, multiplier: 1.15 }
];

// アップグレード定義
const UPGRADES = [
    { name: '野菜を食べる', desc: '健康第一', icon: '🥕', cost: 1, effect: 1, minEarned: 0 },
    { name: '配信力の向上', desc: '再生数を稼ぐ', icon: '📹', cost: 50, effect: 2, minEarned: 0 },
    { name: '炎上を制する', desc: 'ケンカも注目を集める', icon: '🔥', cost: 100, effect: 5, minEarned: 50 },
    { name: '仮想通貨の知識', desc: 'テクニカル分析を習得', icon: '💎', cost: 500, effect: 10, minEarned: 350 },
    { name: 'ニューハーフとの友情', desc: '多様性を受け入れる', icon: '👯', cost: 1000, effect: 15, minEarned: 1000 },
    { name: '掲示板の人との和解', desc: 'かつての敵も今は...？', icon: '🤝', cost: 2500, effect: 25, minEarned: 2500 },
    { name: '信者獲得イベント', desc: 'カリスマ性で惹きつける', icon: '⭐', cost: 5000, effect: 40, minEarned: 5000 },
    { name: 'テレビ局との契約', desc: '地上波進出', icon: '📡', cost: 10000, effect: 60, minEarned: 10000 },
    { name: 'ロケット打ち上げ計画', desc: '宇宙進出', icon: '🌌', cost: 25000, effect: 100, minEarned: 25000 },
    { name: '経営哲学の完成', desc: '時間価値を完全にする', icon: '🧠', cost: 50000, effect: 150, minEarned: 50000 },
    { name: '世界規模の影響力', desc: 'SNS統制への関心', icon: '🌍', cost: 100000, effect: 200, minEarned: 100000 },
    { name: '究極の野菜愛', desc: '野菜は人生', icon: '🌱', cost: 250000, effect: 300, minEarned: 250000 }
];

// 株式定義
const STOCKS = [
    { id: 'video', name: '動画配信株', desc: 'YouTubeのような企業', basePrice: 100 },
    { id: 'space', name: '宇宙ビジネス株', desc: 'ロケット企業', basePrice: 300 }
];

// 実績定義
const ACHIEVEMENTS = [
    { id: 'first_click', name: '最初のクリック', description: 'ゲーム開始', icon: '🖱️' },
    { id: 'buildings_10', name: '建物オーナー', description: '施設を10個所有', icon: '🏢' },
    { id: 'millionaire', name: 'ミリオネア', description: '100万トークン獲得', icon: '💰' },
    { id: 'crypto_trader', name: '仮想通貨トレーダー', description: 'すげぇトークンを50個購入', icon: '📈' }
];

// 初期化
function init() {
    console.log('Init started');
    loadData();
    initBuildings();
    initStocks();
    initCharts();
    render();
    setupEvents();
    gameLoop();
}

function loadData() {
    try {
        const saved = localStorage.getItem('game');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(GameState, parsed);
            // 後方互換性
            if (!GameState.unlockedAchievements) GameState.unlockedAchievements = [];
            if (!GameState.purchasedUpgrades) GameState.purchasedUpgrades = [];
            if (!GameState.clickValueHistory) GameState.clickValueHistory = [1];
            if (!GameState.productionHistory) GameState.productionHistory = [0];
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
        // リセット
        localStorage.removeItem('game');
    }
}

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    document.getElementById('notifications').appendChild(notif);

    setTimeout(() => notif.remove(), 3000);
}

function updateGameDate() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ja-JP').replace(/\//g, '/');
    document.getElementById('current-date').textContent = dateStr;
}

function checkAchievements() {
    console.log('Checking achievements');
    ACHIEVEMENTS.forEach(ach => {
        console.log('Checking', ach.id);
        if (GameState.unlockedAchievements?.includes(ach.id)) return;
        let unlocked = false;
        switch (ach.id) {
            case 'first_click': unlocked = GameState.totalTokensEarned > 0; break;
            case 'buildings_10': unlocked = Object.values(GameState.buildings).reduce((a, b) => a + b.count, 0) >= 10; break;
            case 'millionaire': unlocked = GameState.totalTokensEarned >= 1000000; break;
            case 'crypto_trader': unlocked = GameState.virtualA >= 50; break;
        }
        if (unlocked) {
            console.log('Unlocking', ach.id);
            GameState.unlockedAchievements.push(ach.id);
            showNotification(`🏆 Achievement: ${ach.name}`, 'achievement');
        }
    });
}

function initCharts() {
    // Chart.js removed for testing
    console.log('Charts disabled');
}

function render() {
    console.log('Rendering');
    renderAchievements();
    renderUpgrades();
    renderBuildings();
    renderCrypto();
    renderStocks();
}

function renderAchievements() {
    console.log('Rendering achievements');
    const el = document.getElementById('achievementsList');
    console.log('Achievements el:', el);
    if (!el) return;
    el.innerHTML = '';
    ACHIEVEMENTS.forEach((ach, i) => {
        console.log('Rendering ach', ach.id);
        const unlocked = GameState.unlockedAchievements?.includes(ach.id);
        const item = document.createElement('div');
        item.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        item.textContent = unlocked ? ach.icon : '🔒';
        item.setAttribute('data-tooltip', unlocked ? ach.name : '未開放');
        el.appendChild(item);
    });
}

function renderUpgrades() {
    console.log('Rendering upgrades');
    const el = document.getElementById('upgradesListFull');
    console.log('Upgrades el:', el);
    if (!el) return;
    el.innerHTML = '';
    UPGRADES.forEach(u => {
        // 購入済みは表示しない
        if (GameState.purchasedUpgrades.includes(u.name)) return;

        const unlocked = GameState.totalTokensEarned >= u.minEarned;
        const visible = GameState.totalTokensEarned >= u.minEarned * 0.5; // 50%でプレビュー表示

        if (!visible) return;

        if (!unlocked) {
            // ロックプレビュー
            const progress = Math.min(100, (GameState.totalTokensEarned / u.minEarned * 100)).toFixed(0);
            const card = document.createElement('div');
            card.className = 'item-card locked-preview';
            card.innerHTML = `
                <div class="lock-info">
                    <div class="lock-icon">🔒</div>
                    <div class="unlock-progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                        <span>${progress}% 開放まで</span>
                    </div>
                </div>
            `;
            el.appendChild(card);
            return;
        }

        // 開放済み
        const can = GameState.tokens >= u.cost;
        const card = document.createElement('div');
        card.className = `item-card ${!can ? 'unaffordable' : ''}`;
        card.innerHTML = `<div class="item-info" data-description="${u.desc}"><div class="item-name">${u.icon} ${u.name}</div><div class="item-effect">+${u.effect}</div></div><div class="item-action"><div class="price-info"><div class="price-label">$</div><div class="price-amount">${fmt(u.cost)}</div></div><button class="buy-button" ${!can ? 'disabled' : ''}>買</button></div>`;
        card.querySelector('.buy-button').onclick = () => buyUpgrade(u);
        el.appendChild(card);
    });
}

function renderBuildings() {
    const el = document.getElementById('buildingsListFull');
    if (!el) return;
    el.innerHTML = '';
    BUILDINGS.forEach(b => {
        const count = GameState.buildings[b.id].count;
        const nextPrice = b.basePrice * Math.pow(b.multiplier, count);
        const prod = count > 0 ? b.baseProduction * count * Math.pow(b.multiplier, count - 1) : 0;
        const can = GameState.tokens >= nextPrice;
        const card = document.createElement('div');
        card.className = `item-card ${!can ? 'unaffordable' : ''}`;
        card.innerHTML = `<div class="item-info" data-description="${b.desc}"><div class="item-name">${b.icon} ${b.name} (${count})</div><div class="item-effect">+${fmt(prod)}/s</div></div><div class="item-action"><div class="price-info"><div class="price-label">$</div><div class="price-amount">${fmt(nextPrice)}</div></div><button class="buy-button" ${!can ? 'disabled' : ''}>買</button></div>`;
        card.querySelector('.buy-button').onclick = () => buyBuilding(b);
        el.appendChild(card);
    });
}

function renderCrypto() {
    const el = document.getElementById('cryptoListFull');
    if (!el) return;
    el.innerHTML = '';
    if (GameState.virtualAPriceHistory.length > 0) {
        const change = GameState.virtualAPrice - (GameState.virtualAPriceHistory[GameState.virtualAPriceHistory.length - 2] || GameState.virtualAPrice);
        const pct = GameState.virtualAPriceHistory.length > 1 ? ((change / GameState.virtualAPriceHistory[GameState.virtualAPriceHistory.length - 2]) * 100).toFixed(1) : 0;
        const can = GameState.tokens >= GameState.virtualAPrice;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `<div class="item-info" data-description="時間を価値に変える謎の通貨"><div class="item-name">⏰ すげぇトークン (${GameState.virtualA})</div><div class="item-effect" style="color:${change >= 0 ? '#2ecc71' : '#e74c3c'}">$${fmt(GameState.virtualAPrice)} (${pct > 0 ? '+' : ''}${pct}%)</div></div><div class="item-action"><div class="price-info"><div class="price-label">$</div><div class="price-amount">${fmt(GameState.virtualAPrice)}</div></div><button class="buy-button" ${!can ? 'disabled' : ''}>買</button></div>`;
        card.querySelector('.buy-button').onclick = () => buyCrypto();
        el.appendChild(card);
    }
}

function renderStocks() {
    const el = document.getElementById('stocksListFull');
    if (!el) return;
    el.innerHTML = '';
    STOCKS.forEach(s => {
        const st = GameState.stocks[s.id];
        const change = st.price - (st.history[st.history.length - 2] || st.price);
        const pct = ((change / (st.history[st.history.length - 2] || st.price)) * 100).toFixed(1);
        const can = GameState.tokens >= st.price;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `<div class="item-info" data-description="${s.desc}"><div class="item-name">${s.name} (${st.owned})</div><div class="item-effect" style="color:${change >= 0 ? '#2ecc71' : '#e74c3c'}">¥${fmt(st.price)} (${pct > 0 ? '+' : ''}${pct}%)</div></div><div class="item-action"><div class="price-info"><div class="price-label">¥</div><div class="price-amount">${fmt(st.price)}</div></div><button class="buy-button" ${!can ? 'disabled' : ''}>買</button></div>`;
        card.querySelector('.buy-button').onclick = () => buyStock(s.id);
        el.appendChild(card);
    });
}

function setupEvents() {
    console.log('Setting up events');
    const btn = document.getElementById('tokenButton');
    console.log('Button element:', btn);
    if (btn) {
        btn.addEventListener('click', () => {
            console.log('Event fired!');
            click();
        });
        console.log('Event listener added');
    } else {
        console.error('Button not found');
    }
    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const id = e.target.getAttribute('data-tab');
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }));
}

function gameLoop() {
    setInterval(() => {
        let prod = 0;
        BUILDINGS.forEach(b => {
            const count = GameState.buildings[b.id].count;
            if (count > 0) prod += b.baseProduction * count * Math.pow(b.multiplier, count - 1);
        });
        // 仮想通貨収入を追加
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

        // 株式配当を追加
        let dividends = 0;
        STOCKS.forEach(s => {
            const st = GameState.stocks[s.id];
            dividends += st.owned * st.price * 0.01; // 1%配当
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
    console.log('Click event triggered');
    GameState.tokens += GameState.clickValue;
    console.log('New tokens:', GameState.tokens);
    GameState.totalTokensEarned += GameState.clickValue;
    updateDisplay();
    showNotification(`+${GameState.clickValue}`, 'click');
    checkAchievements();
}

function buyUpgrade(u) {
    if (GameState.purchasedUpgrades.includes(u.name)) return;
    if (GameState.tokens >= u.cost) {
        GameState.tokens -= u.cost;
        GameState.clickValue += u.effect;
        GameState.purchasedUpgrades.push(u.name);
        GameState.clickValueHistory.push(GameState.clickValue);
        if (GameState.clickValueHistory.length > 30) GameState.clickValueHistory.shift();
        GameState.achievements++;
        GameState.purchaseCount++;
        GameState.entrepreneurLevel = Math.floor(Math.sqrt(GameState.purchaseCount)) + 1;
        updateCharts();
        render();
        showNotification(`スキル習得: ${u.name}!`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`トークンが足りません: ${fmt(u.cost - GameState.tokens)} 必要`, 'error');
    }
}

function buyBuilding(b) {
    const count = GameState.buildings[b.id].count;
    const actualPrice = b.basePrice * Math.pow(b.multiplier, count);
    if (GameState.tokens >= actualPrice) {
        GameState.tokens -= actualPrice;
        GameState.buildings[b.id].count++;
        GameState.purchaseCount++;
        GameState.entrepreneurLevel = Math.floor(Math.sqrt(GameState.purchaseCount)) + 1;
        updateCharts();
        render();
        showNotification(`施設を購入: ${b.name}!`, 'purchase');
        checkAchievements();
    } else {
        showNotification(`トークンが足りません: ${actualPrice - GameState.tokens} 必要`, 'error');
    }
}

function buyCrypto() {
    if (GameState.tokens >= GameState.virtualAPrice) {
        GameState.tokens -= GameState.virtualAPrice;
        GameState.virtualA++;
        render();
        showNotification(`仮想通貨を購入: すげぇトークン!`, 'purchase');
        checkAchievements();
    }
}

function buyStock(id) {
    const st = GameState.stocks[id];
    if (GameState.tokens >= st.price) {
        GameState.tokens -= st.price;
        st.owned++;
        render();
        showNotification(`株式を購入: ${st.name}!`, 'purchase');
        checkAchievements();
    }
}

function updateDisplay() {
    const el = (id) => document.getElementById(id);
    if (el('tokenCount')) el('tokenCount').textContent = fmt(GameState.tokens);
    if (el('perSecond')) el('perSecond').textContent = fmt(GameState.perSecond);
    if (el('totalTokens')) el('totalTokens').textContent = fmt(GameState.totalTokensEarned);
    if (el('clickValue')) el('clickValue').textContent = GameState.clickValue;
    if (el('entrepreneurLevel')) el('entrepreneurLevel').textContent = GameState.entrepreneurLevel;

    // 正しいポートフォリオ計算
    let port = GameState.tokens;
    // 建物価値: 購入した総額
    BUILDINGS.forEach(b => {
        const count = GameState.buildings[b.id].count;
        if (count > 0) {
            let totalSpent = 0;
            for (let i = 0; i < count; i++) {
                totalSpent += b.basePrice * Math.pow(b.multiplier, i);
            }
            port += totalSpent;
        }
    });
    // 仮想通貨: 購入価格
    port += GameState.virtualA * GameState.virtualAPrice;
    // 株式: 購入価格
    STOCKS.forEach(s => port += GameState.stocks[s.id].owned * GameState.stocks[s.id].price);
    if (el('portfolioValue')) el('portfolioValue').textContent = fmt(port);
}

function updateCharts() {
    if (upgradesChart) {
        upgradesChart.data.labels = GameState.clickValueHistory.map((_, i) => i);
        upgradesChart.data.datasets[0].data = GameState.clickValueHistory;
        upgradesChart.update('none');
    }
    if (buildingsChart) {
        buildingsChart.data.labels = GameState.productionHistory.map((_, i) => i);
        buildingsChart.data.datasets[0].data = GameState.productionHistory;
        buildingsChart.update('none');
    }
    if (cryptoChart) {
        cryptoChart.data.labels = GameState.virtualAPriceHistory.map((_, i) => i);
        cryptoChart.data.datasets[0].data = GameState.virtualAPriceHistory;
        cryptoChart.update('none');
    }
    if (stocksChart) {
        const maxLen = Math.max(...STOCKS.map(s => GameState.stocks[s.id].history.length), 1);
        stocksChart.data.labels = Array(maxLen).fill(0).map((_, i) => i);
        STOCKS.forEach((s, i) => {
            stocksChart.data.datasets[i].data = GameState.stocks[s.id].history;
        });
        stocksChart.update('none');
    }
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
