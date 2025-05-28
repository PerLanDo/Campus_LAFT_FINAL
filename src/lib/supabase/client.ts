// src/lib/supabase/client.ts
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

// Enhance error handling for Supabase client
export const createSupabaseBrowserClient = () => {
  try {
    return createPagesBrowserClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    throw new Error("Supabase client initialization failed.");
  }
};
