import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

type FilterState = {
  searchQuery: string;
  category: string[];
  status: string[];
  dateRange: { start: Date | null; end: Date | null };
};

export function SearchFilter({ onFilterApply }: { onFilterApply: (filters: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    category: [],
    status: [],
    dateRange: { start: null, end: null }
  });

  const [showFilters, setShowFilters] = useState(false);

  const CATEGORIES = [
    'Electronics', 'Clothing', 'Documents', 
    'Accessories', 'Keys', 'Other'
  ];

  const STATUS_OPTIONS = [
    'Lost', 'Found', 'Claimed', 'Pending'
  ];

  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg text-gray-100">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search items..."
          className="flex-1 p-2 border rounded bg-gray-700 text-gray-100"
          value={filters.searchQuery}
          onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
        />
        <button
          onClick={() => onFilterApply(filters)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Search
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-gray-700 text-gray-100 rounded hover:bg-gray-600"
        >
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          {/* Category and Status filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Categories</h3>
              {CATEGORIES.map(category => (
                <label key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.category.includes(category)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...filters.category, category]
                        : filters.category.filter(c => c !== category);
                      setFilters({...filters, category: updated});
                    }}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Status</h3>
              {STATUS_OPTIONS.map(status => (
                <label key={status} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...filters.status, status]
                        : filters.status.filter(s => s !== status);
                      setFilters({...filters, status: updated});
                    }}
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="space-y-2">
            <h3 className="font-medium">Date Range</h3>
            <div className="flex gap-2">
              <input
                type="date"
                className="p-2 border rounded bg-gray-700 text-gray-100"
                onChange={(e) => setFilters({...filters, dateRange: {
                  ...filters.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null
                }})}
              />
              <input
                type="date"
                className="p-2 border rounded bg-gray-700 text-gray-100"
                onChange={(e) => setFilters({...filters, dateRange: {
                  ...filters.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null
                }})}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
