import type { Hono } from "hono";
import type {
  DeploymentInfo,
  DynamicRouteEntry,
  DynamicRouteResult,
} from "../types/dynamic-routes";
import { DynamicRouteManager } from "./dynamic-route-manager";
import type { GeneratedApiSpec } from "./llm-service";
import { SecureCodeExecutor } from "./secure-code-executor";

export class DynamicDeploymentService {
  public routeManager: DynamicRouteManager;
  private codeExecutor: SecureCodeExecutor;
  private mainApp: Hono;
  private deployedRoutes: Map<string, object>; // apiId -> Hono app instance
  private routeRegistrations: Map<string, string>; // apiId -> endpoint

  constructor(mainApp: Hono) {
    this.routeManager = new DynamicRouteManager();
    this.codeExecutor = new SecureCodeExecutor();
    this.mainApp = mainApp;
    this.deployedRoutes = new Map();
    this.routeRegistrations = new Map();
  }

  /**
   * 生成されたAPIを動的にデプロイ
   */
  async deployGeneratedApi(
    apiSpec: GeneratedApiSpec,
    userId: string,
    apiId: string,
  ): Promise<DynamicRouteResult<DeploymentInfo>> {
    try {
      // 既存のデプロイメント確認
      const existingDeployment = await this.getActiveDeployment(userId, apiId);
      const nextVersion =
        existingDeployment.success && existingDeployment.data
          ? existingDeployment.data.version + 1
          : 1;

      // ルートエントリ作成
      const routeEntry: DynamicRouteEntry = {
        code: apiSpec.generatedCode,
        metadata: {
          endpoint: apiSpec.endpoint,
          method: apiSpec.method,
          status: "draft",
          createdAt: new Date().toISOString(),
          version: nextVersion,
          userId,
          apiId,
        },
      };

      // ルート保存
      const saveResult = await this.routeManager.saveRoute(routeEntry);
      if (!saveResult.success) {
        return {
          success: false,
          error: `Failed to save route: ${saveResult.error}`,
        };
      }

      // コードコンパイル
      const compileResult = await this.codeExecutor.compileHonoRoute(
        apiSpec.generatedCode,
      );
      if (!compileResult.success) {
        return {
          success: false,
          error: `Code validation failed: ${compileResult.error}`,
        };
      }

      // 動的ルート登録
      if (!compileResult.data) {
        return {
          success: false,
          error: "Compiled route data is missing",
        };
      }

      const registrationResult = await this.registerDynamicRoute(
        apiId,
        apiSpec.endpoint,
        compileResult.data,
      );

      if (!registrationResult.success) {
        return {
          success: false,
          error: `Route registration failed: ${registrationResult.error}`,
        };
      }

      // デプロイメント情報作成
      const deploymentInfo: DeploymentInfo = {
        deploymentId: `deploy_${userId}_${apiId}_${nextVersion}`,
        status: "deployed",
        endpoint: apiSpec.endpoint,
        version: nextVersion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: compileResult.metadata,
      };

      // ルートステータスを active に更新
      routeEntry.metadata.status = "active";
      await this.routeManager.saveRoute(routeEntry);

      return {
        success: true,
        data: deploymentInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: `Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * デプロイメントのロールバック
   */
  async rollbackDeployment(
    userId: string,
    apiId: string,
    targetVersion: number,
  ): Promise<DynamicRouteResult<DeploymentInfo>> {
    try {
      // ロールバック実行
      const rollbackResult = await this.routeManager.rollbackRoute(
        userId,
        apiId,
        targetVersion,
      );
      if (!rollbackResult.success) {
        return {
          success: false,
          error: `Rollback failed: ${rollbackResult.error}`,
        };
      }

      if (!rollbackResult.data) {
        return {
          success: false,
          error: "Rollback data is missing",
        };
      }

      const rolledBackRoute = rollbackResult.data;

      // コードを再コンパイル
      const compileResult = await this.codeExecutor.compileHonoRoute(
        rolledBackRoute.code,
      );
      if (!compileResult.success) {
        return {
          success: false,
          error: `Rollback compilation failed: ${compileResult.error}`,
        };
      }

      // ルート再登録
      if (!compileResult.data) {
        return {
          success: false,
          error: "Compiled rollback data is missing",
        };
      }

      await this.unregisterDynamicRoute(apiId);
      const registrationResult = await this.registerDynamicRoute(
        apiId,
        rolledBackRoute.metadata.endpoint,
        compileResult.data,
      );

      if (!registrationResult.success) {
        return {
          success: false,
          error: `Rollback registration failed: ${registrationResult.error}`,
        };
      }

      const deploymentInfo: DeploymentInfo = {
        deploymentId: `deploy_${userId}_${apiId}_${rolledBackRoute.metadata.version}`,
        status: "rolled_back",
        endpoint: rolledBackRoute.metadata.endpoint,
        version: rolledBackRoute.metadata.version,
        createdAt: rolledBackRoute.metadata.createdAt,
        updatedAt: new Date().toISOString(),
        metadata: compileResult.metadata,
      };

      return {
        success: true,
        data: {
          ...deploymentInfo,
          activeVersion: targetVersion,
        } as DeploymentInfo & { activeVersion: number },
      };
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * APIの無効化
   */
  async undeployApi(
    userId: string,
    apiId: string,
  ): Promise<DynamicRouteResult<DeploymentInfo>> {
    try {
      // ルートの無効化
      await this.unregisterDynamicRoute(apiId);

      // 最新ルートのステータスを inactive に更新
      const routeResult = await this.routeManager.loadRoute(userId, apiId);
      if (routeResult.success && routeResult.data) {
        routeResult.data.metadata.status = "inactive";
        await this.routeManager.saveRoute(routeResult.data);
      }

      const deploymentInfo: DeploymentInfo = {
        deploymentId: `deploy_${userId}_${apiId}_undeploy`,
        status: "undeployed",
        endpoint: routeResult.data?.metadata.endpoint || "",
        version: routeResult.data?.metadata.version || 0,
        createdAt:
          routeResult.data?.metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: deploymentInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: `Undeploy failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * デプロイメント一覧取得
   */
  async listDeployments(
    userId: string,
  ): Promise<DynamicRouteResult<DeploymentInfo[]>> {
    try {
      const userRoutesResult = await this.routeManager.listUserRoutes(userId);
      if (!userRoutesResult.success) {
        return {
          success: false,
          error: `Failed to list user routes: ${userRoutesResult.error}`,
        };
      }

      if (!userRoutesResult.data) {
        return {
          success: false,
          error: "User routes data is missing",
        };
      }

      const deployments: DeploymentInfo[] = userRoutesResult.data.map(
        (route) => ({
          deploymentId: `deploy_${route.userId}_${route.apiId}_${route.version}`,
          status:
            route.status === "active"
              ? ("deployed" as const)
              : ("undeployed" as const),
          endpoint: route.endpoint,
          version: route.version,
          createdAt: route.createdAt,
          updatedAt: route.createdAt,
        }),
      );

      return {
        success: true,
        data: deployments,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list deployments: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * アクティブなデプロイメント取得
   */
  async getActiveDeployment(
    userId: string,
    apiId: string,
  ): Promise<DynamicRouteResult<DeploymentInfo | null>> {
    try {
      const routeResult = await this.routeManager.loadRoute(userId, apiId);
      if (!routeResult.success || !routeResult.data) {
        return { success: true, data: null };
      }

      const route = routeResult.data;
      if (route.metadata.status !== "active") {
        return { success: true, data: null };
      }

      const deploymentInfo: DeploymentInfo = {
        deploymentId: `deploy_${userId}_${apiId}_${route.metadata.version}`,
        status: "deployed",
        endpoint: route.metadata.endpoint,
        version: route.metadata.version,
        createdAt: route.metadata.createdAt,
        updatedAt: route.metadata.createdAt,
      };

      return {
        success: true,
        data: deploymentInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get active deployment: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 動的ルートを登録
   */
  private async registerDynamicRoute(
    apiId: string,
    endpoint: string,
    honoApp: object,
  ): Promise<DynamicRouteResult<void>> {
    try {
      // 既存ルートがある場合は削除
      if (this.routeRegistrations.has(apiId)) {
        await this.unregisterDynamicRoute(apiId);
      }

      // 新しいルートを登録
      this.deployedRoutes.set(apiId, honoApp);
      this.routeRegistrations.set(apiId, endpoint);

      // メインアプリにルートを動的追加
      // テスト環境では動的ルート登録をスキップ
      if (process.env.NODE_ENV !== "test") {
        if (typeof honoApp === 'object' && honoApp && 'fetch' in honoApp) {
          this.mainApp.route(endpoint, honoApp as never);
        } else {
          throw new Error("Invalid Hono application object");
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Route registration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * 動的ルートを削除
   */
  private async unregisterDynamicRoute(
    apiId: string,
  ): Promise<DynamicRouteResult<void>> {
    try {
      this.deployedRoutes.delete(apiId);
      this.routeRegistrations.delete(apiId);

      // 注意: Honoでは動的ルート削除は制限されているため、
      // 実際の実装では無効化フラグを使用するかルートハンドラーで404を返す

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Route unregistration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * リソースクリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.codeExecutor.cleanup();
    this.deployedRoutes.clear();
    this.routeRegistrations.clear();
  }
}
