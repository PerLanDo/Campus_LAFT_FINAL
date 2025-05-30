"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { CategoryNames } from "@/types/database";
import { formatDistanceToNow } from "date-fns";
import { SearchBar } from "@/components/SearchBar";
import { FilterControls, FilterState } from "@/components/FilterControls";
import { applyFilters, applySearch, ExtendedItem } from "@/utils/filters";
import ClientOnly from "@/components/ClientOnly";

// Helper function to format date
const formatDateAgo = (dateString: string | undefined) => {
  if (!dateString) return "Date not available";
  try {
    return `${formatDistanceToNow(new Date(dateString), { addSuffix: true })}`;
  } catch {
    return "Invalid date";
  }
};

// Friendly category name
const getCategoryName = (category?: string) => {
  if (!category) return "Unknown";

  // Use CategoryNames mapping
  return (
    CategoryNames[category as keyof typeof CategoryNames] ||
    category.charAt(0).toUpperCase() + category.slice(1).replace("_", " ")
  );
};

// Add this type above the HomePage component
interface ItemWithPoster extends ExtendedItem {
  poster?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function HomePage() {
  const supabase = createClientComponentClient();
  const [allItems, setAllItems] = useState<ItemWithPoster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    category: [],
    status: [],
    dateRange: { start: null, end: null },
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [statusTab, setStatusTab] = useState<'all' | 'lost' | 'found'>('all');

  // Fetch all items and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch items with poster's profile (name)
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select(`*, poster:profiles!user_id(id, full_name, avatar_url)`)
          .order("created_at", { ascending: false });

        if (itemsError) throw itemsError;

        // Map category_id to category string key for filtering
        const idToCategoryKey = Object.keys(CategoryNames).reduce(
          (acc, key, idx) => {
            acc[idx + 1] = key; // Assumes category_id starts at 1 and increments
            return acc;
          },
          {} as Record<number, string>
        );
        const processedItems = (itemsData || []).map((item) => ({
          ...item,
          category:
            item.category || idToCategoryKey[item.category_id] || "other",
        }));

        console.log("Fetched items with mapped categories:", processedItems);
        setAllItems(processedItems);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  // Apply filters and search to items
  const filteredItems = useMemo(() => {
    let filtersToApply = { ...activeFilters };
    if (statusTab === 'lost') {
      filtersToApply = { ...filtersToApply, status: ['lost'] };
    } else if (statusTab === 'found') {
      filtersToApply = { ...filtersToApply, status: ['found'] };
    }
    const filtered = applyFilters(allItems, filtersToApply);
    const searchResults = applySearch(filtered, searchTerm);
    return searchResults as ItemWithPoster[];
  }, [allItems, activeFilters, searchTerm, statusTab]);

  // Calculate pagination
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // Reset pagination when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, searchTerm]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
        Campus LAFT
      </h1>
      {/* Lost/Found filter buttons */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          className={`px-6 py-2 rounded-full font-semibold border transition-colors duration-200 ${statusTab === 'lost' ? 'bg-red-600 text-white border-red-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-red-100 dark:hover:bg-red-900'}`}
          onClick={() => setStatusTab('lost')}
        >
          Lost
        </button>
        <button
          className={`px-6 py-2 rounded-full font-semibold border transition-colors duration-200 ${statusTab === 'found' ? 'bg-green-600 text-white border-green-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-900'}`}
          onClick={() => setStatusTab('found')}
        >
          Found
        </button>
        <button
          className={`px-6 py-2 rounded-full font-semibold border transition-colors duration-200 ${statusTab === 'all' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}
          onClick={() => setStatusTab('all')}
        >
          All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-1">
          <div className="space-y-4">
            <SearchBar onSearch={setSearchTerm} />
            <FilterControls onFilterChange={setActiveFilters} />
          </div>
        </div>

        <div className="md:col-span-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No items found matching your criteria.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Showing {paginatedItems.length} of {filteredItems.length} items
              </p>

              <ClientOnly>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedItems.map((item) => {
                    const thumbnail =
                      item.image_urls && item.image_urls.length > 0
                        ? item.image_urls[0]
                        : item.image_url;

                    // Base classes
                    const baseCardClasses =
                      "relative flex flex-col h-full rounded-2xl overflow-hidden shadow-[0_2px_24px_0_rgba(60,60,180,0.05)] border transition-shadow hover:shadow-xl hover:-translate-y-[2px] focus:ring-2 focus:ring-indigo-400 outline-none";
                    const baseUrgentBadgeClasses =
                      "absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-extrabold shadow z-20 text-white";
                    const baseStatusBadgeClasses =
                      "px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm";
                    const baseCategoryBadgeClasses =
                      "px-2 py-0.5 rounded-full text-xs border font-medium";

                    // Dynamic styles and classes
                    const cardDynamicClasses = "";
                    let cardDynamicStyles: React.CSSProperties = {};
                    let urgentBadgeClasses = baseUrgentBadgeClasses;
                    let urgentBadgeStyle: React.CSSProperties = {}; // Restored declaration
                    let statusBadgeClasses = baseStatusBadgeClasses;
                    let statusBadgeStyle: React.CSSProperties = {}; // Restored declaration
                    let categoryBadgeClasses = baseCategoryBadgeClasses;
                    let categoryBadgeStyle: React.CSSProperties = {};

                    const greenShade = "#003e29";
                    const redShade = "#f92609";

                    // Map of category colors - high contrast for dark backgrounds
                    const categoryColorMap: Record<string, string> = {
                      electronics: "#2563eb", // blue-600
                      accessories: "#d97706", // amber-600
                      clothing: "#db2777", // pink-600
                      books: "#059669", // emerald-600
                      documents: "#7c3aed", // violet-600
                      keys: "#f59e42", // orange-400
                      wallet: "#ea580c", // orange-600
                      id_cards: "#f43f5e", // rose-600
                      other: "#64748b", // slate-500
                    };

                    // Get color based on category, fallback to a default color
                    const getCategoryColor = (category?: string) => {
                      if (!category) return "#e6d8c3"; // default color
                      return (
                        categoryColorMap[category.toLowerCase()] || "#e6d8c3"
                      );
                    };

                    if (item.status === "found") {
                      cardDynamicStyles = {
                        backgroundColor: "#252c3a",
                        // borderWidth: "5px", // Removed for 1px default border
                        borderColor: "#22c55e", // green-500
                      };
                      urgentBadgeClasses += " bg-rose-600 text-white";
                      statusBadgeClasses += " bg-green-500 text-white";
                      categoryBadgeStyle = {
                        backgroundColor: getCategoryColor(item.category),
                        borderColor: 'rgba(255, 255, 255, 0.4)', // Semi-transparent white border
                        // color: "#fff", // Will be handled by class
                      };
                      categoryBadgeClasses += " text-white";
                    } else if (item.status === "lost") {
                      cardDynamicStyles = {
                        backgroundColor: "#252c3a",
                        // borderWidth: "4px", // Removed for 1px default border
                        borderColor: "#ef4444", // red-500
                      };
                      urgentBadgeClasses += " bg-red-500 text-white";
                      statusBadgeClasses += " bg-red-500 text-white";
                      categoryBadgeStyle = {
                        backgroundColor: getCategoryColor(item.category),
                        borderColor: 'rgba(255, 255, 255, 0.4)', // Semi-transparent white border
                        // color: "#fff", // Will be handled by class
                      };
                      categoryBadgeClasses += " text-white";
                    } else {
                      // Claimed, Other, etc.
                      cardDynamicStyles = {
                        backgroundColor: "#252c3a",
                        // borderWidth: "5px", // Removed for 1px default border
                        borderColor: "#6366f1", // indigo-500
                      };
                      urgentBadgeClasses += " bg-pink-600 text-white"; // Remains as is, already good
                      statusBadgeClasses +=
                        " bg-yellow-400 text-gray-900 dark:bg-yellow-500 dark:text-white"; // Remains as is, already good
                      // Category badge styling for 'other' status will now be consistent
                      categoryBadgeClasses += " text-white";
                      categoryBadgeStyle = {
                        backgroundColor: getCategoryColor(item.category), // Use general category color logic
                        borderColor: 'rgba(255, 255, 255, 0.4)', // Semi-transparent white border
                        // color: "#fff", // Will be handled by class
                      };
                    }

                    return (
                      <Link
                        href={`/item/${item.id}`}
                        key={item.id}
                        className="group block h-full"
                      >
                        <div
                          className={`${baseCardClasses} ${cardDynamicClasses}`}
                          style={cardDynamicStyles}
                        >
                          {/* Thumbnail or fallback */}
                          {thumbnail ? (
                            <div className="relative w-full h-64 bg-gray-200 dark:bg-gray-700">
                              <Image
                                src={thumbnail}
                                alt={item.title}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                priority={true}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-full h-64 bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-gray-800 dark:to-gray-900">
                              <span className="text-4xl text-indigo-400 dark:text-indigo-300">
                                🖼️
                              </span>
                            </div>
                          )}
                          {/* "Urgent" badge */}
                          {item.is_urgent && (
                            <span
                              className={urgentBadgeClasses}
                              style={urgentBadgeStyle}
                            >
                              Urgent
                            </span>
                          )}
                          <div className="flex-1 flex flex-col p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {/* Status badge */}
                              <span
                                className={statusBadgeClasses}
                                style={statusBadgeStyle}
                              >
                                {item.status.charAt(0).toUpperCase() +
                                  item.status.slice(1)}
                              </span>
                              {/* Category badge */}
                              {item.category !== null && (
                                <span
                                  className={categoryBadgeClasses}
                                  style={categoryBadgeStyle}
                                >
                                  {getCategoryName(item.category)}
                                </span>
                              )}
                              {/* Secured by campus security badge */}
                              {item.turn_in_to_security && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-semibold">
                                  🛡️ Secured
                                </span>
                              )}
                            </div>
                            <h2 className="text-lg font-bold text-white mb-1 truncate group-hover:text-gray-200 dark:group-hover:text-gray-200">
                              {item.title}
                            </h2>
                            {item.poster?.full_name && (
                              <p className="text-xs text-gray-400 dark:text-gray-400 mb-1 flex items-center gap-2">
                                <span className="font-medium text-gray-300 dark:text-gray-200">
                                  Posted by:
                                </span>
                                {item.poster.avatar_url && (
                                  <Image
                                    src={item.poster.avatar_url}
                                    alt={item.poster.full_name}
                                    width={20}
                                    height={20}
                                    className="rounded-full object-cover"
                                  />
                                )}
                                <span>{item.poster.full_name}</span>
                              </p>
                            )}
                            <p
                              className="text-xs text-gray-300 dark:text-gray-400 mb-1 truncate"
                              title={item.location_description || undefined}
                            >
                              <span className="font-medium text-gray-100 dark:text-gray-300">
                                Location:
                              </span>{" "}
                              {item.location_description ||
                                "No location provided"}
                            </p>
                            <div className="mt-auto">
                              <p className="text-[12px] text-gray-300 dark:text-gray-500 mt-2">
                                Reported{" "}
                                {formatDateAgo(item.date_reported || undefined)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {/* Pagination controls */}
                {filteredItems.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2">
                      Page {currentPage} of{" "}
                      {Math.ceil(filteredItems.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={
                        currentPage >=
                        Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
                      }
                      className="px-4 py-2 bg-gray-700 rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </ClientOnly>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
