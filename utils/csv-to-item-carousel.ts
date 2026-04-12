/**
 * CSV to Item Carousel Converter
 * Converts Kudzu Applicants Tracking System CSV data to Item Carousel format
 * for displaying employee/applicant information in product card format
 */

import type { ItemCarouselItem, SerializableItemCarousel } from '../apps/web/src/lib/tool-ui/schemas';

/**
 * Parse CTC (Cost to Company) value from various formats
 * Handles formats like "18.6 LPA", "2.7 LPM + GST", "NA", etc.
 */
function parseCTC(ctc: string | undefined | null): number | undefined {
  if (!ctc || typeof ctc !== 'string') return undefined;
  
  const trimmed = ctc.trim();
  if (trimmed === '' || trimmed === 'NA' || trimmed === 'NIL' || trimmed === 'z') {
    return undefined;
  }
  
  // Extract number (handles formats like "18.6 LPA", "2.7 LPM + GST", "3LPM", etc.)
  const match = trimmed.match(/([\d.]+)/);
  if (!match) return undefined;
  
  const value = parseFloat(match[1]);
  if (isNaN(value)) return undefined;
  
  const upperCtc = trimmed.toUpperCase();
  
  // Convert LPA (Lakhs Per Annum) to actual rupees
  // 1 LPA = 100,000 INR
  if (upperCtc.includes('LPA')) {
    return value * 100000;
  }
  
  // Convert LPM (Lakhs Per Month) to annual (multiply by 12)
  if (upperCtc.includes('LPM')) {
    return value * 100000 * 12;
  }
  
  // If it's just a number, assume it's already in rupees
  return value;
}

/**
 * Generate color based on application status and stage
 */
function getStatusColor(status: string | undefined, stage: string | undefined): string {
  const statusLower = (status || '').toLowerCase();
  const stageLower = (stage || '').toLowerCase();
  
  // Rejected/Dropped candidates
  if (statusLower.includes('reject') || stageLower.includes('drop')) {
    return '#ef4444'; // red-500
  }
  
  // Final selected candidates
  if (stageLower.includes('final select')) {
    return '#10b981'; // green-500
  }
  
  // Screening/Interview stages
  if (stageLower.includes('screening') || stageLower.includes('r1') || stageLower.includes('r2')) {
    return '#f59e0b'; // amber-500
  }
  
  // Submitted candidates
  if (stageLower.includes('submitted')) {
    return '#3b82f6'; // blue-500
  }
  
  // Default color
  return '#6366f1'; // indigo-500
}

/**
 * Clean and normalize CSV row data
 */
function preprocessCSVRow(row: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  
  Object.keys(row).forEach(key => {
    const value = row[key];
    
    // Clean empty values
    if (value === 'z' || value === 'NIL' || value === '' || value === '#N/A' || value === null || value === undefined) {
      cleaned[key] = undefined;
    } else if (typeof value === 'string') {
      cleaned[key] = value.trim();
    } else {
      cleaned[key] = value;
    }
  });
  
  return cleaned;
}

/**
 * Map a CSV row to Item Carousel Item format
 */
export function mapCSVRowToItemCarouselItem(row: Record<string, any>): ItemCarouselItem {
  const cleaned = preprocessCSVRow(row);
  
  // Extract key fields (handling various column name variations)
  const candidateId = cleaned['Candidate ID'] || cleaned['Id'] || `candidate-${cleaned['Id'] || 'unknown'}`;
  const fullName = cleaned['Candidate Full Name'] || 'Unknown Candidate';
  const skill = cleaned['Skill'] || cleaned['Skill'] || '';
  const resumeUrl = cleaned['Resume/CV/Profile (Latest/Updated) (Attach Below)'];
  const expectedCTC = cleaned['Expected CTC'];
  const currentCTC = cleaned['Current CTC'] || cleaned['Current CTC'];
  const status = cleaned['Status'] || '';
  const stage = cleaned['Stage'] || '';
  const overallExp = cleaned['Overall Experience'] || '';
  const relevantExp = cleaned['Relevant Experience'] || '';
  const location = cleaned['Current Location'] || cleaned['Preferred Location'] || '';
  const email = cleaned['Email-ID'] || cleaned['Email'] || '';
  const phone = cleaned['Phone Number'] || '';
  
  // Build subtitle from skill and experience
  const subtitleParts: string[] = [];
  if (skill) subtitleParts.push(skill);
  if (overallExp && overallExp !== 'z' && overallExp !== 'NIL') {
    subtitleParts.push(`${overallExp} exp`);
  }
  const subtitle = subtitleParts.join(' • ') || location || undefined;
  
  // Determine price (prefer Expected CTC, fallback to Current CTC)
  const price = parseCTC(expectedCTC) || parseCTC(currentCTC);
  
  // Generate color based on status
  const color = getStatusColor(status, stage);
  
  // Build actions
  const actions = [
    {
      id: 'view_details',
      label: 'View Details',
      variant: 'secondary' as const,
    },
    {
      id: 'contact',
      label: 'Contact',
      variant: 'default' as const,
    },
  ];
  
  // Add schedule interview action if not rejected
  if (!status.toLowerCase().includes('reject') && !stage.toLowerCase().includes('drop')) {
    actions.push({
      id: 'schedule_interview',
      label: 'Schedule Interview',
      variant: 'outline' as const,
    });
  }
  
  return {
    id: candidateId,
    name: fullName,
    subtitle,
    image: resumeUrl || undefined,
    color,
    price,
    currency: 'INR',
    actions,
  };
}

/**
 * Convert array of CSV rows to Item Carousel format
 */
export function convertCSVRowsToItemCarousel(
  rows: Record<string, any>[],
  title?: string,
  description?: string
): SerializableItemCarousel {
  const items = rows.map(mapCSVRowToItemCarouselItem);
  
  return {
    id: `applicant-carousel-${Date.now()}`,
    role: 'information',
    title: title || 'Applicant Search Results',
    description,
    items,
  };
}

/**
 * Example usage:
 * 
 * import { convertCSVRowsToItemCarousel } from './utils/csv-to-item-carousel';
 * 
 * // After parsing CSV file
 * const csvRows = parseCSV(csvContent);
 * const itemCarousel = convertCSVRowsToItemCarousel(
 *   csvRows,
 *   'Kudzu Applicants',
 *   'Showing all applicants from tracking system'
 * );
 */
