# Task Master ファイル管理ガイド

このドキュメントでは、プロジェクトで使用している task-master CLI ツールのファイル管理方法について説明します。

## 📁 ファイル構造

```
.taskmaster/
├── config.json             # AI モデル設定ファイル
├── state.json              # プロジェクト状態（現在のタグなど）
├── tasks/
│   ├── tasks.json          # メインのタスクデータベース（JSON形式）
│   ├── task_001.txt        # タスク#1の詳細テキスト（自動生成）
│   ├── task_002.txt        # タスク#2の詳細テキスト（自動生成）
│   └── ...                 # 各タスクの個別ファイル
├── docs/                   # ドキュメント（未使用）
└── reports/                # レポート（未使用）
```

## 🎯 管理システムの仕組み

### マスターデータソース
- **`tasks.json`**: すべてのタスク情報を含むマスターファイル
  - タスクID、タイトル、説明、ステータス
  - 依存関係、優先度、複雑度
  - サブタスクの詳細情報
  - メタデータ（作成日時、更新日時など）

### 自動生成ファイル
- **`task_XXX.txt`**: 各タスクの人間が読みやすい詳細テキスト
  - `tasks.json` から自動生成される
  - **直接編集は推奨されない**（上書きされる可能性があるため）
  - タスクの詳細確認や共有に使用

## 🛠️ 主要な管理コマンド

### ファイル生成・同期
```bash
# 個別テキストファイルを tasks.json から再生成
task-master generate

# README.md にタスク一覧をエクスポート
task-master sync-readme --with-subtasks

# 特定ステータスのタスクのみエクスポート
task-master sync-readme --status=pending
```

### タスク表示・確認
```bash
# 全タスク一覧表示
task-master list

# サブタスク付きで表示
task-master list --with-subtasks

# 特定ステータスのタスクのみ表示
task-master list --status=pending

# 特定タスクの詳細表示
task-master show <id>

# 次に作業すべきタスクを表示
task-master next
```

### タスク管理
```bash
# ステータス更新
task-master set-status --id=<id> --status=<status>
# 利用可能ステータス: pending, in-progress, done, review, deferred, cancelled

# タスク情報更新
task-master update-task --id=<id> --prompt="<更新内容>"

# 新規タスク追加
task-master add-task --prompt="<タスク説明>" --priority=<high|medium|low>

# タスク削除
task-master remove-task --id=<id>
```

### サブタスク管理
```bash
# サブタスク追加
task-master add-subtask --parent=<id> --title="<サブタスクタイトル>"

# サブタスク削除
task-master remove-subtask --id=<parentId.subtaskId>

# すべてのサブタスクをクリア
task-master clear-subtasks --id=<id>
```

## ⚠️ 重要な注意点

### DO ✅
- **task-master コマンド経由での操作**: すべての変更は task-master CLI を使用
- **定期的な再生成**: `task-master generate` で個別ファイルを最新化
- **README 同期**: `task-master sync-readme` でプロジェクト文書と同期
- **バックアップ**: `tasks.json` は重要なので定期的にバックアップ

### DON'T ❌
- **`task_XXX.txt` の直接編集**: これらは自動生成ファイルのため
- **`tasks.json` の手動編集**: 構造が複雑でエラーの原因となる
- **設定ファイルの無許可変更**: `config.json` や `state.json` の手動編集

## 🔄 推奨ワークフロー

### 日常のタスク管理
1. **タスク確認**: `task-master next` で次のタスクを確認
2. **ステータス更新**: `task-master set-status --id=<id> --status=in-progress`
3. **作業実行**: 実際のタスクを実行
4. **完了マーク**: `task-master set-status --id=<id> --status=done`

### 定期的なメンテナンス
1. **ファイル再生成**: `task-master generate`（週1回程度）
2. **README 同期**: `task-master sync-readme --with-subtasks`（リリース前）
3. **進捗確認**: `task-master list` で全体状況を把握

### タスク追加・変更時
1. **タスク追加**: `task-master add-task --prompt="<説明>"`
2. **詳細更新**: `task-master update-task --id=<id> --prompt="<追加情報>"`
3. **ファイル同期**: `task-master generate` と `task-master sync-readme`

## 🔧 設定管理

### AI モデル設定
```bash
# 現在の設定確認
task-master models

# 設定の更新
task-master models --setup
```

### タグ管理（複数プロジェクト）
```bash
# タグ一覧表示
task-master tags

# 新しいタグ作成
task-master add-tag <tagName>

# タグ切り替え
task-master use-tag <tagName>
```

## 📋 トラブルシューティング

### よくある問題

**Q: task_XXX.txt ファイルが古い情報を表示している**
```bash
# A: ファイルを再生成してください
task-master generate
```

**Q: README.md にタスクが反映されていない**
```bash
# A: 明示的に同期してください
task-master sync-readme --with-subtasks
```

**Q: ステータス変更が反映されない**
```bash
# A: 正しいコマンド形式を使用してください
task-master set-status --id=1 --status=done
# 注意: IDは数値、ステータスは有効な値を指定
```

## 🎨 ベストプラクティス

1. **一貫性のあるコマンド使用**: 常に task-master CLI を使用
2. **定期的な同期**: 重要なマイルストーン後はファイル再生成と README 同期
3. **明確なタスク記述**: AI が理解しやすい具体的な説明を使用
4. **適切な優先度設定**: high/medium/low を適切に使い分け
5. **依存関係の管理**: タスク間の依存関係を明確に設定

## 📚 参考リンク

- `task-master --help`: 全コマンドの詳細ヘルプ
- `task-master <command> --help`: 特定コマンドのヘルプ
- プロジェクト README.md: 最新のタスク一覧