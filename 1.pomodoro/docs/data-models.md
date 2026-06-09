# データモデル仕様

ポモドーロタイマーアプリで使用するデータ構造を説明します。

---

## サーバー側データモデル

### `DailyProgress`（`services/progress_service.py`）

当日の作業進捗を表すデータクラスです。

| フィールド | 型 | 説明 |
|---|---|---|
| `date` | `str` | 日付（`YYYY-MM-DD` 形式） |
| `completed_sessions` | `int` | 完了した作業セッション数（0以上） |
| `focus_minutes` | `int` | 集中した合計時間（分・0以上） |

**定義**

```python
@dataclass
class DailyProgress:
    date: str
    completed_sessions: int
    focus_minutes: int
```

**JSON シリアライズ（`to_dict()`）**

```json
{
  "date": "2026-06-09",
  "completed_sessions": 3,
  "focus_minutes": 75
}
```

---

### `ProgressService`（`services/progress_service.py`）

`DailyProgress` のインメモリストアとその操作を提供するサービスクラスです。

内部状態として `_daily: dict[str, DailyProgress]` を保持し、日付文字列をキーにしてレコードを管理します。スレッドセーフのため `threading.Lock` を使用しています。

**主要メソッド**

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `get_today_progress(date_key=None)` | `dict` | 指定日（省略時は当日）の進捗を返す。存在しなければ初期値 0 で作成する。 |
| `add_work_completion(focus_minutes)` | `dict` | 当日の `completed_sessions` を +1、`focus_minutes` を加算する。負の値は 0 として扱う。 |

---

## クライアント側データ構造

### 進捗オブジェクト（`timer.js`）

JavaScript の状態オブジェクト (`state.progress`) および `localStorage` に保存される形式です。

```json
{
  "date": "2026-06-09",
  "completed_sessions": 3,
  "focus_minutes": 75
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `date` | string | 対象日付（`YYYY-MM-DD`） |
| `completed_sessions` | number | 完了した作業セッション数 |
| `focus_minutes` | number | 集中した合計時間（分） |

**`localStorage` のキー形式**: `pomodoro-progress:YYYY-MM-DD`

---

### タイマー状態オブジェクト（`timer.js` の `state`）

| フィールド | 型 | 説明 |
|---|---|---|
| `settings` | object | サーバーから取得したタイマー設定（`work_minutes` 等） |
| `mode` | string | 現在のモード（`"work"` / `"short_break"` / `"long_break"`） |
| `timerState` | string | タイマー状態（`"idle"` / `"running"` / `"paused"`） |
| `endTimeMs` | number \| null | タイマー終了予定の Unix ミリ秒（停止中は `null`） |
| `remainingMs` | number | 残り時間（ミリ秒） |
| `sessionDurationMs` | number | 現在セッションの合計時間（ミリ秒） |
| `completedWorkCycles` | number | 完了した作業セッションの累計回数（長休憩判定に使用） |
| `progress` | object | 当日の進捗オブジェクト |

---

### タイマー設定オブジェクト（`timer.js` の `state.settings`）

サーバーの `GET /api/settings` から取得します。

| フィールド | 型 | デフォルト値 | 説明 |
|---|---|---|---|
| `work_minutes` | number | 25 | 作業セッション（分） |
| `short_break_minutes` | number | 5 | 短い休憩（分） |
| `long_break_minutes` | number | 15 | 長い休憩（分） |
| `long_break_interval` | number | 4 | 長休憩の周期（作業セッション回数） |
