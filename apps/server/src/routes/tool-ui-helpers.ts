/**
 * Tool UI Helper Functions
 * Format data for Tool UI components (Item Carousel, Data Table, etc.)
 */

/**
 * Format employee search results as Item Carousel
 */
export function formatEmployeeSearchAsItemCarousel(
  employees: any[],
  searchQuery?: string,
  filters?: { skill?: string; location?: string; stage?: string; status?: string; minCTC?: number; maxCTC?: number }
): any {
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

  const items = employees.map((employee) => {
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
        variant: 'secondary' as const,
      });
    }

    // Ensure we have a valid name - use candidate_id as fallback if full_name is missing
    const employeeName = employee.full_name || 
                        (employee.candidate_id ? `Employee ${employee.candidate_id}` : null) ||
                        (employee.id ? `Employee ${employee.id.substring(0, 8)}` : 'Employee');

    return {
      id: employee.candidate_id || employee.id,
      name: employeeName,
      subtitle,
      image: employee.resume_url || undefined,
      color,
      price,
      currency: 'INR',
      actions,
      // Include original employee data for dialog (hidden from schema validation)
      _employeeData: {
        ...employee, // Store full employee record for dialog
      },
    };
  });

  // Build title with search context
  let title = 'Employee Search Results';
  if (searchQuery) {
    const capitalizedQuery = searchQuery
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    title = `Search Results for "${capitalizedQuery}"`;
  }

  // Build description with filters
  const filterParts: string[] = [];
  if (filters?.skill) filterParts.push(`Skill: ${filters.skill}`);
  if (filters?.location) filterParts.push(`Location: ${filters.location}`);
  if (filters?.stage) filterParts.push(`Stage: ${filters.stage}`);
  if (filters?.status) filterParts.push(`Status: ${filters.status}`);
  if (filters?.minCTC) filterParts.push(`Min CTC: ₹${filters.minCTC.toLocaleString()}`);
  if (filters?.maxCTC) filterParts.push(`Max CTC: ₹${filters.maxCTC.toLocaleString()}`);
  const description = filterParts.length > 0 ? filterParts.join(', ') : undefined;

  return {
    id: `employee-carousel-${Date.now()}`,
    role: 'information' as const,
    title,
    description,
    items,
  };
}
