// =============================================================================
// DATABASE SEED DATA - x402 Learning Lab 初期データ投入
// =============================================================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  apiKeys,
  generatedApis,
  learningProgress,
  organizations,
  tutorials,
  users,
} from "./schema";

/**
 * シードデータ投入用のデータベース接続
 */
const getDatabaseClient = () => {
  const url =
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
    process.env["HYPERDRIVE_URL"] ||
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
    process.env["DATABASE_URL"] ||
    "postgresql://x402_user:x402_password@localhost:5432/x402_learning_lab";

  const client = postgres(url, { max: 1 });
  return drizzle(client);
};

// =============================================================================
// シードデータ定義
// =============================================================================

/**
 * 組織サンプルデータ
 */
const seedOrganizations = [
  {
    name: "x402 Learning Lab",
    domain: "x402lab.dev",
  },
  {
    name: "デモ企業A",
    domain: "demo-company-a.com",
  },
];

/**
 * チュートリアルサンプルデータ
 */
const seedTutorials = [
  {
    title: "x402プロトコル入門",
    description:
      "HTTP 402ステータスコードを使った決済プロトコルの基礎を学習します",
    content: `
# x402プロトコル入門

## 概要
x402プロトコルは、HTTP 402 Payment Requiredステータスコードを活用した、API決済の新しい標準です。

## 学習目標
- x402プロトコルの仕組みを理解する
- 決済フローの基本概念を学ぶ
- 実際のAPIで決済を体験する

## ステップ1: プロトコルの理解
x402プロトコルでは、通常のHTTPリクエストに対して...

## ステップ2: 実装例
\`\`\`javascript
// 基本的な決済フロー
const response = await fetch('/api/premium-content');
if (response.status === 402) {
  // 決済処理を開始
  const paymentInfo = await response.json();
  // ...
}
\`\`\`

## まとめ
x402プロトコルにより、APIのマネタイズが簡単になります。
    `,
    difficulty: "beginner",
    estimatedTime: 30,
    category: "x402",
    prerequisites: [],
    published: true,
  },
  {
    title: "自然言語でAPI作成",
    description: "AIを使って日本語の説明からAPIを自動生成する方法を学習します",
    content: `
# 自然言語でAPI作成

## 概要
x402 Learning Labでは、自然言語でAPIの仕様を説明するだけで、実動するAPIが自動生成されます。

## 学習目標
- 自然言語でのAPI仕様記述方法を学ぶ
- 生成されたAPIコードを理解する
- x402決済との統合方法を学ぶ

## API仕様の書き方
「天気情報を取得するAPI。指定した都市の現在の天気と気温を返す。料金は1回0.01USDC」

このような自然な説明から、完全なAPIが生成されます。

## 生成される内容
- Hono + TypeScript実装
- x402決済統合
- エラーハンドリング
- APIドキュメント
- テストコード

## 実践演習
実際にAPIを作成してみましょう...
    `,
    difficulty: "intermediate",
    estimatedTime: 45,
    category: "api-creation",
    prerequisites: [],
    published: true,
  },
  {
    title: "ブロックチェーン決済の仕組み",
    description: "Base Sepolia上でのUSDC決済について詳しく学習します",
    content: `
# ブロックチェーン決済の仕組み

## 概要
x402 Learning Labでは、Base Sepolia テストネット上でUSDC決済を行います。

## 学習目標
- Base Sepoliaテストネットの理解
- USDCトークンの仕組み
- ウォレット連携の実装
- トランザクション確認方法

## Base Sepolia とは
Base SepoliaはCoinbaseが開発したLayer 2ソリューション「Base」のテストネットです。

## USDC決済フロー
1. ユーザーがAPI使用を要求
2. スマートコントラクトでUSDC転送
3. トランザクション確認
4. APIアクセス許可

## 実装の詳細
ウォレット連携からトランザクション処理まで、実際のコードを見ながら学習します...
    `,
    difficulty: "advanced",
    estimatedTime: 60,
    category: "blockchain",
    prerequisites: ["x402プロトコル入門"],
    published: true,
  },
];

/**
 * ユーザーサンプルデータ
 */
const seedUsers = [
  {
    email: "admin@x402lab.dev",
    name: "システム管理者",
    passwordHash:
      "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZhLbkbZ.t3N2", // "admin123"
    emailVerified: true,
  },
  {
    email: "demo@example.com",
    name: "デモユーザー",
    passwordHash:
      "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZhLbkbZ.t3N2", // "demo123"
    emailVerified: true,
  },
];

/**
 * 生成APIサンプルデータ
 */
const seedGeneratedApis = [
  {
    name: "天気情報API",
    description: "指定した都市の現在の天気情報を取得するAPI",
    endpoint: "/api/weather",
    method: "GET",
    price: "0.01",
    currency: "USDC",
    generatedCode: `
import { Hono } from 'hono';
import { x402 } from '@coinbase/x402-hono';

const app = new Hono();

app.get('/api/weather', 
  x402('0x742d35Cc2659C5b15bc85e669Ba8Dc2cc', '$0.01'),
  async (c) => {
    const city = c.req.query('city') || 'Tokyo';
    
    // 天気情報の取得ロジック
    const weather = {
      city,
      temperature: 25,
      condition: 'sunny',
      humidity: 60
    };
    
    return c.json(weather);
  }
);

export default app;
    `,
    testCode: `
import { describe, it, expect } from 'vitest';
import app from './weather-api';

describe('Weather API', () => {
  it('should return weather data', async () => {
    const res = await app.request('/api/weather?city=Tokyo');
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data).toHaveProperty('city');
    expect(data).toHaveProperty('temperature');
  });
});
    `,
    documentation: `
# 天気情報API

## 概要
指定した都市の現在の天気情報を取得するAPIです。

## エンドポイント
\`GET /api/weather\`

## パラメータ
- \`city\` (optional): 都市名 (デフォルト: Tokyo)

## 料金
1回のリクエストにつき 0.01 USDC

## レスポンス例
\`\`\`json
{
  "city": "Tokyo",
  "temperature": 25,
  "condition": "sunny", 
  "humidity": 60
}
\`\`\`
    `,
    status: "active",
    metadata: {
      tags: ["weather", "demo"],
      version: "1.0.0",
    },
  },
];

// =============================================================================
// シードデータ投入関数
// =============================================================================

/**
 * 全てのシードデータを投入
 */
export async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  const db = getDatabaseClient();

  try {
    // 1. 組織データを投入
    console.log("📝 Seeding organizations...");
    const insertedOrgs = await db
      .insert(organizations)
      .values(seedOrganizations)
      .returning();

    // 2. ユーザーデータを投入（最初の組織に所属）
    console.log("👥 Seeding users...");
    const usersWithOrg = seedUsers.map((user, index) => ({
      ...user,
      organizationId: index === 0 ? insertedOrgs[0]?.id || null : null,
    }));

    const insertedUsers = await db
      .insert(users)
      .values(usersWithOrg)
      .returning();

    // 3. チュートリアルデータを投入
    console.log("📚 Seeding tutorials...");
    const insertedTutorials = await db
      .insert(tutorials)
      .values(seedTutorials)
      .returning();

    // 4. 生成APIデータを投入（管理者ユーザーが作成）
    console.log("🔌 Seeding generated APIs...");
    const apisWithUser = seedGeneratedApis.map((api) => ({
      ...api,
      userId: insertedUsers[0]?.id ?? '', // 管理者ユーザー
      organizationId: insertedOrgs[0]?.id || null,
    }));

    const insertedApis = await db
      .insert(generatedApis)
      .values(apisWithUser)
      .returning();

    // 5. 学習進捗データを投入（デモユーザーの進捗）
    console.log("📊 Seeding learning progress...");
    const progressData = [
      {
        userId: insertedUsers[1]?.id ?? '', // デモユーザー
        tutorialId: insertedTutorials[0]?.id ?? '', // x402入門
        progress: 100,
        completed: true,
        timeSpent: 1800, // 30分
        lastAccessedAt: new Date(Date.now() - 86400000), // 1日前
      },
      {
        userId: insertedUsers[1]?.id ?? '', // デモユーザー
        tutorialId: insertedTutorials[1]?.id ?? '', // API作成
        progress: 60,
        completed: false,
        timeSpent: 1200, // 20分
        lastAccessedAt: new Date(),
      },
    ];

    await db.insert(learningProgress).values(progressData).returning();

    // 6. APIキーデータを投入
    console.log("🔑 Seeding API keys...");
    const apiKeyData = [
      {
        name: "管理者用開発キー",
        description: "開発・テスト用のAPIキー",
        keyHash:
          "3f8c4b2a1e9d6f0c8a4b2e1f9c6d3a0b1e8f5c2a9d6b3e0f1a8c5b2e9f6d3a0",
        keyPrefix: "xla_dev_",
        userId: insertedUsers[0]?.id ?? '', // 管理者ユーザー
        organizationId: insertedOrgs[0]?.id || null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年後
      },
      {
        name: "デモ用APIキー",
        description: "デモユーザー用の制限付きAPIキー",
        keyHash:
          "a9f2e5c8b1d4e7a0c3f6b9e2d5a8c1f4e7b0d3a6c9f2e5b8d1a4c7f0e3b6a9",
        keyPrefix: "xla_demo_",
        userId: insertedUsers[1]?.id ?? '', // デモユーザー
        organizationId: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
      },
    ];

    await db.insert(apiKeys).values(apiKeyData).returning();

    console.log("✅ Database seeding completed successfully!");
    console.log(`
📈 Seeded data summary:
  - Organizations: ${insertedOrgs.length}
  - Users: ${insertedUsers.length}
  - Tutorials: ${insertedTutorials.length}
  - Generated APIs: ${insertedApis.length}
  - Learning Progress: ${progressData.length}
  - API Keys: ${apiKeyData.length}
    `);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

/**
 * スタンドアロン実行用
 */
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("🎉 Seeding process completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding process failed:", error);
      process.exit(1);
    });
}
