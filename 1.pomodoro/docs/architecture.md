# アーキテクチャ概要

ポモドーロタイマーアプリの現在の実装構成を説明します。

---

## 全体構成

```
1.pomodoro/
├── app.py                        # Flask アプリケーション本体（ルート定義・設定）
├── services/
│   ├── __init__.py
│   └── progress_service.py       # 進捗管理サービス（ビジネスロジック）
├── static/
│   ├── css/
│   │   └── style.css             # スタイルシート
│   └── js/
│       └── timer.js              # フロントエンド タイマーロジック
├── templates/
│   └── index.html                # 単一ページ HTML
└── tests/
    ├── test_app.py               # Flask ルートのテスト
    └── test_progress_service.py  # サービス層のテスト
```

---

## レイヤー構成

### プレゼンテーション層（クライアント）

- **templates/index.html** — 単一画面の HTML。タイマーUI と進捗表示で構成。
- **static/css/style.css** — CSS カスタムプロパティ（デザイントークン）を使ったスタイル定義。
- **static/js/timer.js** — タイマーのコアロジック・状態管理・UI 描画・API 通信を一つのファイルで実装。

タイマーは **クライアント主導** で動作します。終了予定時刻（`endTimeMs`）ベースで残り時間を計算し、250ms 間隔のインターバルで更新します。

### サーバー層（Flask）

- **app.py** — アプリケーションファクトリ不使用のシンプルな Flask アプリ。ルート定義・設定オブジェクト・`ProgressService` インスタンスを保持。
- **services/progress_service.py** — 当日進捗のインメモリ管理。スレッドセーフ（`threading.Lock` 使用）。

---

## データフロー

```
ブラウザ
  │
  ├─(起動時)─ GET /api/settings ──▶ タイマー設定を取得・反映
  │
  ├─(起動時)─ GET /api/progress/today ──▶ サーバー進捗とローカル進捗をマージ
  │
  ├─(作業完了時)─ POST /api/sessions/complete ──▶ サーバー進捗を更新
  │
  └─(描画ループ)─ localStorage 読み書き ──▶ ローカル進捗の永続化
```

---

## 設定値

`app.py` 内の `SETTINGS` 辞書で定義されており、`GET /api/settings` で返却されます。

| キー | デフォルト値 | 説明 |
|---|---|---|
| `work_minutes` | 25 | 作業セッション（分） |
| `short_break_minutes` | 5 | 短い休憩（分） |
| `long_break_minutes` | 15 | 長い休憩（分） |
| `long_break_interval` | 4 | 長休憩の周期（作業セッション回数） |

---

## 起動方法

```bash
cd 1.pomodoro
python app.py
```

デフォルトポートは `8000`。環境変数 `FLASK_DEBUG=true` でデバッグモードが有効になります。

---

## 進捗データの永続化

- **サーバー側**: `ProgressService` がプロセスメモリ上に保持（再起動でリセット）。
- **クライアント側**: `localStorage` に日付キー (`pomodoro-progress:YYYY-MM-DD`) で保存し、日跨ぎを自動検出。
- 起動時にサーバーとローカルの値を比較し、大きい方を採用します（`Math.max`）。
