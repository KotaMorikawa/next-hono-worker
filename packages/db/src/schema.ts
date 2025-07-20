import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Users and Organizations
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    domainIdx: uniqueIndex("organizations_domain_idx").on(table.domain),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    emailVerified: boolean("email_verified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    organizationIdx: index("users_organization_idx").on(table.organizationId),
  }),
);

// API Keys and Management
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    keyHash: varchar("key_hash", { length: 255 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("api_keys_user_idx").on(table.userId),
    keyHashIdx: uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
  }),
);

export const generatedApis = pgTable(
  "generated_apis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    endpoint: varchar("endpoint", { length: 500 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    price: decimal("price", { precision: 18, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("USDC").notNull(),
    generatedCode: text("generated_code").notNull(),
    testCode: text("test_code"),
    documentation: text("documentation").notNull(),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("generated_apis_user_idx").on(table.userId),
    statusIdx: index("generated_apis_status_idx").on(table.status),
    endpointIdx: uniqueIndex("generated_apis_endpoint_idx").on(table.endpoint),
  }),
);

// Usage and Billing
export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiId: uuid("api_id")
      .references(() => generatedApis.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    totalRevenue: decimal("total_revenue", { precision: 18, scale: 6 })
      .default("0")
      .notNull(),
    averageResponseTime: integer("average_response_time").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    date: timestamp("date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    apiDateIdx: uniqueIndex("api_usage_api_date_idx").on(
      table.apiId,
      table.date,
    ),
    userIdx: index("api_usage_user_idx").on(table.userId),
  }),
);

export const billingRecords = pgTable(
  "billing_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    apiId: uuid("api_id")
      .references(() => generatedApis.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("USDC").notNull(),
    transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
    blockNumber: integer("block_number").notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("billing_records_user_idx").on(table.userId),
    apiIdx: index("billing_records_api_idx").on(table.apiId),
    txHashIdx: uniqueIndex("billing_records_tx_hash_idx").on(
      table.transactionHash,
    ),
  }),
);

// Learning Content
export const tutorials = pgTable(
  "tutorials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    content: text("content").notNull(),
    difficulty: varchar("difficulty", { length: 20 }).notNull(),
    estimatedTime: integer("estimated_time").notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    prerequisites: jsonb("prerequisites"),
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("tutorials_category_idx").on(table.category),
    publishedIdx: index("tutorials_published_idx").on(table.published),
  }),
);

export const learningProgress = pgTable(
  "learning_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tutorialId: uuid("tutorial_id")
      .references(() => tutorials.id, { onDelete: "cascade" })
      .notNull(),
    progress: integer("progress").default(0).notNull(),
    completed: boolean("completed").default(false).notNull(),
    timeSpent: integer("time_spent").default(0).notNull(),
    lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userTutorialIdx: uniqueIndex("learning_progress_user_tutorial_idx").on(
      table.userId,
      table.tutorialId,
    ),
    userIdx: index("learning_progress_user_idx").on(table.userId),
  }),
);

// Payment Requests (x402 Protocol)
export const paymentRequests = pgTable(
  "payment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiId: uuid("api_id")
      .references(() => generatedApis.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("USDC").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    transactionHash: varchar("transaction_hash", { length: 66 }),
    blockNumber: integer("block_number"),
    expiresAt: timestamp("expires_at").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("payment_requests_status_idx").on(table.status),
    walletIdx: index("payment_requests_wallet_idx").on(table.walletAddress),
    expiresIdx: index("payment_requests_expires_idx").on(table.expiresAt),
  }),
);

// AI Agent Simulations
export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scenarioType: varchar("scenario_type", { length: 50 }).notNull(),
    currentStep: integer("current_step").default(0).notNull(),
    totalSteps: integer("total_steps").notNull(),
    walletState: jsonb("wallet_state"),
    apiState: jsonb("api_state"),
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("simulations_user_idx").on(table.userId),
    scenarioIdx: index("simulations_scenario_idx").on(table.scenarioType),
  }),
);

export const simulationActions = pgTable(
  "simulation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    simulationId: uuid("simulation_id")
      .references(() => simulations.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    description: text("description").notNull(),
    data: jsonb("data"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    error: text("error"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    simulationIdx: index("simulation_actions_simulation_idx").on(
      table.simulationId,
    ),
    typeIdx: index("simulation_actions_type_idx").on(table.type),
  }),
);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  apiKeys: many(apiKeys),
  generatedApis: many(generatedApis),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  apiKeys: many(apiKeys),
  generatedApis: many(generatedApis),
  apiUsage: many(apiUsage),
  billingRecords: many(billingRecords),
  learningProgress: many(learningProgress),
  paymentRequests: many(paymentRequests),
  simulations: many(simulations),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
}));

export const generatedApisRelations = relations(
  generatedApis,
  ({ one, many }) => ({
    user: one(users, {
      fields: [generatedApis.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [generatedApis.organizationId],
      references: [organizations.id],
    }),
    apiUsage: many(apiUsage),
    billingRecords: many(billingRecords),
    paymentRequests: many(paymentRequests),
  }),
);

export const tutorialsRelations = relations(tutorials, ({ many }) => ({
  learningProgress: many(learningProgress),
}));

export const learningProgressRelations = relations(
  learningProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [learningProgress.userId],
      references: [users.id],
    }),
    tutorial: one(tutorials, {
      fields: [learningProgress.tutorialId],
      references: [tutorials.id],
    }),
  }),
);

export const simulationsRelations = relations(simulations, ({ one, many }) => ({
  user: one(users, {
    fields: [simulations.userId],
    references: [users.id],
  }),
  actions: many(simulationActions),
}));

export const simulationActionsRelations = relations(
  simulationActions,
  ({ one }) => ({
    simulation: one(simulations, {
      fields: [simulationActions.simulationId],
      references: [simulations.id],
    }),
  }),
);
