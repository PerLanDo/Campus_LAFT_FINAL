import { SupabaseClient } from '@supabase/supabase-js';

export type FilterParams = {
  searchQuery?: string;
  category?: string[];
  status?: string[];
  dateRange?: { start?: Date | null; end?: Date | null };
  location?: string[];
};

export async function filterItems(
  supabase: SupabaseClient,
  filters: FilterParams,
  pagination: { page: number; itemsPerPage: number } = { page: 1, itemsPerPage: 10 }
) {
  const offset = (pagination.page - 1) * pagination.itemsPerPage;
  console.log('Filter parameters:', filters);

  // Validate inputs
  if (filters.searchQuery?.trim().length === 0) {
    delete filters.searchQuery;
  }
  if (!filters.category?.length) {
    delete filters.category;
  }
  if (!filters.status?.length) {
    delete filters.status;
  }

  let query = supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + pagination.itemsPerPage - 1);

  if (filters.searchQuery) {
    query = query.textSearch('description', filters.searchQuery, {
      type: 'websearch',
      config: 'english'
    });
  }

  if (filters.category?.length) {
    query = query.in('category', filters.category);
  }

  if (filters.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters.dateRange?.start) {
    const startDate = new Date(filters.dateRange.start);
    if (!isNaN(startDate.getTime())) {
      query = query.gte('created_at', startDate.toISOString());
    }
  }

  if (filters.dateRange?.end) {
    const endDate = new Date(filters.dateRange.end);
    if (!isNaN(endDate.getTime())) {
      query = query.lte('created_at', endDate.toISOString());
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
