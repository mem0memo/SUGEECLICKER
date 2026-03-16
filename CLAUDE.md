# すげぇトークンクリッカー - CLAUDE.md

## プロジェクト概要

クッキークリッカー風のインクリメンタルゲーム。
ホリエモンをモチーフにした起業家をテーマにしたコメディ路線。

- **技術スタック**: HTML + CSS + Vanilla JS (フレームワークなし)
- **エントリポイント**: `index.html` をブラウザで直接開くだけで動く
- **保存**: `localStorage` キー `'game'` に JSON で自動保存

## ファイル構成

```
index.html   - 画面構造。JS は game.js を末尾で読み込み
style.css    - スタイル。CSS変数 (:root) でテーマ管理
game.js      - ゲームロジック全体
```

## データ構造

```js
GameState = {
    tokens, totalTokensEarned, clickValue, perSecond,
    purchaseCount, entrepreneurLevel,
    buildings: { [id]: { count } },
    virtualA,               // 暗号資産の保有数
    virtualAPrice,          // 現在価格
    virtualAPriceHistory,   // 価格履歴 (最大30件)
    stocks: { [id]: { owned, price, history } },
    achievements, unlockedAchievements,
    clickValueHistory, productionHistory
}
```

定義配列: `BUILDINGS`, `UPGRADES`, `STOCKS`, `ACHIEVEMENTS`

## 既知のバグ（要修正）

### クリティカル（ゲームが動かない原因）

1. **`game.js` line 135: 関数外の迷子コード**
   ```js
   // initStocks の閉じ括弧の後に、スコープなしで下記が存在:
   if (!GameState.stocks[s.id]) GameState.stocks[s.id] = ...
   ```
   `s` が未定義なので `ReferenceError` でスクリプトが止まる。削除する。

2. **`tick` が未宣言**
   `gameLoop()` 内の `setInterval` で `tick++` しているが `let tick = 0;` の宣言がない。
   ファイル先頭かモジュールスコープに追加する。

### 中程度

3. **アップグレードを何度でも購入できる**
   `UPGRADES` に `purchased` フラグがなく `buyUpgrade()` に重複チェックがない。
   購入済みのアップグレードは表示から除外するか、ボタンを無効化する。

4. **施設 0 個でも生産が発生する**
   `gameLoop` の生産計算:
   ```js
   prod += b.baseProduction * Math.pow(b.multiplier, count)
   // count=0 のとき Math.pow(1.15, 0) = 1 なので 0.1 が加算される
   ```
   正しくは `count === 0 ? 0 : b.baseProduction * count * ...` など count を乗算に含める。

### 軽微

5. `HOWTOPLAY.md` の "🎯 ゲー\nムバランス" が行をまたいで壊れている（表示崩れ）

## 設計方針

- **シンプルさを維持**: 外部ライブラリは追加しない。Chart.js は現在無効化済み（`initCharts` は空）
- **実存する企業・人物名を避ける**: ゲーム内テキストは架空の名称を使う
- **ゲームバランス**: 施設のコストは `basePrice * multiplier^count` で指数的に上昇

## テスト方法

ブラウザで `index.html` を直接開く。DevTools の Console (F12) でエラーを確認する。

リセット方法: DevTools → Application → Local Storage → キー `game` を削除 → リロード
