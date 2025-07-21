import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'

const app = new Hono()

// x402ミドルウェア設定
// Base SepoliaネットワークでUSDC決済を設定
app.use(paymentMiddleware(
  // TODO: Replace with actual wallet address
  '0x1234567890123456789012345678901234567890',
  {
    '/protected/*': {
      price: '$0.01',
      network: 'base-sepolia',
      config: {
        description: 'Access to premium API content',
        maxTimeoutSeconds: 120
      }
    }
  }
))

// 無料エンドポイント
app.get('/', (c) => {
  return c.json({ 
    message: 'x402 Learning Lab API',
    version: '1.0.0',
    endpoints: {
      free: ['/'],
      protected: ['/protected/demo', '/protected/weather']
    }
  })
})

// 保護されたエンドポイント（x402決済が必要）
app.get('/protected/demo', (c) => {
  return c.json({ 
    message: 'This is protected content!',
    timestamp: new Date().toISOString(),
    data: {
      secret: 'Only available after payment',
      value: 42
    }
  })
})

app.get('/protected/weather', (c) => {
  return c.json({
    location: 'Tokyo',
    temperature: 25,
    condition: 'Sunny',
    humidity: 60,
    paid_data: {
      detailed_forecast: '5-day premium weather forecast',
      alerts: ['No severe weather expected']
    }
  })
})

export default app
