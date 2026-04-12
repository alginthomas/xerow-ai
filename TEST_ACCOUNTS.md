# Xerow.ai - Test Accounts

## How to Create Test Accounts

1. **Click the "🧪 Test Accounts" button** in the top-right corner of the application
2. **Click "Create Test Accounts"** in the modal that appears
3. **Copy the credentials** displayed for each account type

The system will automatically create 3 test accounts with different roles.

---

## Test Account Credentials

### 👤 Customer Account
**Role:** Customer (can browse, add to cart, and place orders)

- **Email:** `customer@xerow.ai`
- **Password:** `customer123`
- **Name:** Test Customer

**What you can do:**
- ✅ Browse products via chat
- ✅ Add products to cart
- ✅ Place orders
- ✅ Track order status
- ❌ Cannot create or manage products

---

### 🏪 Seller Account
**Role:** Seller (can manage products + all customer features)

- **Email:** `seller@xerow.ai`
- **Password:** `seller123`
- **Name:** Test Seller

**What you can do:**
- ✅ All customer features (browse, cart, orders)
- ✅ Access Seller Dashboard
- ✅ Create new products
- ✅ Update own products
- ✅ Delete own products
- ✅ Manage inventory
- ❌ Cannot modify other sellers' products

---

### 🛡️ Admin Account
**Role:** Admin (full platform access)

- **Email:** `admin@xerow.ai`
- **Password:** `admin123`
- **Name:** Test Admin

**What you can do:**
- ✅ All customer and seller features
- ✅ Modify any product (regardless of owner)
- ✅ Delete any product
- ✅ Update order status
- ✅ View all users
- ✅ Full platform moderation

---

## Manual Testing Guide

### Test Customer Features
1. Sign in with `customer@xerow.ai`
2. Chat: "Show me electronics"
3. Click "Add to Cart" on a product
4. Click "Cart" button → Checkout
5. Click "Orders" to see your order

### Test Seller Features
1. Sign in with `seller@xerow.ai`
2. Click "Dashboard" button in header
3. Click "Add Product" to create a new product
4. Fill in product details and save
5. Try editing/deleting your products
6. Test shopping as a customer too!

### Test Admin Features
1. Sign in with `admin@xerow.ai`
2. Access all products (can edit any)
3. View all users (coming soon)
4. Moderate platform content

---

## Backend Endpoint

The test accounts are created via:
```
POST https://{projectId}.supabase.co/functions/v1/make-server-bffba348/seed/accounts
```

This endpoint:
- Creates accounts in Supabase Auth
- Stores user profiles in KV database
- Validates role assignments
- Handles duplicate accounts gracefully

---

## Database Storage

All user data is stored in the `kv_store_bffba348` table with this structure:

```typescript
user:{userId} → {
  id: string,
  email: string,
  name: string,
  role: 'customer' | 'seller' | 'admin',
  createdAt: string,
  updatedAt: string
}
```

---

## Security Notes

⚠️ **These are test accounts for development/demo purposes only**

- Passwords are intentionally simple for testing
- Do not use these credentials in production
- The accounts persist until manually deleted from Supabase
- Email confirmation is disabled for testing convenience

---

## Next Steps After Testing

1. **Create your own accounts** using the Sign Up form
2. **Test role transitions** by signing up with different roles
3. **Explore RBAC** by comparing what each role can access
4. **Review permissions** in `/RBAC_SYSTEM.md` for full documentation

---

**Happy Testing! 🎉**
