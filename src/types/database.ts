// Category mapping for display purposes
export const CategoryNames = {
  electronics: "Electronics",
  apparel: "Clothing",
  books: "Books",
  stationery: "Stationery",
  accessories: "Accessories",
  documents: "Documents",
  ids_cards: "IDs & Cards",
  keys: "Keys",
  other: "Other",
} as const;

// Create value arrays for runtime use
export const CategoryNamesValues = [
  "electronics",
  "apparel",
  "books",
  "stationery",
  "accessories",
  "documents",
  "ids_cards",
  "keys",
  "other",
] as const;

export type CategoryType = keyof typeof CategoryNames;

// Define both type and values for ItemStatus
export type ItemStatus = "lost" | "found" | "claimed" | "archived";
export const ItemStatusValues: ItemStatus[] = [
  "lost",
  "found",
  "claimed",
  "archived",
];

// Define both type and values for ClaimStatus
export type ClaimStatus = "pending" | "approved" | "rejected" | "retracted";
export const ClaimStatusValues: ClaimStatus[] = [
  "pending",
  "approved",
  "rejected",
  "retracted",
];

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category_id: number;
  category?: string; // For display purposes
  status: ItemStatus;
  location_description?: string | null;
  lat?: number;
  lng?: number;
  image_url?: string;
  image_urls?: string[];
  image_labels?: Record<string, unknown>;
  image_caption?: string;
  date_reported?: string | null;
  date_lost_or_found?: string;
  found_by_user_id?: string;
  is_urgent?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimer_id: string;
  claim_description: string;
  status: ClaimStatus;
  date_claimed: string;
  date_resolved?: string | null;
  resolved_by_user_id?: string | null;
  turn_in_to_security?: boolean; // New flag for campus security handover
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  mobile_number: string; // Encrypted
  physical_address: string; // Encrypted
  email: string; // Encrypted
}
