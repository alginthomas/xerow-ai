# Employee Search Debugging Guide

## Issue
Employee search results are being displayed as "Product Search Results" instead of "Employee Search Results".

## Root Cause
The frontend uses the **tool name** from the backend response to determine which UI component to render:
- `search_products` → `ProductSearchToolUI` 
- `search_employees` → `EmployeeSearchToolUI`

If the backend returns a step with `name: "search_products"`, the frontend will use `ProductSearchToolUI` even if the result contains employee data.

## What Was Fixed

### 1. Python Backend (`apps/mcp-agent/`)

**Added `search_employees` tool:**
- ✅ Added to `tools.py` with proper description
- ✅ Added `handle_search_employees` function to `mock_mcp_server.py`
- ✅ Registered in TOOLS dict

**Added validation in `core.py`:**
- ✅ Intercepts `search_products` calls when query contains people keywords
- ✅ Automatically redirects to `search_employees`
- ✅ Extracts skills from query
- ✅ Logs validation actions

**Updated system prompt:**
- ✅ Added mandatory validation step
- ✅ Added examples showing correct tool selection
- ✅ Emphasized that developer/employee context overrides "find products"

**Formatted results:**
- ✅ `handle_search_employees` now returns Item Carousel format
- ✅ Matches Node.js backend format exactly
- ✅ Filters out invalid employee records

### 2. Frontend (`apps/web/src/`)

**Updated parser:**
- ✅ `isProductArray()` now checks for employee-specific fields first
- ✅ Won't convert employee arrays to product carousels

**Added detection:**
- ✅ `ProductSearchToolUI` now detects if result title contains "Employee"
- ✅ Logs warning when employee result is detected with wrong tool name

## How to Debug

### Check Python Backend Logs

When you search for developers, look for these log messages:

1. **Validation triggering:**
   ```
   [VALIDATION] ⚠️  REDIRECTING: search_products → search_employees
   [VALIDATION]   Query: "..."
   [VALIDATION]   User context: "..."
   ```

2. **Tool execution:**
   ```
   [RUN] Processing tool call: tool_name=search_employees
   [RUN] Adding step: tool_name=search_employees
   handle_search_employees called with: query='...'
   Found X employees
   Formatted X employees as Item Carousel
   ```

3. **If validation doesn't trigger:**
   ```
   [RUN] Processing tool call: tool_name=search_products
   [RUN] Adding step: tool_name=search_products
   ```
   This means the validation didn't detect people keywords.

### Check Frontend Console

Look for these messages:

1. **Correct tool:**
   ```
   [EmployeeSearchToolUI] Raw result: {...}
   [EmployeeSearchToolUI] Parsed as Item Carousel: {...}
   ```

2. **Wrong tool (current issue):**
   ```
   [ProductSearchToolUI] Raw result: {...}
   [ProductSearchToolUI] Parsed as Item Carousel: {title: "Employee Search Results", ...}
   [ProductSearchToolUI] ⚠️  Detected employee result with wrong tool name!
   ```

## Expected Behavior

When searching for developers:
1. User: "Find Java developers"
2. Python backend validation detects "developer" keyword
3. Redirects `search_products` → `search_employees`
4. Step name is `search_employees`
5. Frontend uses `EmployeeSearchToolUI`
6. Shows "Employee Search Results" with employee cards

## If Still Not Working

1. **Check if Python backend is running:**
   - Frontend calls `http://localhost:8000/api/chat`
   - Make sure `server.py` is running

2. **Check Python backend logs:**
   - Look for `[VALIDATION]` messages
   - Look for `[RUN] Adding step: tool_name=...`
   - Verify tool_name is `search_employees`, not `search_products`

3. **Check frontend console:**
   - Look for `[ProductSearchToolUI]` vs `[EmployeeSearchToolUI]`
   - Check the tool name in the tool call

4. **Restart Python backend:**
   - Changes to `core.py`, `tools.py`, `mock_mcp_server.py` require restart
   - Kill and restart `server.py`

5. **Clear browser cache:**
   - Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
   - Clear localStorage if needed

## Next Steps

If validation is not triggering:
- Check if people keywords are being detected
- Verify the query text being checked
- Add more keywords to the detection list

If validation triggers but tool name is still wrong:
- Check `_parse_tool_call` function
- Verify redirected_call structure
- Check if tool name is correctly extracted
