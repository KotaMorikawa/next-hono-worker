# Development Environment Setup

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd next-hono-worker
   npm run setup
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Environment**
   ```bash
   # Start Docker services (PostgreSQL + Redis)
   npm run docker:up
   
   # Initialize database
   npm run db:migrate
   
   # Start all development servers
   npm run dev
   ```

## Available Scripts

### Docker Commands
- `npm run docker:up` - Start PostgreSQL and Redis containers
- `npm run docker:down` - Stop containers
- `npm run docker:logs` - View container logs
- `npm run docker:reset` - Reset containers and volumes

### Database Commands
- `npm run db:generate` - Generate new migration files
- `npm run db:migrate` - Apply migrations to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm run db:reset` - Reset database with fresh migration

### Development Commands
- `npm run dev` - Start all development servers
- `npm run build` - Build all packages and apps
- `npm run lint` - Check code quality
- `npm run typecheck` - TypeScript type checking
- `npm run test` - Run tests

## Services

### PostgreSQL Database
- **Host**: localhost:5432
- **Database**: x402_learning_lab
- **User**: x402_user
- **Password**: x402_password

### Redis Cache
- **Host**: localhost:6379
- **Use case**: KV store compatibility during development

### Drizzle Studio
- **Access**: http://localhost:4983
- **Command**: `npm run db:studio`
- **Note**: Requires database to be running

## Architecture

```
apps/
  frontend/     # Next.js 15 + Cloudflare Workers
  backend/      # Hono + x402 + Cloudflare Workers  
  jobs/         # Background processing

packages/
  shared/       # Type definitions and Zod schemas
  db/           # Drizzle ORM and database layer
  tsconfig/     # Shared TypeScript configurations
```

## Environment Variables

Key environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `GEMINI_API_KEY` - Google Gemini API key (primary LLM)
- `X402_WALLET_ADDRESS` - Wallet address for x402 payments

## Troubleshooting

### Docker Issues
```bash
# Reset everything
npm run docker:reset

# Check container status
docker-compose ps

# View container logs
npm run docker:logs
```

### Database Issues
```bash
# Reset database completely
npm run db:reset

# Check database connection
docker exec x402-postgres psql -U x402_user -d x402_learning_lab -c "\dt"
```

### Build Issues
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```