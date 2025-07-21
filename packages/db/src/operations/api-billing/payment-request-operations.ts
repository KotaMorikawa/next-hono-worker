import { and, desc, eq, sql } from "drizzle-orm";
import {
  type NewPaymentRequestDB,
  type PaymentRequestDB,
  paymentRequests,
} from "../../schema";
import type { Database } from "../../types";
import type { PaymentStatusCount } from "../../types/metrics";
import {
  DatabaseError,
  DatabaseErrorType,
  getFirstOrNull,
  getFirstResult,
  type Result,
  tryAsync,
  validateRequired,
} from "../../utils/result";

// =============================================================================
// PAYMENT REQUEST OPERATIONS - 決済リクエスト管理
// =============================================================================

export class PaymentRequestOperations {
  constructor(private db: Database) {}

  async create(data: NewPaymentRequestDB): Promise<Result<PaymentRequestDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['userId', 'apiId', 'amount']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db
        .insert(paymentRequests)
        .values(data)
        .returning();
      const firstResult = getFirstResult(result, "Failed to create payment request");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_payment_request', data });
  }

  async findById(id: string): Promise<Result<PaymentRequestDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_payment_request_by_id', id });
  }

  async findByUser(
    userId: string,
    limit?: number,
  ): Promise<Result<PaymentRequestDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.userId, userId))
        .orderBy(desc(paymentRequests.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_payment_requests_by_user', userId, limit });
  }

  async findByStatus(
    status: string,
    limit?: number,
  ): Promise<Result<PaymentRequestDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.status, status))
        .orderBy(desc(paymentRequests.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_payment_requests_by_status', status, limit });
  }

  async findByWallet(
    walletAddress: string,
    limit?: number,
  ): Promise<Result<PaymentRequestDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.walletAddress, walletAddress))
        .orderBy(desc(paymentRequests.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_payment_requests_by_wallet', walletAddress, limit });
  }

  async updateStatus(
    id: string,
    status: string,
    transactionHash?: string,
    blockNumber?: number,
  ): Promise<Result<PaymentRequestDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(paymentRequests)
        .set({
          status,
          transactionHash: transactionHash ?? null,
          blockNumber: blockNumber ?? null,
          updatedAt: new Date(),
        })
        .where(eq(paymentRequests.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_payment_request_status', id, status });
  }

  async findExpired(): Promise<Result<PaymentRequestDB[]>> {
    return tryAsync(async () => {
      const now = new Date();
      return await this.db
        .select()
        .from(paymentRequests)
        .where(
          and(
            eq(paymentRequests.status, "pending"),
            sql`${paymentRequests.expiresAt} < ${now}`,
          ),
        );
    }, { operation: 'find_expired_payment_requests' });
  }

  async getStatusCounts(): Promise<Result<PaymentStatusCount[]>> {
    return tryAsync(async () => {
      return await this.db
        .select({
          status: paymentRequests.status,
          count: sql<number>`count(*)`.as("count"),
          totalAmount:
            sql<string>`coalesce(sum(${paymentRequests.amount}), 0)`.as(
              "total_amount",
            ),
        })
        .from(paymentRequests)
        .groupBy(paymentRequests.status);
    }, { operation: 'get_payment_request_status_counts' });
  }
}