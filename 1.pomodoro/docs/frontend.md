# フロントエンド ドキュメント

ポモドーロタイマーアプリのフロントエンド実装を説明します。

---

## ファイル構成

| ファイル | 説明 |
|---|---|
| `templates/index.html` | 単一ページの HTML テンプレート |
| `static/js/timer.js` | タイマーロジック・状態管理・UI 描画・API 通信 |
| `static/css/style.css` | スタイルシート（CSS カスタムプロパティ使用） |

---

## `timer.js`

タイマーのすべてのロジックが単一ファイルに実装されています。

### 定数

| 定数 | 説明 |
|---|---|
| `MODES` | モード名と表示ラベルの対応マップ（`work`, `short_break`, `long_break`） |
| `TIMER_STATES` | タイマー状態の列挙（`idle`, `running`, `paused`） |
| `DEFAULT_SETTINGS` | API 取得失敗時のフォールバック設定値 |
| `RADIUS` | プログレスリングの半径（92px） |
| `CIRCUMFERENCE` | プログレスリングの周長（`2π × 92`） |

---

### 状態管理

グローバル変数 `state` でアプリ全体の状態を管理します。

```js
const state = {
  settings: { ...DEFAULT_SETTINGS },
  mode: "work",
  timerState: TIMER_STATES.idle,
  endTimeMs: null,
  remainingMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
  sessionDurationMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
  completedWorkCycles: 0,
  progress: { date, completed_sessions, focus_minutes },
};
```

---

### タイマー動作

- **時間計測方式**: 終了予定時刻（`endTimeMs = Date.now() + remainingMs`）を記録し、250ms ごとのインターバル（`setInterval`）で残り時間を再計算します。タブ非アクティブやスリープ復帰時のズレを最小化するためにこの方式を採用しています。

- **モード遷移**:
  - 作業セッション完了 → 短休憩または長休憩へ遷移
  - 休憩セッション完了 → 作業へ遷移
  - セッション完了後は自動開始せず `idle` 状態で待機

- **長休憩判定**: `completedWorkCycles` が `long_break_interval` の倍数になった直後に長休憩を選択します。

---

### 主要関数

| 関数 | 説明 |
|---|---|
| `initialize()` | 起動時に設定・進捗を読み込み、イベントリスナーを登録し、初期描画を実行 |
| `startTimer()` | タイマーを開始または再開する |
| `pauseTimer()` | タイマーを一時停止する |
| `resetTimer()` | タイマーを `idle` 状態・`work` モードにリセットする |
| `tick()` | 250ms ごとに残り時間を更新し、0 になったらセッション完了を処理する |
| `finishSession()` | セッション完了処理（進捗更新・モード遷移・API 送信） |
| `setMode(mode)` | モードを切り替え、セッション時間をリセットする |
| `render()` | 現在の `state` を DOM に反映する |
| `progressPercent()` | 経過時間からプログレスリングの進捗率（0〜1）を計算する |
| `formatMs(ms)` | ミリ秒を `MM:SS` 形式の文字列に変換する |

---

### 進捗の永続化と同期

**ローカル保存**（`localStorage`）

- キー形式: `pomodoro-progress:YYYY-MM-DD`
- 作業セッション完了時に `completed_sessions +1`、`focus_minutes + work_minutes` を保存

**サーバーとの同期**（起動時のみ）

1. `GET /api/progress/today?date=<today>` でサーバー側の進捗を取得
2. ローカル値とサーバー値を比較し、それぞれ大きい方を採用（`Math.max`）
3. API 障害時はローカルデータを継続利用（エラーを無視）

**作業完了時の送信**

- `POST /api/sessions/complete` に `{"mode": "work"}` を送信
- 送信失敗時もクライアント側の動作を優先（エラーを無視）

---

### UI コンポーネント

| 要素 ID | 役割 |
|---|---|
| `progressRing` | SVG の進捗リング（`stroke-dashoffset` で進捗を表現） |
| `modeLabel` | 現在のモード名（「作業中」「短い休憩」「長い休憩」） |
| `timeLabel` | 残り時間（`MM:SS` 形式） |
| `primaryButton` | 開始 / 一時停止 / 再開の切替ボタン |
| `resetButton` | リセットボタン |
| `statusLabel` | タイマー状態（「待機中」「実行中」「一時停止中」） |
| `completedSessions` | 完了した作業セッション数 |
| `focusMinutes` | 集中した合計時間（分） |

---

## `style.css`

### デザイントークン（CSS カスタムプロパティ）

| 変数 | 値 | 用途 |
|---|---|---|
| `--bg-top` | `#fdf6e6` | 背景グラデーション上部 |
| `--bg-bottom` | `#ffe3dc` | 背景グラデーション下部 |
| `--card` | `#ffffff` | カード背景 |
| `--card-soft` | `#fffaf1` | 進捗カード背景 |
| `--text` | `#2b2a26` | 基本テキスト色 |
| `--muted` | `#6c685f` | サブテキスト色 |
| `--accent` | `#d94f2b` | アクセントカラー（ボタン・リング） |
| `--accent-soft` | `#ffefe8` | アクセントカラー薄版（セカンダリボタン背景） |
| `--line` | `#f0d5ca` | ボーダー色 |
| `--shadow` | `0 18px 40px rgba(131,66,42,0.16)` | カード影 |

### レスポンシブ対応

- 画面幅 900px 以下で `grid-template-columns` が 2 カラム → 1 カラムに切り替わります。

---

## `index.html`

Jinja2 テンプレート（Flask の `render_template` から返却）。静的ファイルは `url_for` で参照しています。

主要セクション:

| セクション | クラス | 説明 |
|---|---|---|
| タイマーカード | `.timer-card` | SVG プログレスリング・時間表示・操作ボタン |
| 進捗カード | `.progress-card` | 完了セッション数・集中時間の表示 |
