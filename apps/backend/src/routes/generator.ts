import { Hono } from 'hono'
import { createDatabaseConnection, GeneratedApiOperations } from '@repo/db'
import type { Database } from '@repo/db'
import { naturalLanguageInputSchema } from '@repo/shared/api'
import { LLMService } from '../services/llm-service'

const generatorRoutes = new Hono()

// Database connection helper
async function getDatabaseConnection(): Promise<Database> {
  const connection = await createDatabaseConnection()
  return connection.db as unknown as Database
}

// POST /create - API生成
generatorRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json()
    const user = c.get('user')
    
    // バリデーション
    const validationResult = naturalLanguageInputSchema.safeParse(body)
    if (!validationResult.success) {
      return c.json({
        error: 'Validation failed',
        details: validationResult.error.issues
      }, 400)
    }

    const database = await getDatabaseConnection()
    const generatedApiOperations = new GeneratedApiOperations(database)
    const llmService = new LLMService()

    // LLMでAPI生成
    const llmResult = await llmService.generateApiFromNaturalLanguage(validationResult.data)
    if (!llmResult.success) {
      return c.json({ error: 'API generation failed' }, 500)
    }

    // DBに保存
    if (!llmResult.data) {
      return c.json({ error: 'Failed to generate API specification' }, 500)
    }
    
    const createResult = await generatedApiOperations.create({
      name: llmResult.data.name,
      description: llmResult.data.description,
      endpoint: llmResult.data.endpoint,
      method: llmResult.data.method,
      price: llmResult.data.price,
      currency: 'USDC',
      generatedCode: llmResult.data.generatedCode,
      documentation: llmResult.data.documentation,
      status: 'draft',
      userId: user.userId,
      organizationId: user.organizationId
    })

    if (!createResult.success) {
      return c.json({ error: 'Failed to save API' }, 500)
    }

    return c.json({
      success: true,
      data: createResult.data
    }, 201)

  } catch (_error) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /list - ユーザーのAPI一覧
generatorRoutes.get('/list', async (c) => {
  try {
    const user = c.get('user')
    const database = await getDatabaseConnection()
    const generatedApiOperations = new GeneratedApiOperations(database)

    const result = await generatedApiOperations.findByUser(user.userId)
    if (!result.success) {
      return c.json({ error: 'Failed to fetch APIs' }, 500)
    }

    return c.json({
      success: true,
      data: result.data
    })

  } catch (_error) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /:id - API詳細取得
generatorRoutes.get('/:id', async (c) => {
  try {
    const apiId = c.req.param('id')
    const user = c.get('user')
    const database = await getDatabaseConnection()
    const generatedApiOperations = new GeneratedApiOperations(database)

    const result = await generatedApiOperations.findById(apiId)
    if (!result.success) {
      return c.json({ error: 'Database error' }, 500)
    }

    if (!result.data) {
      return c.json({ error: 'API not found' }, 404)
    }

    // アクセス権限チェック
    if (result.data.userId !== user.userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    return c.json({
      success: true,
      data: result.data
    })

  } catch (_error) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /:id - API削除
generatorRoutes.delete('/:id', async (c) => {
  try {
    const apiId = c.req.param('id')
    const user = c.get('user')
    const database = await getDatabaseConnection()
    const generatedApiOperations = new GeneratedApiOperations(database)

    // 存在確認とアクセス権限チェック
    const findResult = await generatedApiOperations.findById(apiId)
    if (!findResult.success) {
      return c.json({ error: 'Database error' }, 500)
    }

    if (!findResult.data) {
      return c.json({ error: 'API not found' }, 404)
    }

    if (findResult.data.userId !== user.userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // 削除実行
    const deleteResult = await generatedApiOperations.delete(apiId)
    if (!deleteResult.success) {
      return c.json({ error: 'Failed to delete API' }, 500)
    }

    return c.json({
      success: true,
      message: 'API deleted successfully'
    })

  } catch (_error) {
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export { generatorRoutes }