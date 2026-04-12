# CSV to Item Carousel Mapping for Employee/Applicant Data

## Overview
This document shows how the Kudzu Applicants Tracking System CSV data can be mapped to the Item Carousel format for displaying employee/applicant information in product card format.

## CSV Column Structure
The CSV contains applicant/employee tracking data with the following key columns:
- `Id` - Unique identifier
- `Candidate ID` - Formatted ID (e.g., "KudzuC-0000001")
- `Candidate Full Name` - Employee/applicant name
- `Skill` - Job role/skill set
- `Email-ID` - Contact email
- `Phone Number` - Contact phone
- `Current Location` - Location
- `Resume/CV/Profile (Latest/Updated)` - Resume URL
- `Current CTC`, `Expected CTC` - Salary information
- `Overall Experience`, `Relevant Experience` - Experience details
- `Stage`, `Status` - Application status
- `Recruiter Name` - Assigned recruiter
- And many more fields...

## Item Carousel Item Schema Requirements

The `ItemCarouselItem` schema expects:
```typescript
{
  id: string;                    // Required
  name: string;                  // Required
  subtitle?: string;             // Optional
  image?: string;                // Optional (URL)
  color?: string;                // Optional (hex color)
  price?: number;                // Optional
  currency?: string;             // Optional (defaults to 'INR')
  actions?: Array<{              // Optional
    id: string;
    label: string;
    variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline';
    disabled?: boolean;
  }>;
}
```

## Recommended Mapping

### Direct Mappings

| Item Carousel Field | CSV Column | Notes |
|---------------------|------------|-------|
| `id` | `Candidate ID` | Use "KudzuC-0000001" format |
| `name` | `Candidate Full Name` | Primary display name |
| `subtitle` | `Skill` | Job role/skill set |
| `image` | `Resume/CV/Profile (Latest/Updated)` | Resume URL (if available) |
| `price` | `Expected CTC` or `Current CTC` | Parse numeric value (e.g., "18.6 LPA" → 1860000) |
| `currency` | Hardcoded | `'INR'` (Indian Rupees) |

### Derived/Computed Fields

| Item Carousel Field | Source | Logic |
|---------------------|--------|-------|
| `color` | Generated | Use a color based on `Stage` or `Status` (e.g., "Final Select" = green, "Drop" = red) |
| `actions` | Generated | Create actions like "View Details", "Contact", "Schedule Interview" |

## Example Mapping Function

```typescript
function mapCSVRowToItemCarouselItem(row: any): ItemCarouselItem {
  // Parse CTC (Current/Expected) - handles formats like "18.6 LPA", "2.7 LPM", etc.
  const parseCTC = (ctc: string): number | undefined => {
    if (!ctc || ctc.trim() === '' || ctc === 'NA') return undefined;
    
    // Extract number (handles formats like "18.6 LPA", "2.7 LPM + GST", etc.)
    const match = ctc.match(/([\d.]+)/);
    if (!match) return undefined;
    
    const value = parseFloat(match[1]);
    if (isNaN(value)) return undefined;
    
    // Convert LPA (Lakhs Per Annum) to actual rupees
    // 1 LPA = 100,000 INR
    if (ctc.toUpperCase().includes('LPA')) {
      return value * 100000;
    }
    // Convert LPM (Lakhs Per Month) to annual (multiply by 12)
    if (ctc.toUpperCase().includes('LPM')) {
      return value * 100000 * 12;
    }
    
    return value;
  };

  // Generate color based on status
  const getStatusColor = (status: string, stage: string): string => {
    if (status?.toLowerCase().includes('reject') || stage?.toLowerCase().includes('drop')) {
      return '#ef4444'; // red
    }
    if (stage?.toLowerCase().includes('final select')) {
      return '#10b981'; // green
    }
    if (stage?.toLowerCase().includes('screening') || stage?.toLowerCase().includes('r1')) {
      return '#f59e0b'; // amber
    }
    return '#6366f1'; // indigo (default)
  };

  const candidateId = row['Candidate ID'] || row['Id'] || `candidate-${row['Id']}`;
  const fullName = row['Candidate Full Name'] || 'Unknown Candidate';
  const skill = row['Skill'] || '';
  const resumeUrl = row['Resume/CV/Profile (Latest/Updated) (Attach Below)'];
  const expectedCTC = row['Expected CTC'];
  const currentCTC = row['Current CTC']; // Note: column name has special character
  const status = row['Status'] || '';
  const stage = row['Stage'] || '';

  return {
    id: candidateId,
    name: fullName,
    subtitle: skill || `${row['Overall Experience'] || ''} experience`.trim(),
    image: resumeUrl || undefined,
    color: getStatusColor(status, stage),
    price: parseCTC(expectedCTC) || parseCTC(currentCTC),
    currency: 'INR',
    actions: [
      {
        id: 'view_details',
        label: 'View Details',
        variant: 'secondary',
      },
      {
        id: 'contact',
        label: 'Contact',
        variant: 'default',
      },
      {
        id: 'schedule_interview',
        label: 'Schedule Interview',
        variant: 'outline',
        disabled: status?.toLowerCase().includes('reject'),
      },
    ],
  };
}
```

## Data Quality Considerations

### Issues to Handle:
1. **Missing Data**: Many fields may be empty (e.g., "z", "NIL", empty strings)
2. **Format Variations**: CTC values vary ("18.6 LPA", "2.7 LPM + GST", "NA", etc.)
3. **Special Characters**: Some column names have special characters (e.g., `Current CTC`)
4. **URL Validation**: Resume URLs need to be validated before using as image
5. **Experience Format**: Experience fields have various formats ("9 Years", "5 years 4 months", etc.)

### Recommended Preprocessing:
```typescript
function preprocessCSVRow(row: any): any {
  // Clean empty values
  Object.keys(row).forEach(key => {
    const value = row[key];
    if (value === 'z' || value === 'NIL' || value === '' || value === '#N/A') {
      row[key] = undefined;
    }
  });
  
  // Normalize column names (handle special characters)
  if (row['Current CTC']) {
    row['Current CTC'] = row['Current CTC'];
  }
  
  return row;
}
```

## Complete Example

For a CSV row like:
```csv
Id,Index No,Candidate ID,...,Candidate Full Name,Stage,Status,...,Skill,...,Expected CTC,...
8,1,KudzuC-0000001,...,RIto test Tue 20 Dec V2,Final Select,Drop,...,SAP,...,z,...
```

The mapped Item Carousel item would be:
```json
{
  "id": "KudzuC-0000001",
  "name": "RIto test Tue 20 Dec V2",
  "subtitle": "SAP",
  "color": "#ef4444",
  "currency": "INR",
  "actions": [
    {
      "id": "view_details",
      "label": "View Details",
      "variant": "secondary"
    },
    {
      "id": "contact",
      "label": "Contact",
      "variant": "default"
    },
    {
      "id": "schedule_interview",
      "label": "Schedule Interview",
      "variant": "outline",
      "disabled": true
    }
  ]
}
```

## Testing Recommendations

1. **Test with sample rows**: Use first 10-20 rows to validate mapping
2. **Handle edge cases**: Empty fields, malformed data, special characters
3. **Validate URLs**: Ensure resume URLs are accessible
4. **Test color generation**: Verify status-based colors work correctly
5. **Test CTC parsing**: Handle various formats (LPA, LPM, plain numbers)

## Conclusion

✅ **YES, the CSV data CAN be used for testing employee information in product card format!**

The data structure is compatible with the Item Carousel format. The main work needed is:
1. Mapping CSV columns to Item Carousel fields
2. Parsing and normalizing data (especially CTC values)
3. Generating appropriate colors and actions based on status
4. Handling missing or malformed data gracefully
