import { and, desc, eq, sql } from "drizzle-orm";
import {
  type NewSimulationActionDB,
  type SimulationActionDB,
  simulationActions,
} from "../../schema";
import type { Database } from "../../types";
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
// SIMULATION ACTION OPERATIONS - シミュレーション操作管理
// =============================================================================

export class SimulationActionOperations {
  constructor(private db: Database) {}

  async create(data: NewSimulationActionDB): Promise<Result<SimulationActionDB>> {
    return tryAsync(async () => {
      const validationResult = validateRequired(data, ['simulationId', 'type']);
      if (!validationResult.success) {
        throw new DatabaseError(
          DatabaseErrorType.VALIDATION_ERROR,
          validationResult.error.message
        );
      }

      const result = await this.db
        .insert(simulationActions)
        .values(data)
        .returning();
      const firstResult = getFirstResult(result, "Failed to create simulation action");
      if (!firstResult.success) {
        throw firstResult.error;
      }
      return firstResult.data;
    }, { operation: 'create_simulation_action', data });
  }

  async findById(id: string): Promise<Result<SimulationActionDB | null>> {
    return tryAsync(async () => {
      const result = await this.db
        .select()
        .from(simulationActions)
        .where(eq(simulationActions.id, id))
        .limit(1);
      return getFirstOrNull(result);
    }, { operation: 'find_simulation_action_by_id', id });
  }

  async findBySimulation(
    simulationId: string,
    limit?: number,
  ): Promise<Result<SimulationActionDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(simulationActions)
        .where(eq(simulationActions.simulationId, simulationId))
        .orderBy(desc(simulationActions.timestamp));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_simulation_actions_by_simulation', simulationId, limit });
  }

  async findByType(
    type: string,
    limit?: number,
  ): Promise<Result<SimulationActionDB[]>> {
    return tryAsync(async () => {
      const query = this.db
        .select()
        .from(simulationActions)
        .where(eq(simulationActions.type, type))
        .orderBy(desc(simulationActions.timestamp));

      return limit ? await query.limit(limit) : await query;
    }, { operation: 'find_simulation_actions_by_type', type, limit });
  }

  async updateStatus(
    id: string,
    status: string,
    error?: string | null,
  ): Promise<Result<SimulationActionDB | null>> {
    return tryAsync(async () => {
      const updateData: { status: string; error?: string | null } = { status };
      if (error !== undefined) {
        updateData.error = error;
      }

      const result = await this.db
        .update(simulationActions)
        .set(updateData)
        .where(eq(simulationActions.id, id))
        .returning();
      return getFirstOrNull(result);
    }, { operation: 'update_simulation_action_status', id, status });
  }

  async getActionsByStatus(
    simulationId: string,
    status: string,
  ): Promise<Result<SimulationActionDB[]>> {
    return tryAsync(async () => {
      return await this.db
        .select()
        .from(simulationActions)
        .where(
          and(
            eq(simulationActions.simulationId, simulationId),
            eq(simulationActions.status, status),
          ),
        )
        .orderBy(desc(simulationActions.timestamp));
    }, { operation: 'get_simulation_actions_by_status', simulationId, status });
  }

  async getActionsByTimeRange(
    simulationId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Result<SimulationActionDB[]>> {
    return tryAsync(async () => {
      return await this.db
        .select()
        .from(simulationActions)
        .where(
          and(
            eq(simulationActions.simulationId, simulationId),
            sql`${simulationActions.timestamp} >= ${startTime}`,
            sql`${simulationActions.timestamp} <= ${endTime}`,
          ),
        )
        .orderBy(desc(simulationActions.timestamp));
    }, { operation: 'get_simulation_actions_by_time_range', simulationId, startTime, endTime });
  }
}