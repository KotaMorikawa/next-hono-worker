# x402 Learning Lab

x402プロトコル学習プラットフォーム - 自然言語でAPIを作成し、x402決済を体験できる教育プラットフォーム

## アーキテクチャ

### モノレポ構成（Turborepo）

```
apps/
  frontend/               # Next.js 15 on Cloudflare Workers
  backend/                # Hono + x402 on Cloudflare Workers  
  jobs/                   # Background Processing
packages/
  db/                     # Drizzle schema
  shared/                 # 共有型定義・Zodスキーマ
  x402-integration/       # x402プロトコル統合
  llm-services/           # LLM API統合
  blockchain-connector/   # ウォレット・ブロックチェーン接続
  api-generator/          # 自然言語→API変換エンジン
  ui/                     # 学習UI専用コンポーネント
```

## 開発コマンド

### 初回セットアップ
```bash
npm run setup      # 初回環境構築
```

### 開発サーバー
```bash
npm run dev        # 統合開発サーバー起動（全サービス）
```

### テスト・品質チェック
```bash
npm run test       # 全テスト実行
npm run typecheck  # TypeScript型チェック
npm run lint       # Biome linter実行
npm run build      # 本番ビルド
```

### プレビュー・デプロイ
```bash
npm run preview    # 本番環境同等テスト（Workers環境）
npm run deploy     # 本番デプロイ
```

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + @opennextjs/cloudflare
- **バックエンド**: Hono + Coinbase x402-hono ミドルウェア
- **ランタイム**: Cloudflare Workers V8エンジン
- **データベース**: PostgreSQL via Hyperdrive
- **キャッシュ**: Workers KV
- **ストレージ**: R2
- **LLM統合**: Gemini Pro（メイン）、OpenAI、Anthropic（ユーザー提供APIキー）
- **ブロックチェーン**: Base Sepolia（USDC決済）

## 主要機能

### 1. 自然言語API生成
- ユーザーが日本語でAPIを説明
- LLM（Gemini Pro）がHono + x402コードを自動生成
- 動的ルーティングによる即座デプロイ

### 2. x402プロトコル統合
- HTTP 402ステータスコードによる決済フロー
- Base Sepolia上のUSDC決済
- Coinbase x402-honoミドルウェア使用

### 3. AIエージェント体験
- AIによる自動決済フローの可視化
- リアルタイム決済プロセス表示

## セットアップ状況

✅ **プロジェクト初期セットアップ完了** (2025-07-20)

## 環境要件

- Node.js >= 18.0.0
- npm >= 9.0.0

## ライセンス

MIT
<!-- TASKMASTER_EXPORT_START -->
> 🎯 **Taskmaster Export** - 2025-07-21 04:57:56 UTC
> 📋 Export: with subtasks • Status filter: none
> 🔗 Powered by [Task Master](https://task-master.dev?utm_source=github-readme&utm_medium=readme-export&utm_campaign=next-hono-worker&utm_content=task-export-link)

| Project Dashboard |  |
| :-                |:-|
| Task Progress     | ████░░░░░░░░░░░░░░░░ 20% |
| Done | 2 |
| In Progress | 1 |
| Pending | 7 |
| Deferred | 0 |
| Cancelled | 0 |
|-|-|
| Subtask Progress | ███████████░░░░░░░░░ 56% |
| Completed | 10 |
| In Progress | 1 |
| Pending | 7 |


| ID | Title | Status | Priority | Dependencies | Complexity |
| :- | :-    | :-     | :-       | :-           | :-         |
| 1 | モノレポ基盤セットアップ | ✓&nbsp;done | high | None | N/A |
| 1.1 | Turborepo初期化とプロジェクト構造作成 | ✓&nbsp;done | -            | None | N/A |
| 1.2 | ワークスペース設定とpackage.json構成 | ✓&nbsp;done | -            | None | N/A |
| 1.3 | Turborepo pipeline設定 | ✓&nbsp;done | -            | None | N/A |
| 1.4 | 共通パッケージ作成 | ✓&nbsp;done | -            | None | N/A |
| 1.5 | 開発環境設定とDocker Compose構築 | ✓&nbsp;done | -            | None | N/A |
| 2 | データベーススキーマ設計・構築 | ✓&nbsp;done | high | 1 | N/A |
| 2.1 | packages/db パッケージ初期化 | ✓&nbsp;done | -            | None | N/A |
| 2.2 | ユーザー管理スキーマ定義 | ✓&nbsp;done | -            | 2.1 | N/A |
| 2.3 | API管理・使用量追跡スキーマ定義 | ✓&nbsp;done | -            | 2.1, 2.2 | N/A |
| 2.4 | 学習進捗管理スキーマとマイグレーション | ✓&nbsp;done | -            | 2.2, 2.3 | N/A |
| 2.5 | データベース接続層とエクスポート設定 | ✓&nbsp;done | -            | 2.4 | N/A |
| 3 | 共有型定義・バリデーションスキーマ | ►&nbsp;in-progress | high | 2 | N/A |
| 3.1 | Sharedパッケージ基盤構築 | ►&nbsp;in-progress | -            | None | N/A |
| 3.2 | 認証関連スキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.3 | API管理スキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.4 | 使用量・課金スキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.5 | 学習コンテンツスキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.6 | LLM統合スキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.7 | x402プロトコルスキーマ実装 | ○&nbsp;pending | -            | 3.1 | N/A |
| 3.8 | 統合テストスイート構築 | ○&nbsp;pending | -            | 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 | N/A |
| 4 | Hono + x402バックエンド実装 | ○&nbsp;pending | high | 3 | N/A |
| 5 | Next.js学習プラットフォーム構築 | ○&nbsp;pending | high | 4 | N/A |
| 6 | LLM統合・自然言語API生成エンジン | ○&nbsp;pending | medium | 5 | N/A |
| 7 | x402プロトコル統合・ブロックチェーン接続 | ○&nbsp;pending | medium | 6 | N/A |
| 8 | AIエージェントシミュレーター・学習体験 | ○&nbsp;pending | medium | 7 | N/A |
| 9 | 動的API配信・管理システム | ○&nbsp;pending | medium | 8 | N/A |
| 10 | CI/CD・モニタリング・品質保証 | ○&nbsp;pending | low | 9 | N/A |

> 📋 **End of Taskmaster Export** - Tasks are synced from your project using the `sync-readme` command.
<!-- TASKMASTER_EXPORT_END -->



