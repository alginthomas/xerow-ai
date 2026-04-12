# Employee Search Setup - Complete! ✅

## Overview
Your Xerow bot can now search and display employee/applicant data from the Supabase database in product card format!

## What Was Added

### 1. **Database Function** (`search_employees`)
   - Created in Supabase to efficiently search employees
   - Supports filtering by:
     - Name, skill, location (text search)
     - Skill (specific filter)
     - Location (current or preferred)
     - Stage (application stage)
     - Status (application status)
     - CTC range (min/max salary)

### 2. **Server-Side Function** (`searchEmployees`)
   - Added to `/server/src/routes/chat.ts`
   - Connects to Supabase using the Supabase client
   - Calls the `search_employees` database function

### 3. **Tool Definition** (`search_employees`)
   - Added to OpenAI tool definitions
   - Bot can now understand queries about employees
   - Automatically extracts search parameters from user queries

### 4. **Item Carousel Formatter** (`formatEmployeeSearchAsItemCarousel`)
   - Added to `/server/src/routes/tool-ui-helpers.ts`
   - Converts employee data to product card format
   - Includes status-based colors, actions, and metadata

## How to Use

### Example Queries You Can Ask the Bot:

1. **General Search:**
   - "Show me employees"
   - "Find candidates"
   - "Search for applicants"

2. **By Skill:**
   - "Find SAP developers"
   - "Show me Java developers"
   - "Search for Power BI consultants"

3. **By Location:**
   - "Find employees in Bengaluru"
   - "Show remote candidates"
   - "Search applicants in Hyderabad"

4. **By Stage/Status:**
   - "Show final selected candidates"
   - "Find candidates in screening stage"
   - "Show rejected applicants"

5. **By CTC/Salary:**
   - "Find employees with CTC above 20 LPA"
   - "Show candidates with expected CTC under 15 LPA"
   - "Search for employees with salary between 10-20 LPA"

6. **Combined Filters:**
   - "Find SAP developers in Bengaluru"
   - "Show Java developers with CTC above 15 LPA"
   - "Search for remote Power BI consultants in final select stage"

## Data Display Format

Each employee is displayed as a card showing:
- **Name**: Full name of the candidate
- **Subtitle**: Skill + Experience (e.g., "SAP • 17 Years exp")
- **Image**: Resume URL (if available)
- **Price**: Expected/Current CTC in INR
- **Color**: Status-based color coding:
  - 🔴 Red: Rejected/Dropped
  - 🟢 Green: Final Selected
  - 🟡 Amber: Screening/Interview stages
  - 🔵 Blue: Submitted
  - 🟣 Indigo: Default

**Actions Available:**
- View Details
- Contact
- Schedule Interview (if not rejected)

## Technical Details

### Database Function
```sql
SELECT * FROM search_employees(
  search_query := 'SAP',
  skill_filter := NULL,
  location_filter := 'Bengaluru',
  stage_filter := NULL,
  status_filter := NULL,
  min_ctc := 1000000,
  max_ctc := 3000000,
  limit_count := 20
);
```

### API Integration
The bot automatically:
1. Detects employee-related queries
2. Extracts search parameters
3. Calls `searchEmployees()` function
4. Formats results as Item Carousel
5. Displays in product card format

## Next Steps

1. **Test the Integration:**
   - Start your server: `npm run dev` (or your start command)
   - Open the chat interface
   - Try the example queries above

2. **Customize (Optional):**
   - Adjust search limits in the tool definition
   - Modify color schemes in `formatEmployeeSearchAsItemCarousel`
   - Add more filters or search criteria

3. **Monitor Performance:**
   - Check Supabase logs for query performance
   - Optimize indexes if needed (already created)

## Files Modified

1. ✅ `server/src/routes/chat.ts` - Added searchEmployees function and tool handler
2. ✅ `server/src/routes/tool-ui-helpers.ts` - Added formatEmployeeSearchAsItemCarousel
3. ✅ Supabase database - Created `search_employees` function
4. ✅ Supabase database - Created `employees` table (already done)

## Verification

To verify everything works:

```bash
# Check if employees table has data
# In Supabase SQL Editor:
SELECT COUNT(*) FROM employees;

# Test the search function
SELECT * FROM search_employees('SAP', NULL, 'Bengaluru', NULL, NULL, NULL, NULL, 10);
```

## Support

If you encounter issues:
1. Check Supabase connection (URL and key in environment variables)
2. Verify RLS policies allow reads (already configured)
3. Check server logs for errors
4. Ensure the `search_employees` function exists in Supabase

---

**You're all set!** 🎉 The bot can now search and display employee data based on any criteria you specify!
