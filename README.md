# Xerow.ai - E-commerce Platform

A modern e-commerce platform with AI-powered shopping assistant, built with React, Express, PostgreSQL, and OpenAI.

## 🏗️ Monorepo Structure

This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces).

```
xerow.ai/
├── apps/
│   ├── web/          # Frontend React application
│   └── server/       # Backend Express API server
├── packages/         # Shared packages (future)
└── pnpm-workspace.yaml
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+ (`npm install -g pnpm`)
- PostgreSQL 14+

### Installation

```bash
# Install all dependencies
pnpm install

# Set up environment variables
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your database credentials

# Set up frontend environment
echo "VITE_API_BASE_URL=http://localhost:3001/api" > apps/web/.env
```

### Database Setup

```bash
# Create database
createdb xerow

# Run schema
psql -d xerow -f apps/server/database/schema.sql
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Or run individually:
pnpm --filter web dev      # Frontend only
pnpm --filter server dev   # Backend only
```

### Build

```bash
# Build all apps
pnpm build

# Build individual apps
pnpm --filter web build
pnpm --filter server build
```

## 📦 Packages

### Apps

- **`apps/web`** - React frontend application (Vite + TypeScript)
- **`apps/server`** - Express backend API server (TypeScript + PostgreSQL)

### Packages

- Future shared packages will go here

## 🛠️ Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Recharts
- OpenAI Function Calling

### Backend
- Express.js
- TypeScript
- PostgreSQL
- JWT Authentication
- OpenAI API Integration

## 🔑 Environment Variables

### Server (`apps/server/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xerow
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
PORT=3001
```

### Web (`apps/web/.env`)
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## 📚 Features

- **AI Shopping Assistant** - OpenAI-powered chat with tool calling
- **Product Search** - Dynamic product search with real-time results
- **Recipe Generation** - AI-generated recipes with ingredient matching
- **Grocery Insights** - Spending analytics from order history
- **Product Comparison** - Side-by-side product analysis
- **Shopping Cart** - Full cart management
- **Order Management** - Order history and tracking
- **User Authentication** - JWT-based auth system
- **Role-Based Access Control** - Customer, Seller, Admin roles

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm test
```

## 📝 Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps for production
- `pnpm clean` - Clean all build artifacts
- `pnpm lint` - Lint all packages
- `pnpm type-check` - Type check all packages

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## 📄 License

Private - All rights reserved
