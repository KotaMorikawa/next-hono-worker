import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'
import { jwtAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'

const app = new Hono()

// JWT認証ミドルウェア設定
// TODO: Replace with environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key'

// 認証が必要なルート（register/loginは除く）
app.use('/internal/auth/profile', jwtAuth({ secretKey: JWT_SECRET }))
app.use('/auth/*', jwtAuth({ secretKey: JWT_SECRET }))
app.use('/internal/user/*', jwtAuth({ secretKey: JWT_SECRET }))
app.use('/internal/generator/*', jwtAuth({ secretKey: JWT_SECRET }))

// 認証関連ルート（register/loginは認証不要、profileは認証必要）
app.route('/internal/auth', authRoutes)

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
      auth: ['/internal/auth/register', '/internal/auth/login'],
      protected: ['/protected/demo', '/protected/weather'],
      authenticated: ['/auth/profile', '/internal/auth/profile', '/internal/user/stats']
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

// JWT認証が必要なエンドポイント
app.get('/auth/profile', (c) => {
  const user = c.get('user')
  return c.json({
    message: 'User profile data',
    user: {
      id: user.userId,
      email: user.email,
      organizationId: user.organizationId
    },
    timestamp: new Date().toISOString()
  })
})

app.get('/internal/user/stats', (c) => {
  const user = c.get('user')
  return c.json({
    message: 'Internal user statistics',
    userId: user.userId,
    stats: {
      loginCount: 42,
      lastLogin: new Date().toISOString(),
      apiCallsToday: 15
    }
  })
})

export default app
