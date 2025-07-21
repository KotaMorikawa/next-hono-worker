import type {
  CodeValidationResult,
  DynamicRouteEntry,
  DynamicRouteMetadata,
  DynamicRouteResult,
} from "../types/dynamic-routes";
import { KVHelper, KVKeys } from "../utils/workers-env";

export class DynamicRouteManager {
  private kvHelper: KVHelper;

  constructor(kv?: KVNamespace) {
    this.kvHelper = new KVHelper(kv);
  }

  /**
   * ルートをKVに保存
   */
  async saveRoute(
    routeEntry: DynamicRouteEntry,
  ): Promise<DynamicRouteResult<DynamicRouteEntry>> {
    try {
      // コードバリデーション
      const validation = this.validateCode(routeEntry.code);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid code detected: ${validation.errors.join(", ")}`,
        };
      }

      // KVキーを生成
      const key = KVKeys.dynamicRoute(
        routeEntry.metadata.userId,
        routeEntry.metadata.apiId,
        routeEntry.metadata.version,
      );

      // KVに保存（30日間有効）
      const saved = await this.kvHelper.put(key, routeEntry, {
        expirationTtl: 86400 * 30,
      });

      if (!saved) {
        return {
          success: false,
          error: "Failed to save route to KV storage",
        };
      }

      // メタデータも別途保存（検索用）
      await this.saveRouteMetadata(routeEntry.metadata);

      return {
        success: true,
        data: routeEntry,
      };
    } catch (error) {
      return {
        success: false,
        error: `Save route failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * ルートをKVから読み込み
   */
  async loadRoute(
    userId: string,
    apiId: string,
    version?: number,
  ): Promise<DynamicRouteResult<DynamicRouteEntry | null>> {
    try {
      let targetVersion = version;

      // バージョンが指定されていない場合、最新バージョンを取得
      if (!targetVersion) {
        const latestVersion = await this.getLatestVersion(userId, apiId);
        if (!latestVersion) {
          return { success: true, data: null };
        }
        targetVersion = latestVersion;
      }

      const key = KVKeys.dynamicRoute(userId, apiId, targetVersion);
      const routeEntry = await this.kvHelper.get<DynamicRouteEntry>(key);

      return {
        success: true,
        data: routeEntry,
      };
    } catch (error) {
      return {
        success: false,
        error: `Load route failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * ユーザーのすべてのルートを一覧表示
   */
  async listUserRoutes(
    userId: string,
  ): Promise<DynamicRouteResult<DynamicRouteMetadata[]>> {
    try {
      const prefix = KVKeys.userRoutes(userId);
      const keys = await this.kvHelper.list({ prefix });

      const routeMetadataList: DynamicRouteMetadata[] = [];

      for (const key of keys) {
        const routeEntry = await this.kvHelper.get<DynamicRouteEntry>(key);
        if (routeEntry) {
          routeMetadataList.push(routeEntry.metadata);
        }
      }

      // バージョン順でソート
      routeMetadataList.sort((a, b) => {
        if (a.apiId === b.apiId) {
          return b.version - a.version; // 新しいバージョンを先に
        }
        return a.apiId.localeCompare(b.apiId);
      });

      return {
        success: true,
        data: routeMetadataList,
      };
    } catch (error) {
      return {
        success: false,
        error: `List user routes failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * ルートのロールバック
   */
  async rollbackRoute(
    userId: string,
    apiId: string,
    targetVersion: number,
  ): Promise<DynamicRouteResult<DynamicRouteEntry>> {
    try {
      // ターゲットバージョンのルートを取得
      const targetRouteResult = await this.loadRoute(
        userId,
        apiId,
        targetVersion,
      );
      if (!targetRouteResult.success || !targetRouteResult.data) {
        return {
          success: false,
          error: `Target version ${targetVersion} not found`,
        };
      }

      // 新しいバージョン番号を生成
      const nextVersion = await this.getNextVersion(userId, apiId);

      // ロールバック用の新しいエントリを作成
      const rollbackEntry: DynamicRouteEntry = {
        code: targetRouteResult.data.code,
        metadata: {
          ...targetRouteResult.data.metadata,
          version: nextVersion,
          createdAt: new Date().toISOString(),
          status: "active",
        },
      };

      // 新しいバージョンとして保存
      return await this.saveRoute(rollbackEntry);
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * ルートの削除
   */
  async deleteRoute(
    userId: string,
    apiId: string,
    version?: number,
  ): Promise<DynamicRouteResult<boolean>> {
    try {
      if (version) {
        // 特定バージョンを削除
        const key = KVKeys.dynamicRoute(userId, apiId, version);
        const deleted = await this.kvHelper.delete(key);
        return { success: true, data: deleted };
      } else {
        // すべてのバージョンを削除
        const userRoutes = await this.listUserRoutes(userId);
        if (!userRoutes.success) {
          return {
            success: false,
            error: "Failed to list user routes for deletion",
          };
        }

        const apiRoutes =
          userRoutes.data?.filter((route) => route.apiId === apiId) || [];

        for (const route of apiRoutes) {
          const key = KVKeys.dynamicRoute(userId, apiId, route.version);
          await this.kvHelper.delete(key);
        }

        // メタデータも削除
        const metaKey = KVKeys.routeMetadata(userId, apiId);
        await this.kvHelper.delete(metaKey);

        return { success: true, data: true };
      }
    } catch (error) {
      return {
        success: false,
        error: `Delete route failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * コードバリデーション
   */
  private validateCode(code: string): CodeValidationResult {
    const errors: string[] = [];

    // コード長チェック
    if (code.length > 50000) {
      // 50KB制限
      errors.push("Code exceeds maximum length");
    }

    // 危険な関数のチェック
    const forbiddenFunctions = [
      "eval",
      "Function",
      "setTimeout",
      "setInterval",
      "process.exit",
    ];
    for (const forbidden of forbiddenFunctions) {
      if (code.includes(forbidden)) {
        errors.push(`Forbidden function: ${forbidden}`);
      }
    }

    // 許可されていないインポートのチェック
    const allowedImports = ["hono", "x402-hono", "@repo/shared", "@repo/db"];
    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
    let match: RegExpExecArray | null = null;
    match = importRegex.exec(code);
    while (match !== null) {
      const importPath = match[1];
      const isAllowed = allowedImports.some(
        (allowed) =>
          importPath === allowed || importPath.startsWith(`${allowed}/`),
      );

      if (
        !isAllowed &&
        !importPath.startsWith("./") &&
        !importPath.startsWith("../")
      ) {
        errors.push(`Unauthorized import: ${importPath}`);
      }
      match = importRegex.exec(code);
    }

    // 基本的なHono構造チェック
    if (!code.includes("new Hono(")) {
      errors.push("Missing Hono initialization");
    }
    if (!code.includes("export default")) {
      errors.push("Missing default export");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 最新バージョン番号を取得
   */
  private async getLatestVersion(
    userId: string,
    apiId: string,
  ): Promise<number | null> {
    const userRoutes = await this.listUserRoutes(userId);
    if (!userRoutes.success || !userRoutes.data) {
      return null;
    }

    const apiVersions = userRoutes.data
      .filter((route) => route.apiId === apiId)
      .map((route) => route.version);

    return apiVersions.length > 0 ? Math.max(...apiVersions) : null;
  }

  /**
   * 次のバージョン番号を生成
   */
  private async getNextVersion(userId: string, apiId: string): Promise<number> {
    const latestVersion = await this.getLatestVersion(userId, apiId);
    return (latestVersion || 0) + 1;
  }

  /**
   * ルートメタデータを保存（検索用）
   */
  private async saveRouteMetadata(
    metadata: DynamicRouteMetadata,
  ): Promise<void> {
    const key = KVKeys.routeMetadata(metadata.userId, metadata.apiId);
    await this.kvHelper.put(key, metadata);
  }
}
