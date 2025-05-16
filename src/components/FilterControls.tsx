'use client';

import { useState } from 'react';
import { CategoryNames, CategoryType } from '@/types/database';

export type FilterState = {
  category: string[];
  status: string[];
  dateRange: { start: Date | null; end: Date | null };
};

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void;
}

export function FilterControls({ onFilterChange }: FilterControlsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: [],
    status: [],
    dateRange: { start: null, end: null }
  });

  // Match database categories
  const CATEGORIES = [
    'electronics', 'apparel', 'books', 'stationery',
    'accessories', 'documents', 'ids_cards', 'keys', 'other'
  ];

  // Match database status enum
  const STATUS_OPTIONS = [
    'lost', 'found', 'claimed', 'archived'
  ];

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    console.log('Updating filters:', updatedFilters);
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const toggleCategory = (category: string) => {
    const updatedCategories = filters.category.includes(category)
      ? filters.category.filter(c => c !== category)
      : [...filters.category, category];
    
    handleFilterChange({ category: updatedCategories });
  };

  const toggleStatus = (status: string) => {
    const updatedStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    
    handleFilterChange({ status: updatedStatus });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg text-gray-100">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Filters</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-gray-700 text-gray-100 rounded hover:bg-gray-600"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {showFilters && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          {/* Category filters */}
          <div className="space-y-2">
            <h3 className="font-medium">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.category.includes(category)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {CategoryNames[category as CategoryType] || category}
                </button>
              ))}
            </div>
          </div>

          {/* Status filters */}
          <div className="space-y-2">
            <h3 className="font-medium">Status</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(status => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.status.includes(status)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {status}
                </button>
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
                onChange={(e) => handleFilterChange({
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value ? new Date(e.target.value) : null
                  }
                })}
              />
              <input
                type="date"
                className="p-2 border rounded bg-gray-700 text-gray-100"
                onChange={(e) => handleFilterChange({
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value ? new Date(e.target.value) : null
                  }
                })}
              />
            </div>
          </div>

          {/* Clear filters button */}
          <button
            onClick={() => handleFilterChange({
              category: [],
              status: [],
              dateRange: { start: null, end: null }
            })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
