import { Item, CategoryType } from '@/types/database';
import { FilterState } from '@/components/FilterControls';

export function applyFilters(items: Item[], filters: FilterState): Item[] {
  console.log('Filter function called with:', { itemCount: items.length, filters });
  
  if (!items || !Array.isArray(items)) {
    console.error('Invalid items array:', items);
    return [];
  }
  
  return items.filter(item => {
    try {
      // Debug item
      console.log('Processing item:', { 
        id: item.id, 
        category: item.category, 
        status: item.status,
        date: item.date_reported || item.created_at
      });
      
      // Category filter
      if (filters.category.length > 0) {
        // For debugging
        console.log('Item category:', item.category);
        console.log('Selected categories:', filters.category);
        
        // Simple string comparison for now
        const categoryMatches = filters.category.some(cat => {
          if (typeof item.category === 'string') {
            return item.category.toLowerCase() === cat.toLowerCase();
          }
          return false;
        });
        
        if (!categoryMatches) {
          return false;
        }
      }
      
      // Status filter
      if (filters.status.length > 0) {
        // Case insensitive comparison
        const statusMatches = filters.status.some(status => 
          item.status?.toLowerCase() === status.toLowerCase()
        );
        
        if (!statusMatches) {
          return false;
        }
      }
      
      // Date range filter - start date
      if (filters.dateRange.start) {
        try {
          const dateStr = item.date_reported || item.created_at || '';
          const itemDate = new Date(dateStr);
          
          if (isNaN(itemDate.getTime())) {
            console.warn('Invalid date:', dateStr);
          } else if (itemDate < filters.dateRange.start) {
            return false;
          }
        } catch (err) {
          console.error('Date comparison error (start):', err);
        }
      }
      
      // Date range filter - end date
      if (filters.dateRange.end) {
        try {
          const dateStr = item.date_reported || item.created_at || '';
          const itemDate = new Date(dateStr);
          
          if (isNaN(itemDate.getTime())) {
            console.warn('Invalid date:', dateStr);
          } else if (itemDate > filters.dateRange.end) {
            return false;
          }
        } catch (err) {
          console.error('Date comparison error (end):', err);
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error filtering item:', err, item);
      return false;
    }
  });
}

export function applySearch(items: Item[], searchTerm: string): Item[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }
  
  const term = searchTerm.toLowerCase().trim();
  
  return items.filter(item => {
    return (
      (item.title && item.title.toLowerCase().includes(term)) ||
      (item.description && item.description.toLowerCase().includes(term)) ||
      (item.location_description && item.location_description.toLowerCase().includes(term)) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  });
}
