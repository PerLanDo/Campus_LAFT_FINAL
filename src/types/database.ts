// Category mapping for display purposes
export const CategoryNames = {
  'electronics': 'Electronics',
  'apparel': 'Clothing',
  'books': 'Books',
  'stationery': 'Stationery',
  'accessories': 'Accessories',
  'documents': 'Documents',
  'ids_cards': 'IDs & Cards',
  'keys': 'Keys',
  'other': 'Other'
} as const;

export type CategoryType = keyof typeof CategoryNames;

export enum ItemStatus {
  LOST = 'lost',
  FOUND = 'found',
  CLAIMED = 'claimed',
  ARCHIVED = 'archived'
}

export enum ClaimStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETRACTED = 'retracted',
}

export interface Item {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  category_id: number;
  category?: string; // For display purposes
  status: ItemStatus | string;
  location_description?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  image_urls?: string[];
  image_labels?: any;
  image_caption?: string;
  date_reported?: string;
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
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  mobile_number: string | null;
  physical_address: string | null;
}