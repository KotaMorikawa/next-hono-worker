# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

x402 Learning Lab - x402プロトコル学習プラットフォーム。自然言語でAPIを作成し、x402決済を体験できる教育プラットフォーム。

## アーキテクチャ

### モノレポ構成（Turborepo）

```
apps/
  frontend/               # Next.js 15 on Cloudflare Workers
    app/
      (auth)/             # 認証関連ページ
      learn/              # x402学習コンテンツ
      api-builder/        # 自然言語API作成
      ai-demo/            # AIエージェント体験
  backend/                # Hono + x402 on Cloudflare Workers
    routes/
      api/                # ユーザー生成API
      internal/           # プラットフォーム内部API
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

### 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + @opennextjs/cloudflare
- **バックエンド**: Hono + Coinbase x402-hono ミドルウェア
- **ランタイム**: Cloudflare Workers V8エンジン
- **データベース**: PostgreSQL via Hyperdrive
- **キャッシュ**: Workers KV
- **ストレージ**: R2
- **LLM統合**: Gemini Pro（メイン）、OpenAI、Anthropic（ユーザー提供APIキー）
- **ブロックチェーン**: Base Sepolia（USDC決済）

## 開発コマンド

### 初回セットアップ
```bash
npm run setup      # 初回環境構築
```

### 開発サーバー
```bash
npm run dev        # 統合開発サーバー起動（全サービス）
turbo dev          # Turborepo経由
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

## 重要な開発ルール

### Service Bindings通信
- Frontend ↔ Backend間はHono RPCによる型安全通信
- HTTPではなくService Bindingsを使用

### x402実装パターン
```typescript
// 標準的なx402ミドルウェア適用
app.get('/api/example', 
  x402(walletAddress, '$0.05'), 
  async (c) => {
    // API実装
    return c.json({ result: 'success' })
  }
)
```

### LLM統合
- メインプロバイダー: Google Gemini Pro（コスト効率）
- フォールバック: ユーザー提供APIキー（OpenAI/Anthropic）
- 使用量制限とエラーハンドリング必須

### データベース設計
- Drizzle ORM使用
- `packages/db/src/schema/`にスキーマ定義
- Zodスキーマは`packages/shared/src/schemas/`

### セキュリティ要件
- VM2サンドボックスによる動的コード実行
- 許可ドメインのみ外部API呼び出し
- 実行時間・メモリ制限

## 環境構成

### 開発環境
- Docker Compose: PostgreSQL + Redis（KV互換）
- Wrangler CLI: フロントエンド・バックエンド統一管理
- 統一開発体験: `npm run dev`で全サービス起動

### 本番環境
- Cloudflare Workers（フロントエンド・バックエンド）
- PostgreSQL（Neon/Supabase）via Hyperdrive
- Workers KV（キャッシュ）
- R2（ファイルストレージ）

## パフォーマンス目標

- API生成時間: 30秒以内
- ページ読み込み: 1秒以内
- API応答時間: 50ms以内
- エラー率: 0.1%未満

## 品質管理

### テスト戦略
- 単体テスト: Vitest
- E2Eテスト: Playwright
- 型チェック: TypeScript strict mode
- リンター: Biome

### CI/CD
- PR作成時: プレビュー環境自動作成
- develop: ステージング自動デプロイ
- main: 本番デプロイ（承認フロー付き）

## 特記事項

### プロジェクト制約
- Base Sepolia専用（他のブロックチェーンは未サポート）
- USDC決済のみ
- モダンブラウザ対応のみ

### 拡張予定
- OAuth2.0対応
- GraphQL API
- 国際化（i18n）
- PWA対応

## ヘルプ・参考資料

- x402プロトコル: https://www.x402.org
- Coinbase x402-hono: npm package documentation
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Next.js on Cloudflare: @opennextjs/cloudflare documentation