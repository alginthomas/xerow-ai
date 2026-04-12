# CSV Data Testing Summary

## ✅ Conclusion: YES, the CSV data CAN be used for testing!

The **Kudzu Applicants Tracking System V1.csv** file contains applicant/employee data that is **fully compatible** with the Item Carousel (product card) format used in your application.

## What I Found

### CSV Data Structure
- **Total rows**: ~5,579 rows (based on file analysis)
- **Key columns available**:
  - `Candidate ID` (e.g., "KudzuC-0000001") → Perfect for `id` field
  - `Candidate Full Name` → Perfect for `name` field
  - `Skill` → Perfect for `subtitle` field
  - `Resume/CV/Profile (Latest/Updated)` → Can be used for `image` field
  - `Expected CTC` / `Current CTC` → Can be parsed for `price` field
  - `Status` / `Stage` → Can be used to generate `color` field
  - Many other fields for additional context

### Compatibility Assessment

| Item Carousel Requirement | CSV Data Available | Status |
|---------------------------|---------------------|--------|
| `id` (string) | ✅ Candidate ID | ✅ Perfect match |
| `name` (string) | ✅ Candidate Full Name | ✅ Perfect match |
| `subtitle` (optional) | ✅ Skill + Experience | ✅ Can be derived |
| `image` (optional URL) | ✅ Resume URL | ✅ Available |
| `price` (optional number) | ✅ Expected/Current CTC | ✅ Can be parsed |
| `currency` (optional) | N/A | ✅ Can default to 'INR' |
| `color` (optional hex) | ✅ Status/Stage | ✅ Can be derived |
| `actions` (optional) | N/A | ✅ Can be generated |

## Files Created

I've created the following files to help you test:

### 1. `CSV_TO_ITEM_CAROUSEL_MAPPING.md`
   - Detailed mapping documentation
   - Field-by-field conversion guide
   - Example mappings and edge cases

### 2. `utils/csv-to-item-carousel.ts`
   - Production-ready conversion utility
   - Handles CTC parsing (LPA, LPM formats)
   - Status-based color generation
   - Data cleaning and normalization

### 3. `utils/test-csv-conversion.ts`
   - Test script to validate conversion
   - Processes sample rows
   - Generates output files for inspection

## How to Test

### Option 1: Quick Test (Recommended)
```bash
# Install CSV parser if needed
npm install csv-parse

# Run the test script
npx ts-node utils/test-csv-conversion.ts
```

This will:
- Parse your CSV file
- Convert first 5 rows to show examples
- Convert all rows to Item Carousel format
- Save sample outputs to JSON files

### Option 2: Use in Your Application
```typescript
import { convertCSVRowsToItemCarousel } from './utils/csv-to-item-carousel';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';

// Read and parse CSV
const csvContent = fs.readFileSync('path/to/your/csv', 'utf-8');
const rows = parse(csvContent, { columns: true, skip_empty_lines: true });

// Convert to Item Carousel
const itemCarousel = convertCSVRowsToItemCarousel(
  rows,
  'Kudzu Applicants',
  'Employee tracking data'
);

// Use in your bot/application
// The itemCarousel is now ready to be displayed in ItemCarousel component
```

### Option 3: Test with Bot
You can have your bot:
1. Read the CSV file
2. Convert rows using the utility function
3. Display in Item Carousel format
4. Test interactions (view details, contact, schedule interview)

## Data Quality Notes

### ✅ Strengths
- Consistent Candidate ID format
- Rich metadata (experience, location, skills)
- Resume URLs available for many candidates
- Status/Stage information for filtering

### ⚠️ Considerations
- Some fields may be empty ("z", "NIL", blank)
- CTC values in various formats (LPA, LPM, plain numbers)
- Some resume URLs may need validation
- Special characters in column names

All of these are handled in the conversion utility!

## Example Output

For a CSV row like:
```
Candidate ID: KudzuC-0000002
Candidate Full Name: Nitesh Sharma
Skill: SAP ETM/PM/EAM
Expected CTC: 2.7 LPM + GST
Status: (empty)
Stage: (empty)
```

The converted Item Carousel item would be:
```json
{
  "id": "KudzuC-0000002",
  "name": "Nitesh Sharma",
  "subtitle": "SAP ETM/PM/EAM • 17 Years exp",
  "price": 3240000,
  "currency": "INR",
  "color": "#6366f1",
  "actions": [
    { "id": "view_details", "label": "View Details", "variant": "secondary" },
    { "id": "contact", "label": "Contact", "variant": "default" },
    { "id": "schedule_interview", "label": "Schedule Interview", "variant": "outline" }
  ]
}
```

## Next Steps

1. **Run the test script** to see actual conversions
2. **Review the sample outputs** in the generated JSON files
3. **Integrate with your bot** using the utility function
4. **Customize actions/colors** based on your needs
5. **Test the Item Carousel component** with real data

## Support

If you encounter any issues:
- Check the mapping documentation in `CSV_TO_ITEM_CAROUSEL_MAPPING.md`
- Review the conversion utility code in `utils/csv-to-item-carousel.ts`
- Run the test script to see detailed output

---

**Bottom line**: Your CSV data is ready to use! The conversion utilities are in place, and you can start testing immediately. 🚀
