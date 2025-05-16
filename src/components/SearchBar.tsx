'use client';

import { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (term: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search items..."
        className="w-full p-2 pl-10 border rounded bg-gray-700 text-gray-100"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <svg 
        className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20" 
        fill="currentColor"
      >
        <path 
          fillRule="evenodd" 
          d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
          clipRule="evenodd" 
        />
      </svg>
    </div>
  );
}
