/**
 * Employees to Item Carousel Converter
 * Converts employee records from Supabase to Item Carousel format
 * for displaying in product card format
 */

import type { ItemCarouselItem, SerializableItemCarousel } from '../apps/web/src/lib/tool-ui/schemas';

/**
 * Employee record from Supabase database
 */
export interface EmployeeRecord {
  id: string;
  candidate_id: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  skill?: string | null;
  overall_experience?: string | null;
  relevant_experience?: string | null;
  current_location?: string | null;
  preferred_location?: string | null;
  resume_url?: string | null;
  current_ctc?: string | null;
  expected_ctc?: string | null;
  current_ctc_numeric?: number | null;
  expected_ctc_numeric?: number | null;
  stage?: string | null;
  status?: string | null;
  recruiter_name?: string | null;
  recruiter_comment?: string | null;
  earliest_available_timings?: string | null;
  notice_period?: string | null;
  // Add other fields as needed
}

/**
 * Convert a single employee record to Item Carousel Item format
 */
export function mapEmployeeToItemCarouselItem(employee: EmployeeRecord): ItemCarouselItem {
  // Build subtitle from skill and experience
  const subtitleParts: string[] = [];
  if (employee.skill) subtitleParts.push(employee.skill);
  if (employee.overall_experience && 
      employee.overall_experience !== 'z' && 
      employee.overall_experience !== 'NIL') {
    subtitleParts.push(`${employee.overall_experience} exp`);
  }
  const subtitle = subtitleParts.join(' • ') || 
                   employee.current_location || 
                   employee.preferred_location || 
                   undefined;
  
  // Determine price (prefer Expected CTC, fallback to Current CTC)
  const price = employee.expected_ctc_numeric ?? employee.current_ctc_numeric ?? undefined;
  
  // Generate color based on status (can use database function or client-side)
  const getStatusColor = (status?: string | null, stage?: string | null): string => {
    const statusLower = (status || '').toLowerCase();
    const stageLower = (stage || '').toLowerCase();
    
    if (statusLower.includes('reject') || stageLower.includes('drop')) {
      return '#ef4444'; // red
    }
    if (stageLower.includes('final select')) {
      return '#10b981'; // green
    }
    if (stageLower.includes('screening') || stageLower.includes('r1') || stageLower.includes('r2')) {
      return '#f59e0b'; // amber
    }
    if (stageLower.includes('submitted')) {
      return '#3b82f6'; // blue
    }
    return '#6366f1'; // indigo (default)
  };
  
  const color = getStatusColor(employee.status, employee.stage);
  
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
  if (!employee.status?.toLowerCase().includes('reject') && 
      !employee.stage?.toLowerCase().includes('drop')) {
    actions.push({
      id: 'schedule_interview',
      label: 'Schedule Interview',
      variant: 'outline' as const,
    });
  }
  
  return {
    id: employee.candidate_id,
    name: employee.full_name,
    subtitle,
    image: employee.resume_url || undefined,
    color,
    price,
    currency: 'INR',
    actions,
  };
}

/**
 * Convert array of employee records to Item Carousel format
 */
export function convertEmployeesToItemCarousel(
  employees: EmployeeRecord[],
  title?: string,
  description?: string
): SerializableItemCarousel {
  const items = employees.map(mapEmployeeToItemCarouselItem);
  
  return {
    id: `employee-carousel-${Date.now()}`,
    role: 'information',
    title: title || 'Employee Search Results',
    description,
    items,
  };
}

/**
 * Example Supabase query function
 * 
 * import { createClient } from '@supabase/supabase-js';
 * import { convertEmployeesToItemCarousel } from './utils/employees-to-item-carousel';
 * 
 * const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
 * 
 * // Query employees
 * const { data: employees, error } = await supabase
 *   .from('employees')
 *   .select('*')
 *   .limit(20);
 * 
 * if (employees) {
 *   const itemCarousel = convertEmployeesToItemCarousel(
 *     employees,
 *     'Kudzu Applicants',
 *     'Showing employees from tracking system'
 *   );
 * }
 */
