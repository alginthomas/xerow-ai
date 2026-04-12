# Role-Based Access Control (RBAC) System - Xerow.ai

## Overview
Xerow.ai uses a comprehensive RBAC system built on the Supabase `kv_store_bffba348` database table. User roles are persisted and synchronized between Supabase Auth and the KV store to ensure consistent access control across the application.

## Database Architecture

### Storage Location
All user data is stored in the **`kv_store_bffba348`** Postgres table using the following key pattern:
```
user:{userId} → { id, email, name, role, createdAt, updatedAt }
```

### Supported Roles

1. **Guest** (Anonymous/Not signed in)
   - Browse products
   - Chat with AI assistant
   - View product recommendations
   - ❌ Cannot add to cart
   - ❌ Cannot place orders

2. **Customer** (Default role)
   - All Guest permissions +
   - ✅ Add products to cart
   - ✅ Place orders
   - ✅ Track order status
   - ✅ View order history
   - ❌ Cannot create/manage products

3. **Seller**
   - All Customer permissions +
   - ✅ Create products
   - ✅ Update own products
   - ✅ Delete own products
   - ✅ View seller dashboard
   - ✅ Manage inventory
   - ❌ Cannot modify other sellers' products

4. **Admin**
   - All permissions +
   - ✅ Update any product
   - ✅ Delete any product
   - ✅ Update order status
   - ✅ View all users
   - ✅ Full platform access

## Implementation Details

### Authentication Flow

1. **Sign Up**
   ```
   POST /make-server-bffba348/auth/signup
   Body: { email, password, name, role }
   ```
   - Creates Supabase Auth user with metadata
   - **Immediately persists user profile to KV store**
   - Validates role (customer, seller, admin)
   - Auto-confirms email (no email server needed)

2. **Sign In**
   ```
   Supabase Auth: signInWithPassword()
   → Returns access_token
   → Calls GET /user/profile
   → Loads/creates user data from KV store
   ```

3. **Session Management**
   - Access token stored in frontend state
   - User profile loaded on app initialization
   - Automatic session check on page load

### Authorization Checks

#### Backend (Server-Side)
All protected endpoints verify:
```typescript
const { data: { user } } = await supabase.auth.getUser(accessToken);
const userData = await kv.get(`user:${user.id}`);

// Role check example:
if (userData?.role !== 'seller' && userData?.role !== 'admin') {
  return c.json({ error: "Forbidden" }, 403);
}
```

#### Frontend (UI-Based)
```typescript
// Conditional rendering based on role
{user?.role === 'seller' && (
  <SellerDashboard />
)}

// Role badge display
<Badge>{user.role}</Badge>
```

## Protected Endpoints

### Cart Operations (Customers, Sellers, Admins)
- `GET /cart` - Get user's cart
- `POST /cart/items` - Add to cart
- `PUT /cart/items/:productId` - Update quantity
- `DELETE /cart` - Clear cart

### Order Operations (Customers, Sellers, Admins)
- `GET /orders` - Get user's orders
- `POST /orders` - Create order from cart
- `GET /orders/:id` - Get order by ID

### Product Management (Sellers, Admins)
- `POST /products` - Create product (Seller/Admin only)
- `PUT /products/:id` - Update product (Owner/Admin only)
- `DELETE /products/:id` - Delete product (Owner/Admin only)

### Admin Operations (Admins Only)
- `PUT /orders/:id/status` - Update order status
- `GET /admin/users` - Get all users

## Data Synchronization

### Signup Flow
```
1. User submits signup form
2. Server creates Supabase Auth user with metadata
3. Server IMMEDIATELY creates KV record:
   user:{userId} → { id, email, name, role, createdAt, updatedAt }
4. Frontend signs in automatically
5. Frontend fetches user profile (already exists in KV)
```

### Login Flow
```
1. User submits login credentials
2. Supabase Auth validates and returns access_token
3. Frontend calls GET /user/profile with token
4. Server checks KV store for user:{userId}
5. If not exists: Creates from auth metadata
6. Returns user data to frontend
7. Frontend renders UI based on role
```

### Role Enforcement
- **Dual Storage**: Role stored in both Supabase Auth metadata AND KV store
- **KV is Source of Truth**: Backend always checks KV store for role
- **Auto-Sync**: First login creates KV record if missing
- **Immutable Setup**: Role cannot be changed via regular profile update

## Frontend Role-Based UI

### Header Navigation
```tsx
{user?.role === 'seller' && (
  <Button onClick={() => setShowSellerDashboard(true)}>
    <Store /> Dashboard
  </Button>
)}
```

### Conditional Panels
- **Customer**: Cart + Orders
- **Seller**: Cart + Orders + Seller Dashboard
- **Admin**: All panels + Admin controls

### Role Badge Display
```tsx
<Badge variant="outline">{user.role}</Badge>
```

## Security Features

✅ **Server-side role validation** - All protected routes verify user role
✅ **Token-based authentication** - JWT access tokens for API calls
✅ **Ownership verification** - Sellers can only modify own products
✅ **Admin override** - Admins can manage all resources
✅ **Guest limitations** - Anonymous users have read-only access
✅ **Automatic synchronization** - Role data synced between Auth and KV

## Testing the System

### Create a Customer Account
```
1. Click "Sign In"
2. Go to "Sign Up" tab
3. Enter name, email, password
4. Select "Customer" role
5. Click "Create Account"
→ Can shop and order, cannot create products
```

### Create a Seller Account
```
1. Sign up with "Seller" role
2. After login, see "Dashboard" button in header
3. Click Dashboard → Create products
→ Can manage own products + shop
```

### Create an Admin (Via API)
```
POST /make-server-bffba348/auth/signup
{
  "email": "admin@xerow.ai",
  "password": "securepassword",
  "name": "Admin User",
  "role": "admin"
}
→ Full platform access
```

## Key Files

- **Backend**: `/supabase/functions/server/index.tsx` - All RBAC logic
- **Frontend**: `/src/app/App.tsx` - Auth state management
- **Auth UI**: `/src/app/components/AuthModal.tsx` - Sign in/up forms
- **Database**: Protected file - `/supabase/functions/server/kv_store.tsx`

## No Additional Setup Required! 

The system uses the existing `kv_store_bffba348` table - no migrations, no DDL statements, no manual database configuration needed. Everything works out of the box with the current Supabase infrastructure.
