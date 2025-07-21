import { desc, eq, sql } from "drizzle-orm";
import {
  type NewSimulationDB,
  type SimulationDB,
  simulations,
} from "../../schema";
import type { Database } from "../../types";
import type { SimulationCompletionStats } from "../../types/metrics";
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
// SIMULATION OPERATIONS - シミュレーション管理操作
// =============================================================================

export class SimulationOperations {
  constructor(private db: Database) {}

  async create(data: NewSimulationDB): Promise<Result<SimulationDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['scenarioType', 'userId']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db.insert(simulations).values(data).returning();
      const firstResult = getFirstResult(result, "Failed to create simulation");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_simulation', data });
  }

  async findById(id: string): Promise<Result<SimulationDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(simulations)
        .where(eq(simulations.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_simulation_by_id', id });
  }

  async findByUser(userId: string, limit?: number): Promise<Result<SimulationDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(simulations)
        .where(eq(simulations.userId, userId))
        .orderBy(desc(simulations.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_simulations_by_user', userId, limit });
  }

  async findByScenarioType(
    scenarioType: string,
    limit?: number,
  ): Promise<Result<SimulationDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(simulations)
        .where(eq(simulations.scenarioType, scenarioType))
        .orderBy(desc(simulations.createdAt));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_simulations_by_scenario_type', scenarioType, limit });
  }

  async updateProgress(
    id: string,
    currentStep: number,
  ): Promise<Result<SimulationDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(simulations)
        .set({ currentStep, updatedAt: new Date() })
        .where(eq(simulations.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_simulation_progress', id, currentStep });
  }

  async updateState(
    id: string,
    walletState?: Record<string, unknown>,
    apiState?: Record<string, unknown>,
  ): Promise<Result<SimulationDB | null>> {
    return tryAsync(async () => {
      const updateData: Partial<NewSimulationDB> = { updatedAt: new Date() };
      if (walletState !== undefined) updateData.walletState = walletState;
      if (apiState !== undefined) updateData.apiState = apiState;

      const result = await this.db
        .update(simulations)
        .set(updateData)
        .where(eq(simulations.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_simulation_state', id });
  }

  async complete(id: string): Promise<Result<SimulationDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .update(simulations)
        .set({ completed: true, updatedAt: new Date() })
        .where(eq(simulations.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'complete_simulation', id });
  }

  async delete(id: string): Promise<Result<boolean>> {
    return tryAsync(async () => {
      const result = await this.db
        .delete(simulations)
        .where(eq(simulations.id, id))
        .returning();
      return result.length > 0;
    }, { operation: 'delete_simulation', id });
  }

  async getCompletionStats(scenarioType?: string): Promise<Result<SimulationCompletionStats[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select({
          scenarioType: simulations.scenarioType,
          totalSimulations: sql<number>`count(*)`.as("total_simulations"),
          completedSimulations:
            sql<number>`count(*) filter (where ${simulations.completed} = true)`.as(
              "completed_simulations",
            ),
          completionRate:
            sql<number>`case when count(*) > 0 then (count(*) filter (where ${simulations.completed} = true)::float / count(*) * 100) else 0 end`.as(
              "completion_rate",
            ),
          averageSteps:
            sql<number>`coalesce(avg(${simulations.currentStep}), 0)`.as(
              "average_steps",
            ),
        })
        .from(simulations)
        .groupBy(simulations.scenarioType);

      if (scenarioType) {
        return await query.where(eq(simulations.scenarioType, scenarioType));
      }

      return await query;
    }, { operation: 'get_simulation_completion_stats', scenarioType });
  }
}