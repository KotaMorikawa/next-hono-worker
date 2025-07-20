import { z } from "zod";

// x402 Protocol schemas
export const paymentConfigSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid USDC amount"),
  currency: z.literal("USDC"),
  network: z.literal("base-sepolia"),
  chainId: z.literal(84532),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const paymentRequestSchema = z.object({
  id: z.string().uuid(),
  apiId: z.string().uuid(),
  userId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(),
  currency: z.literal("USDC"),
  status: z.enum(["pending", "confirmed", "failed", "expired"]),
  transactionHash: z.string().optional(),
  blockNumber: z.number().int().positive().optional(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const walletConnectionSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int(),
  network: z.string(),
  provider: z.enum(["metamask", "walletconnect", "coinbase"]),
});

export const transactionReceiptSchema = z.object({
  transactionHash: z.string(),
  blockNumber: z.number().int().positive(),
  blockHash: z.string(),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  gasUsed: z.string(),
  gasPrice: z.string(),
  status: z.enum(["success", "failed"]),
  confirmations: z.number().int().nonnegative(),
});

// Blockchain network configuration
export const networkConfigSchema = z.object({
  chainId: z.number().int(),
  name: z.string(),
  rpcUrl: z.string().url(),
  blockExplorerUrl: z.string().url(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number().int(),
  }),
  usdcContract: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    decimals: z.number().int(),
  }),
});

// AI Agent simulation schemas
export const agentActionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "connect_wallet",
    "check_balance",
    "initiate_payment",
    "confirm_transaction",
    "api_call",
  ]),
  timestamp: z.date(),
  description: z.string(),
  data: z.record(z.unknown()).optional(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  error: z.string().optional(),
});

export const simulationStateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  scenarioType: z.enum([
    "weather_api",
    "translation_api",
    "image_analysis",
    "custom",
  ]),
  currentStep: z.number().int().nonnegative(),
  totalSteps: z.number().int().positive(),
  actions: z.array(agentActionSchema),
  walletState: z.object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    balance: z.string().optional(),
    connected: z.boolean(),
  }),
  apiState: z.object({
    endpoint: z.string().optional(),
    price: z.string().optional(),
    lastResponse: z.record(z.unknown()).optional(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type exports
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;
export type WalletConnection = z.infer<typeof walletConnectionSchema>;
export type TransactionReceipt = z.infer<typeof transactionReceiptSchema>;
export type NetworkConfig = z.infer<typeof networkConfigSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type SimulationState = z.infer<typeof simulationStateSchema>;

// Network constants
export const BASE_SEPOLIA_CONFIG: NetworkConfig = {
  chainId: 84532,
  name: "Base Sepolia",
  rpcUrl: "https://sepolia.base.org",
  blockExplorerUrl: "https://sepolia-explorer.base.org",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  usdcContract: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
  },
};
