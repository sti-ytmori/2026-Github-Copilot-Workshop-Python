# API リファレンス

ポモドーロタイマーアプリが提供する REST API の仕様です。

---

## 共通仕様

- ベース URL: `http://<host>:8000`
- リクエスト / レスポンス形式: `application/json`
- エラーレスポンス形式: `{"error": "<メッセージ>"}`

---

## エンドポイント一覧

### GET `/`

メインのタイマー画面を返します。

**レスポンス**

- `200 OK` — `text/html` (index.html)

---

### GET `/api/settings`

タイマー設定値を返します。

**レスポンス例**

````json
{
  "work_minutes": 25,
  "short_break_minutes": 5,
  "long_break_minutes": 15,
  "long_break_interval": 4
}
````

| フィールド | 型 | 説明 |
|---|---|---|
| `work_minutes` | integer | 作業セッションの長さ（分） |
| `short_break_minutes` | integer | 短い休憩の長さ（分） |
| `long_break_minutes` | integer | 長い休憩の長さ（分） |
| `long_break_interval` | integer | 長休憩を挿入する作業セッション回数 |

**ステータスコード**

| コード | 説明 |
|---|---|
| `200 OK` | 成功 |

---

### GET `/api/progress/today`

当日の進捗を返します。

**クエリパラメータ**

| パラメータ | 必須 | 形式 | 説明 |
|---|---|---|---|
| `date` | 任意 | `YYYY-MM-DD` | 取得対象の日付。省略時は本日の日付が使われます。 |

**レスポンス例**

````json
{
  "date": "2026-06-09",
  "completed_sessions": 3,
  "focus_minutes": 75
}
````

| フィールド | 型 | 説明 |
|---|---|---|
| `date` | string | 対象日付 (`YYYY-MM-DD`) |
| `completed_sessions` | integer | 完了した作業セッション数 |
| `focus_minutes` | integer | 集中した合計時間（分） |

**ステータスコード**

| コード | 説明 |
|---|---|
| `200 OK` | 成功 |
| `400 Bad Request` | `date` パラメータの形式が不正 |

**400 エラーレスポンス例**

````json
{"error": "date must be in YYYY-MM-DD format"}
````

---

### POST `/api/sessions/complete`

作業セッション完了を記録します。`mode` が `"work"` の場合のみ受け付けます。

**リクエストボディ**

````json
{"mode": "work"}
````

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `mode` | string | ○ | `"work"` のみ有効 |

**レスポンス例**

````json
{
  "date": "2026-06-09",
  "completed_sessions": 1,
  "focus_minutes": 25
}
````

**ステータスコード**

| コード | 説明 |
|---|---|
| `201 Created` | 記録成功。更新後の進捗を返します。 |
| `400 Bad Request` | `mode` が `"work"` 以外 |

**400 エラーレスポンス例**

````json
{"error": "mode must be 'work'"}
````
