import { notFound } from "next/navigation";
import ImageGallery from "@/components/ImageGallery"; // Import the new ImageGallery component
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { SupabaseClient } from "@supabase/supabase-js";
import { Item, CategoryNames, ClaimWithClaimerProfile, Profile } from "@/types/database";
import type { ItemStatus } from "@/types/database";
import { format } from "date-fns";
import ItemDetailActions from "./ItemDetailActions";
import { UserCircleIcon, MapPinIcon, CalendarDaysIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import ManageClaimsClient from "@/components/ManageClaimsClient";

// Explicitly type the 'user' property that is added to 'Item' by the join
interface ItemWithUser extends Item {
  user: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

interface ItemDetailPageProps {
  params: { id: string };
}

const getCategoryName = (category?: string) => {
  if (!category) return "Unknown";

  // Use CategoryNames mapping
  return (
    CategoryNames[category as keyof typeof CategoryNames] ||
    category.charAt(0).toUpperCase() + category.slice(1).replace("_", " ")
  );
};

async function getItemData(itemId: string, supabase: SupabaseClient) {
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("*, user:profiles!user_id(id, full_name, avatar_url)")
    .eq("id", itemId)
    .single();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error("Item not found");
  // Try to fetch claims with join, fallback to simple select if error
  let claims = [],
    claimsError = null; // First try to fetch claims with joined profile data for claimer
  const result = await supabase
    .from("claims")
    .select(
      `
      *,
      claimer:profiles!claimer_id(id, full_name, avatar_url),
      resolver:profiles!resolved_by_user_id(id, full_name, avatar_url)
    `
    )
    .eq("item_id", itemId)
    .order("date_claimed", { ascending: false });

  if (result.error) {
    console.error("Error fetching claims with join:", result.error.message);

    // Fallback: fetch claims without join
    const fallback = await supabase
      .from("claims")
      .select("*")
      .eq("item_id", itemId)
      .order("date_claimed", { ascending: false });

    claims = fallback.data || [];
    claimsError = fallback.error;
  } else {
    claims = result.data || [];
    claimsError = null;
  }

  return { item, claims: claims || [], claimsError };
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let item: ItemWithUser, claims: ClaimWithClaimerProfile[], claimsError;
  try {
    const result = await getItemData(params.id, supabase);
    item = result.item as ItemWithUser;
    claims = result.claims as ClaimWithClaimerProfile[];
    claimsError = result.claimsError;
  } catch (error: unknown) {
    console.error("Error fetching item data:", error);
    return notFound();
  }

  const isOwner = !!user && user.id === item.user_id;
  const itemUrl = `${
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  }/item/${item.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200 group"
          >
            <svg
              className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Back to Browse</span>
          </Link>
        </nav>

        {/* Main Content Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/30 overflow-hidden">
          <div className="lg:grid lg:grid-cols-12 lg:gap-0">
            {/* --- LEFT COLUMN: IMAGE --- */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-24 p-6 lg:p-8">
                <div className="relative rounded-xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-700">
                  <ImageGallery
                    primaryImage={item.image_url}
                    images={item.image_urls || []}
                    itemTitle={item.title}
                  />
                  {/* Status overlay - improved styling */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full shadow-md ${
                        item.status === "lost"
                          ? "bg-red-100 text-red-700 border border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-500"
                          : item.status === "found"
                          ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-500"
                          : "bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-500"
                      }`}
                    >
                      {item.status.charAt(0).toUpperCase() +
                        item.status.slice(1)}
                    </span>
                    {item.is_urgent && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-700 border border-pink-300 rounded-full text-xs font-semibold shadow-md dark:bg-pink-700/30 dark:text-pink-300 dark:border-pink-500 animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M11.983 1.907a.75.75 0 00-1.966 0l-4.25 7.65a.75.75 0 00.642 1.193h2.373a.75.75 0 01.723.526l-.776 5.436a.75.75 0 001.45.208l4.25-7.65a.75.75 0 00-.642-1.193h-2.373a.75.75 0 01-.723-.526l.776-5.436z" /></svg>
                        Urgent
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- RIGHT COLUMN: DETAILS, ACTIONS, CLAIMS --- */}
            {/* --- RIGHT COLUMN: DETAILS, ACTIONS, CLAIMS --- */}
            <div className="lg:col-span-7 p-6 lg:p-8 lg:pl-0 space-y-8">
              {/* Header Section */}
              <section aria-labelledby="item-header-title" className="mb-8">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                  {item.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="px-4 py-2 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-200 dark:border-indigo-700">
                    {getCategoryName(item.category)}
                  </span>
                  {item.turn_in_to_security && (
                    <span className="px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-sm font-semibold border border-blue-200 dark:border-blue-700 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.5-2a9.5 9.5 0 11-19 0 9.5 9.5 0 0119 0z"
                        />
                      </svg>
                      Secured by Campus Security
                    </span>
                  )}
                </div>
              </section>

              {/* Details Section Card */}
              <section aria-labelledby="item-details-heading" className="bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700/50">
                <h2 id="item-details-heading" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Item Details</h2>
                
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
                  {/* Location */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPinIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Location
                      </h3>
                    </div>
                    <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      {item.location_description || "Not specified"}
                    </p>
                  </div>

                  {/* Date Lost/Found */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDaysIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {item.status === "lost" ? "Date Lost" : "Date Found"}
                      </h3>
                    </div>
                    <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      {item.date_lost_or_found
                        ? format(new Date(item.date_lost_or_found), "PPP")
                        : "Not specified"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Description Section */}
              <div className="mb-8">
                <div className="bg-gradient-to-r from-gray-50 to-indigo-50/50 dark:from-gray-700/50 dark:to-indigo-900/20 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3 mb-4">
                    <svg
                      className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Description
                    </h3>
                  </div>
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {item.description || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <section aria-labelledby="item-actions-heading">
                {/* ItemDetailActions will handle its own heading if needed */}
                <ItemDetailActions item={item} user={user} isOwner={isOwner} itemUrl={itemUrl} />
              </section>

              {/* Reported By Section (if not owner and item has a poster) */}
              {!isOwner && item.user && (
                <section aria-labelledby="item-poster-heading" className="bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700/50">
                  <h2 id="item-poster-heading" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                    {item.status === 'lost' ? 'Reported by' : 'Found by'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      {item.user.avatar_url ? (
                        <img src={item.user.avatar_url} alt={item.user.full_name || 'Poster avatar'} className="object-cover w-full h-full" />
                      ) : (
                        <UserCircleIcon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                        {item.user.full_name || 'Campus User'}
                      </p>
                      {/* Optionally, add a 'Contact Poster' button here if messaging is implemented */}
                    </div>
                  </div>
                </section>
              )}

              {/* Claims Section (for owner) */}
              {isOwner && (
                <section aria-labelledby="manage-claims-heading" className="bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700/50">
                  {/* ManageClaimsClient likely has its own H2, or you can add one here */}
                  <ManageClaimsClient
                    itemId={item.id}
                    claims={claims} /* Corrected prop name */
                    itemStatus={item.status as ItemStatus}
                    isOwner={isOwner} /* Added missing prop */
                    currentUserId={user?.id} /* Added missing prop */
                  />
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
