# 1.pomodoro 動作確認手順（Codespaces）

このドキュメントは、GitHub Codespaces 環境で
ポモドーロアプリの最小構成が正しく動くかを確認する手順です。

## 1. 前提
- ターミナルの現在位置が `/workspaces/2026-Github-Copilot-Workshop-Python`
- Python 仮想環境が `/workspaces/2026-Github-Copilot-Workshop-Python/.venv`

## 2. 初回セットアップ
1. ルートへ移動
	- `cd /workspaces/2026-Github-Copilot-Workshop-Python`
2. Flask と pytest をインストール
	- `/workspaces/2026-Github-Copilot-Workshop-Python/.venv/bin/pip install flask pytest`

## 3. 起動
1. アプリディレクトリへ移動
	- `cd /workspaces/2026-Github-Copilot-Workshop-Python/1.pomodoro`
2. 仮想環境の Python で起動
	- `/workspaces/2026-Github-Copilot-Workshop-Python/.venv/bin/python app.py`

起動成功時は、ターミナルに Flask の起動ログが表示されます。

## 4. ブラウザでの確認（Codespaces）
1. VS Code の「Ports」ビューで `8000` ポートを確認
2. `Open in Browser` で画面を開く
3. 以下を確認
	- `Pomodoro Timer` の見出しが表示される
	- 初期表示が「作業中 / 25:00 / 待機中」になっている
## 5. 静的ファイル読み込み確認
ブラウザの開発者ツールで以下を確認します。

- Console:
  - `timer.js loaded` が表示される
- Network:
  - `static/css/style.css` が 200
  - `static/js/timer.js` が 200

## 6. CLIでの疎通確認（任意）
別ターミナルで以下を実行します。

- `curl -i http://127.0.0.1:8000`

HTML が返り、`css/style.css` と `js/timer.js` の記述が含まれていれば正常です。

## 7. ユニットテスト実行
1. アプリディレクトリへ移動
	- `cd /workspaces/2026-Github-Copilot-Workshop-Python/1.pomodoro`
2. pytest を実行
	- `/workspaces/2026-Github-Copilot-Workshop-Python/.venv/bin/python -m pytest -q`

成功時は `7 passed` のように、全テストが通過した結果が表示されます。

## 8. よくあるエラー
### `ModuleNotFoundError: No module named 'flask'`
原因: システムの `python3` で起動している、または Flask 未インストール。

対処:
1. `/workspaces/2026-Github-Copilot-Workshop-Python/.venv/bin/pip install flask`
2. `/workspaces/2026-Github-Copilot-Workshop-Python/.venv/bin/python app.py`
