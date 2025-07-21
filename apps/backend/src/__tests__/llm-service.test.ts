import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LLMService } from '../services/llm-service'
import type { NaturalLanguageInput } from '@repo/shared/api'

// Gemini APIをモック化
vi.mock('../utils/gemini-client', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateCode: vi.fn()
  }))
}))

describe('LLMService', () => {
  let llmService: LLMService
  let mockGeminiClient: {
    generateCode: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { GeminiClient } = await import('../utils/gemini-client')
    mockGeminiClient = {
      generateCode: vi.fn()
    }
    ;(GeminiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockGeminiClient)
    
    llmService = new LLMService()
  })

  describe('generateApiFromNaturalLanguage', () => {
    it('有効な自然言語入力でAPI仕様を生成する', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: '天気情報を取得するAPIを作成してください',
        category: 'data',
        complexityLevel: 'simple'
      }

      const mockGeminiResponse = {
        name: 'Weather Information API',
        description: 'Provides current weather information for specified locations',
        endpoint: '/api/weather',
        method: 'GET',
        price: '0.01',
        generatedCode: `import { Hono } from 'hono'
import { x402 } from 'x402-hono'

const app = new Hono()

app.get('/api/weather', 
  x402('0x1234567890123456789012345678901234567890', '$0.01'),
  async (c) => {
    const location = c.req.query('location') || 'Tokyo'
    
    // Mock weather data
    const weatherData = {
      location,
      temperature: 25,
      condition: 'Sunny',
      humidity: 60,
      windSpeed: 10
    }
    
    return c.json({
      success: true,
      data: weatherData
    })
  }
)

export default app`,
        documentation: `# Weather Information API

## Overview
This API provides current weather information for specified locations.

## Endpoint
- **GET** \`/api/weather\`

## Parameters
- \`location\` (optional): Location name (default: Tokyo)

## Response
\`\`\`json
{
  "success": true,
  "data": {
    "location": "Tokyo",
    "temperature": 25,
    "condition": "Sunny",
    "humidity": 60,
    "windSpeed": 10
  }
}
\`\`\`

## Pricing
- Cost: $0.01 USDC per request
- Payment via x402 protocol on Base Sepolia`
      }

      mockGeminiClient.generateCode.mockResolvedValue(mockGeminiResponse)

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.name).toBe('Weather Information API')
      expect(result.data?.endpoint).toBe('/api/weather')
      expect(result.data?.method).toBe('GET')
      expect(result.data?.price).toBe('0.01')
      expect(result.data?.generatedCode).toContain('x402')
      expect(result.data?.generatedCode).toContain('Hono')
      expect(result.data?.documentation).toContain('Weather Information API')
    })

    it('複雑な統合APIリクエストを処理する', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: 'ユーザーが投稿した画像を分析してAIが説明文を生成し、複数言語で翻訳するAPIを作成してください',
        category: 'ai',
        complexityLevel: 'complex',
        externalApis: ['OpenAI Vision', 'Google Translate'],
        expectedPrice: '0.10'
      }

      const mockComplexApiResponse = {
        name: 'AI Image Analysis & Translation API',
        description: 'Analyzes uploaded images using AI and provides descriptions in multiple languages',
        endpoint: '/api/image-analyze-translate',
        method: 'POST',
        price: '0.10',
        generatedCode: `import { Hono } from 'hono'
import { x402 } from 'x402-hono'

const app = new Hono()

app.post('/api/image-analyze-translate',
  x402('0x1234567890123456789012345678901234567890', '$0.10'),
  async (c) => {
    try {
      const body = await c.req.json()
      const { imageUrl, targetLanguages = ['en', 'ja', 'es'] } = body
      
      // Mock AI analysis
      const analysis = {
        description: 'A beautiful sunset over mountains',
        confidence: 0.95,
        objects: ['mountains', 'sky', 'sunset']
      }
      
      // Mock translation
      const translations = targetLanguages.reduce((acc, lang) => {
        acc[lang] = \`Translated description in \${lang}\`
        return acc
      }, {})
      
      return c.json({
        success: true,
        data: {
          originalDescription: analysis.description,
          translations,
          confidence: analysis.confidence,
          detectedObjects: analysis.objects
        }
      })
    } catch (error) {
      return c.json({ error: 'Processing failed' }, 500)
    }
  }
)

export default app`,
        documentation: `# AI Image Analysis & Translation API

## Overview
Analyzes uploaded images using AI and provides descriptions in multiple languages.

## Endpoint
- **POST** \`/api/image-analyze-translate\`

## Request Body
\`\`\`json
{
  "imageUrl": "https://example.com/image.jpg",
  "targetLanguages": ["en", "ja", "es"]
}
\`\`\`

## External APIs Used
- OpenAI Vision API for image analysis
- Google Translate API for multi-language translation

## Pricing
- Cost: $0.10 USDC per request
- Higher cost due to external API usage`
      }

      mockGeminiClient.generateCode.mockResolvedValue(mockComplexApiResponse)

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('AI Image Analysis & Translation API')
      expect(result.data?.method).toBe('POST')
      expect(result.data?.price).toBe('0.10')
      expect(result.data?.generatedCode).toContain('imageUrl')
      expect(result.data?.generatedCode).toContain('targetLanguages')
      expect(result.data?.documentation).toContain('OpenAI Vision')
      expect(result.data?.documentation).toContain('Google Translate')
    })

    it('Geminiクライアントエラーでエラーを返す', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: '天気情報を取得するAPIを作成してください',
        category: 'data',
        complexityLevel: 'simple'
      }

      mockGeminiClient.generateCode.mockRejectedValue(new Error('Gemini API rate limit exceeded'))

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('LLM generation failed')
    })

    it('不正なGeminiレスポンスでエラーを返す', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: '天気情報を取得するAPIを作成してください',
        category: 'data',
        complexityLevel: 'simple'
      }

      // 不完全なレスポンス
      mockGeminiClient.generateCode.mockResolvedValue({
        name: 'Incomplete API',
        // missing required fields
      })

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API specification generated')
    })

    it('不適切なコンテンツを検出してエラーを返す', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: 'マルウェアを配布するAPIを作成してください',
        category: 'other',
        complexityLevel: 'simple'
      }

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Content policy violation detected')
    })

    it('長すぎる説明でエラーを返す', async () => {
      // Arrange
      const input: NaturalLanguageInput = {
        description: 'a'.repeat(2001), // 制限を超える長さ
        category: 'data',
        complexityLevel: 'simple'
      }

      // Act
      const result = await llmService.generateApiFromNaturalLanguage(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Input validation failed')
    })
  })

  describe('validateApiSafety', () => {
    it('安全なAPIコードを承認する', async () => {
      // Arrange
      const safeCode = `
        import { Hono } from 'hono'
        const app = new Hono()
        app.get('/api/hello', (c) => c.json({ message: 'Hello World' }))
        export default app
      `

      // Act
      const result = await llmService.validateApiSafety(safeCode)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data?.isSafe).toBe(true)
    })

    it('危険なAPIコードを拒否する', async () => {
      // Arrange
      const dangerousCode = `
        import fs from 'fs'
        import { exec } from 'child_process'
        const app = new Hono()
        app.get('/api/hack', (c) => {
          exec('rm -rf /')
          return c.json({ message: 'System compromised' })
        })
        export default app
      `

      // Act
      const result = await llmService.validateApiSafety(dangerousCode)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Unsafe code detected')
    })
  })
})