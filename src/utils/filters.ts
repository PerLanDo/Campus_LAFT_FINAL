import { Item } from "@/types/database";
import { FilterState } from "@/components/FilterControls";

// Allow extended Item types
export type ExtendedItem = Item & Record<string, unknown>;

export function applyFilters(
  items: ExtendedItem[],
  filters: FilterState
): ExtendedItem[] {
  console.log("Filter function called with:", {
    itemCount: items.length,
    filters,
  });

  if (!items || !Array.isArray(items)) {
    console.error("Invalid items array:", items);
    return [];
  }

  return items.filter((item) => {
    try {
      // Debug item
      console.log("Processing item:", {
        id: item.id,
        category: item.category,
        status: item.status,
        date: item.date_reported || item.created_at,
      });

      // Category filter
      if (filters.category.length > 0) {
        // For debugging
        console.log("Item category:", item.category);
        console.log("Selected categories:", filters.category);

        // Simple string comparison for now
        const categoryMatches = filters.category.some((cat) => {
          if (typeof item.category === "string") {
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
        // Special handling for 'secured' status
        const wantsSecured = filters.status.some(
          (status) => status.toLowerCase() === 'secured'
        );
        const otherStatuses = filters.status.filter(
          (status) => status.toLowerCase() !== 'secured'
        );

        let statusMatches = false;
        // If 'secured' is selected, include items turned in to security
        if (wantsSecured && item.turn_in_to_security) {
          statusMatches = true;
        }
        // If any other status is selected, match item.status
        if (
          otherStatuses.length > 0 &&
          otherStatuses.some(
            (status) => item.status?.toLowerCase() === status.toLowerCase()
          )
        ) {
          statusMatches = true;
        }
        if (!statusMatches) {
          return false;
        }
      }

      // Date range filter - start date
      if (filters.dateRange.start) {
        try {
          const dateStr = item.date_reported || item.created_at || "";
          const itemDate = new Date(dateStr);

          if (isNaN(itemDate.getTime())) {
            console.warn("Invalid date:", dateStr);
          } else if (itemDate < filters.dateRange.start) {
            return false;
          }
        } catch (err) {
          console.error("Date comparison error (start):", err);
        }
      }

      // Date range filter - end date
      if (filters.dateRange.end) {
        try {
          const dateStr = item.date_reported || item.created_at || "";
          const itemDate = new Date(dateStr);

          if (isNaN(itemDate.getTime())) {
            console.warn("Invalid date:", dateStr);
          } else if (itemDate > filters.dateRange.end) {
            return false;
          }
        } catch (err) {
          console.error("Date comparison error (end):", err);
        }
      }

      return true;
    } catch (err) {
      console.error("Error filtering item:", err, item);
      return false;
    }
  });
}

export function applySearch(
  items: ExtendedItem[],
  searchTerm: string
): ExtendedItem[] {
  if (!searchTerm || searchTerm.trim() === "") {
    return items;
  }

  const term = searchTerm.toLowerCase().trim();

  return items.filter((item) => {
    return (
      (item.title && item.title.toLowerCase().includes(term)) ||
      (item.description && item.description.toLowerCase().includes(term)) ||
      (item.location_description &&
        item.location_description.toLowerCase().includes(term)) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  });
}
