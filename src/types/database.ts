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
  turn_in_to_security?: boolean; // Indicates item turned into campus security
  created_at?: string;
  updated_at?: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimer_id: string; // User ID of the person making the claim
  claim_description: string; // Justification or description provided by the claimer
  status: ClaimStatus;
  date_claimed: string; // When the claim was made

  // Fields related to claim adjudication by an admin
  adjudication_note?: string | null; // Note by the admin during approval/rejection
  adjudicated_by?: string | null; // User ID of the admin who adjudicated
  date_adjudicated?: string | null; // When the claim was adjudicated

  // Optional fields from the original definition, potentially for different flows or item resolution
  date_resolved?: string | null; 
  resolved_by_user_id?: string | null;

  turn_in_to_security?: boolean; // Flag for campus security handover

  // --- Joined data from Supabase query, e.g., claims.select("*, items(*), profiles(*)") ---
  items?: Item | null;       // The full Item object related to this claim
  profiles?: Profile | null; // The full Profile object of the claimer (claimer_id)
}

// Extended claim with claimer profile
export interface ClaimWithClaimerProfile extends Claim {
  claimer: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  mobile_number: string; // Encrypted
  physical_address: string; // Encrypted
  email: string; // Encrypted
}

// Chat conversation
export interface Conversation {
  id: string;
  item_id: string;
  type: "user-to-poster" | "user-to-security";
  creator_id: string;
  created_at: string;
}

// Chat message
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: Array<{ path: string; url: string }>;
  created_at: string;
}
