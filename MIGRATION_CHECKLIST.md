# PostgreSQL Migration Checklist

Use this checklist to verify your migration is complete and working correctly.

## ✅ Pre-Migration Checklist

- [ ] PostgreSQL is installed and running
- [ ] Database `xerow` has been created
- [ ] You have database credentials (host, port, user, password)

## ✅ Step 1: Database Setup

- [ ] PostgreSQL database created (`createdb xerow`)
- [ ] Schema file exists at `server/database/schema.sql`
- [ ] Schema has been executed successfully
- [ ] All tables created (users, products, carts, cart_items, orders, order_items, chat_sessions, chat_messages)
- [ ] Can connect to database: `psql -d xerow`

## ✅ Step 2: Backend Server Setup

- [ ] Navigated to `server/` directory
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created in `server/` directory
- [ ] `.env` file contains:
  - [ ] `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - [ ] `JWT_SECRET` (strong random string)
  - [ ] `OPENAI_API_KEY` (if using AI chat)
  - [ ] `PORT=3001`
  - [ ] `FRONTEND_URL=http://localhost:5173`
- [ ] Server starts without errors (`npm run dev`)
- [ ] See "✅ Connected to PostgreSQL database" message
- [ ] See "🚀 Server running on http://localhost:3001" message

## ✅ Step 3: Frontend Configuration

- [ ] `.env` file created in project root
- [ ] `.env` contains `VITE_API_BASE_URL=http://localhost:3001/api`
- [ ] `src/services/api.ts` uses correct API_BASE_URL
- [ ] `src/app/App.tsx` uses new authentication (not Supabase)
- [ ] Frontend starts without errors (`npm run dev`)

## ✅ Step 4: Testing

### Backend Health Check
- [ ] `curl http://localhost:3001/health` returns success
- [ ] Response: `{"status":"ok","version":"1.0.0","database":"PostgreSQL"}`

### Authentication
- [ ] Can sign up: `curl -X POST http://localhost:3001/api/auth/signup ...`
- [ ] Receives token in response
- [ ] Can sign in: `curl -X POST http://localhost:3001/api/auth/signin ...`
- [ ] Receives token in response
- [ ] Token works for authenticated endpoints

### Products
- [ ] `curl http://localhost:3001/api/products` returns product list (may be empty)
- [ ] Can create product (as seller/admin)
- [ ] Can update product
- [ ] Can delete product

### Cart & Orders
- [ ] Can add items to cart (when authenticated)
- [ ] Can view cart
- [ ] Can update cart quantities
- [ ] Can create order from cart
- [ ] Can view orders

### Frontend Testing
- [ ] Can sign up through UI
- [ ] Can sign in through UI
- [ ] Can browse products
- [ ] Can add to cart (when signed in)
- [ ] Can checkout and create order
- [ ] AI chat works (if OpenAI key configured)

## ✅ Code Verification

- [ ] No Supabase imports in frontend code
- [ ] No Supabase client usage
- [ ] All API calls use `/api` endpoints
- [ ] JWT tokens stored in `localStorage` as `auth_token`
- [ ] Authentication headers include `Authorization: Bearer <token>`

## ✅ Common Issues to Check

- [ ] Database connection errors → Check `.env` credentials
- [ ] CORS errors → Check `FRONTEND_URL` in server `.env`
- [ ] 401 Unauthorized → Check token is being sent
- [ ] 404 Not Found → Check API endpoint URLs
- [ ] 500 Server Error → Check server logs

## ✅ Production Readiness

- [ ] Strong `JWT_SECRET` set (32+ characters)
- [ ] Database SSL enabled (`DB_SSL=true`) if using cloud DB
- [ ] Environment variables secured (not in git)
- [ ] HTTPS configured for API
- [ ] CORS properly configured for production domain
- [ ] Database backups configured
- [ ] Error logging/monitoring set up

## 🎉 Migration Complete!

If all items are checked, your migration from Supabase to PostgreSQL is complete!
