import { notFound } from "next/navigation";
import ImageGallery from "@/components/ImageGallery"; // Import the new ImageGallery component
import Image from "next/image";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Item, ItemStatus, Claim, Profile, ClaimStatus, CategoryNames } from "@/types/database";
import { format } from "date-fns";
import ItemDetailActions from "./ItemDetailActions";
import ManageClaimsClient from "@/components/ManageClaimsClient";

interface ItemDetailPageProps {
  params: { id: string };
}

const getCategoryName = (category?: string) => {
  if (!category) return 'Unknown';
  
  // Use CategoryNames mapping
  return CategoryNames[category as keyof typeof CategoryNames] || category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
};

interface ClaimWithClaimerProfile extends Claim {
  claimer: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

async function getItemData(itemId: string, supabase: any) {
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error('Item not found');

  // Try to fetch claims with join, fallback to simple select if error
  let claims, claimsError;
  try {
    const result = await supabase
      .from('claims')
      .select(`*, claimer:profiles (id, full_name, avatar_url)`)
      .eq('item_id', itemId)
      .order('date_claimed', { ascending: false });
    claims = result.data;
    claimsError = result.error;
    if (claimsError) throw claimsError;
  } catch (e) {
    // fallback: fetch claims without join
    const fallback = await supabase
      .from('claims')
      .select('*')
      .eq('item_id', itemId)
      .order('date_claimed', { ascending: false });
    claims = fallback.data;
    claimsError = fallback.error;
  }

  return { item, claims: (claims || []), claimsError };
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let item: Item, claims: ClaimWithClaimerProfile[], claimsError;
  try {
    const result = await getItemData(params.id, supabase);
    item = result.item as Item;
    claims = result.claims as ClaimWithClaimerProfile[];
    claimsError = result.claimsError;
  } catch (error: any) {
    console.error("Error fetching item data:", error);
    return notFound();
  }

  const isOwner = !!user && user.id === item.user_id;
  const itemUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/item/${item.id}`;

  return (
    <div className="max-w-5xl mx-auto p-4 min-h-screen">
      <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline mb-6 inline-block text-sm font-medium">
        <span aria-hidden="true">←</span> Back to List
      </Link>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 md:p-8">
        <div className="md:grid md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
          {/* --- LEFT COLUMN: IMAGE --- */}
          <div className="md:col-span-5 lg:col-span-4 mb-6 md:mb-0">
            <div className="md:sticky md:top-24">
              <ImageGallery
                primaryImage={item.image_url}
                images={item.image_urls || []}
                itemTitle={item.title}
              />
            </div>
          </div>

          {/* --- RIGHT COLUMN: DETAILS, ACTIONS, CLAIMS --- */}
          <div className="md:col-span-7 lg:col-span-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">{item.title}</h1>
            
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${ 
                  item.status === ItemStatus.LOST
                    ? "bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100"
                    : item.status === ItemStatus.FOUND
                    ? "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100"
                }`}
              >
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </span>
              {item.is_urgent && (
                <span className="px-3 py-1 bg-pink-100 text-pink-800 dark:bg-pink-700 dark:text-pink-100 rounded-full text-xs font-semibold">
                  Urgent
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
              <p><strong className="font-medium text-gray-800 dark:text-gray-100">Category:</strong> {getCategoryName(item.category)}</p>
              <p><strong className="font-medium text-gray-800 dark:text-gray-100">Location:</strong> {item.location_description}</p>
              <p><strong className="font-medium text-gray-800 dark:text-gray-100">Date Reported:</strong> {item.date_lost_or_found ? format(new Date(item.date_lost_or_found), "MMMM d, yyyy 'at' h:mm a") : 'N/A'}</p>
            </div>
            
            <div className="prose prose-sm dark:prose-invert max-w-none mb-8 text-gray-700 dark:text-gray-300">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Description:</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
            
            <ItemDetailActions item={item} user={user} isOwner={isOwner} itemUrl={itemUrl} />

            <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Claims Management</h2>
              {claimsError ? (
                <p className="text-red-500">Error loading claims: {claimsError.message}</p>
              ) : (
                <ManageClaimsClient
                  itemId={item.id}
                  itemStatus={item.status as ItemStatus}
                  claims={claims}
                  isOwner={isOwner}
                  currentUserId={user?.id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 