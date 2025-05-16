"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ClaimStatus, ItemStatus, Profile } from "@/types/database";
import { format } from "date-fns";

interface ClaimWithClaimerProfile {
  id: string;
  item_id: string;
  claimer_id: string;
  claim_description: string;
  status: ClaimStatus;
  date_claimed: string;
  date_resolved?: string | null;
  resolved_by_user_id?: string | null;
  claimer: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

interface ManageClaimsClientProps {
  itemId: string;
  itemStatus: ItemStatus;
  claims: ClaimWithClaimerProfile[];
  isOwner: boolean;
  currentUserId?: string;
}

export default function ManageClaimsClient({
  itemId,
  itemStatus: initialItemStatus,
  claims: initialClaims,
  isOwner,
  currentUserId,
}: ManageClaimsClientProps) {
  const supabase = createSupabaseBrowserClient();
  const [claims, setClaims] =
    useState<ClaimWithClaimerProfile[]>(initialClaims);
  const [itemStatus, setItemStatus] = useState<ItemStatus>(initialItemStatus);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const pendingCount = claims.filter(
    (c) => c.status === 'pending'
  ).length;

  const handleClaimAction = async (
    claimId: string,
    action: "approve" | "reject"
  ) => {
    if (!currentUserId || !isOwner) return;
    if (itemStatus === 'claimed' && action === "approve") {
      setError("This item has already been marked as claimed.");
      return;
    }

    setIsLoading((prev) => ({ ...prev, [claimId]: true }));
    setError(null);

    const newClaimStatus =
      action === "approve" ? 'approved' : 'rejected';

    // Update claim
    const { error: claimUpdateError } = await supabase
      .from("claims")
      .update({
        status: newClaimStatus,
        date_resolved: new Date().toISOString(),
        resolved_by_user_id: currentUserId,
      })
      .eq("id", claimId);

    if (claimUpdateError) {
      setError(`Failed to ${action} claim: ${claimUpdateError.message}`);
      setIsLoading((prev) => ({ ...prev, [claimId]: false }));
      return;
    }

    // Create notification for claimer
    const claim = claims.find((c) => c.id === claimId);
    if (claim) {
      // Fetch item title for message (if not already available)
      let itemTitle = "";
      try {
        const { data: itemData } = await supabase
          .from("items")
          .select("title")
          .eq("id", itemId)
          .single();
        itemTitle = itemData?.title || "";
      } catch {}
      await supabase.from("notifications").insert({
        user_id: claim.claimer_id,
        item_id: itemId,
        claim_id: claim.id,
        type: "claim_update",
        title: `Your claim was ${
          action === "approve" ? "approved" : "rejected"
        }`,
        message: `Your claim for item "${itemTitle}" was ${
          action === "approve" ? "approved" : "rejected"
        }.`,
      });
    }

    // If approved, update item status to 'claimed' and reject other pending claims
    if (action === "approve") {
      const { error: itemUpdateError } = await supabase
        .from("items")
        .update({ status: 'claimed' })
        .eq("id", itemId);

      if (itemUpdateError) {
        setError(`Failed to update item status: ${itemUpdateError.message}`);
      } else {
        setItemStatus('claimed');
        // Reject other pending claims
        const otherPendingClaims = claims.filter(
          (c) => c.id !== claimId && c.status === 'pending'
        );
        for (const otherClaim of otherPendingClaims) {
          await supabase
            .from("claims")
            .update({
              status: 'rejected',
              date_resolved: new Date().toISOString(),
              resolved_by_user_id: currentUserId,
            })
            .eq("id", otherClaim.id);
        }
      }
    }

    // Refresh claims data locally
    setClaims((prevClaims) =>
      prevClaims.map((c) =>
        c.id === claimId
          ? {
              ...c,
              status: newClaimStatus,
              date_resolved: new Date().toISOString(),
            }
          : action === "approve" && c.status === 'pending'
          ? {
              ...c,
              status: 'rejected',
              date_resolved: new Date().toISOString(),
            }
          : c
      )
    );

    setIsLoading((prev) => ({ ...prev, [claimId]: false }));
  };


  const getStatusProps = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          colorClass:
            "bg-yellow-100 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700",
          accentClass: "bg-yellow-400",
          icon: "⏳",
        };
      case 'approved':
        return {
          colorClass:
            "bg-green-50 border-green-400 text-green-900 dark:bg-green-900 dark:text-green-100 dark:border-green-700",
          accentClass: "bg-green-400",
          icon: "✅",
        };
      case 'rejected':
      default:
        return {
          colorClass:
            "bg-red-50 border-red-400 text-red-900 dark:bg-red-900 dark:text-red-100 dark:border-red-700",
          accentClass: "bg-red-400",
          icon: "❌",
        };
    }
  };

  // Case 1: Non-owner, and (there are claims OR item is finalized) -> show nothing from this component for claim list
  if (!isOwner && (claims.length > 0 || itemStatus === 'claimed' || itemStatus === 'archived')) {
    return null;
  }

  // Case 2: Item is LOST or FOUND, and no claims yet (message visible to owner & non-owner)
  if ((itemStatus === 'lost' || itemStatus === 'found') && claims.length === 0) {
    return (
      <div className="text-center py-4 text-gray-600 dark:text-gray-400">
        <p className="italic">No claims have been submitted for this item yet.</p>
        {!isOwner && currentUserId && ( // Logged-in non-owner
          <p className="text-sm mt-1">
            If this item belongs to you, you can submit a claim using the actions above.
          </p>
        )}
         {isOwner && ( // Owner
           <p className="text-sm mt-1">
            You will be notified when a new claim is submitted.
          </p>
        )}
      </div>
    );
  }

  // Case 3: Owner, item is CLAIMED or ARCHIVED, and no claims exist (e.g. direct status update without formal claim)
  if (isOwner && (itemStatus === 'claimed' || itemStatus === 'archived') && claims.length === 0) {
     return (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">
          <p>This item has been marked as {itemStatus.toLowerCase()} and has no associated claim history to display.</p>
        </div>
      );
  }

  // Case 4: Owner, and there are claims to display (accordion)
  // This implies isOwner && claims.length > 0 because prior conditions would have returned null or a message.
  // The accordion should only show if isOwner is true and claims exist.
  if (!isOwner || claims.length === 0) {
    // This condition should ideally not be met if the above logic is correct, 
    // but as a safeguard, prevent rendering the accordion if not owner or no claims.
    return null;
  }

  return (
    <section className="mt-10 flex justify-center">
      <div className="w-full max-w-2xl">
        {/* Enhanced Claims Management Accordion Header */}
        <button
          className={`w-full flex items-center justify-between px-6 py-4 rounded-xl shadow-lg bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 border border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300`}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-3 text-xl font-bold text-white">
            <svg
              className="w-6 h-6 text-indigo-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Claims Management
          </span>
          {pendingCount > 0 && (
            <span className="ml-2 bg-yellow-100 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold border-2 border-yellow-500 flex items-center gap-1">
              <span className="text-yellow-600 text-base">⚠️</span>
              {pendingCount} Pending
            </span>
          )}
          <svg
            className={`w-6 h-6 ml-4 transition-transform duration-300 text-indigo-300 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Claims Content (Expanded) */}
        <div
          className={`transition-all duration-500 overflow-hidden ${
            expanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-gray-800 border-x border-b border-indigo-900 rounded-b-xl p-6 shadow-lg">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 mb-6 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 text-red-300">
                <svg
                  className="w-6 h-6 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Status Message */}
            {itemStatus === 'claimed' && (
              <div className="flex items-center gap-3 mb-6 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg px-4 py-3">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium text-green-300">
                  Item marked as claimed
                </span>
              </div>
            )}

            {/* Claims List */}
            <div className="space-y-8">
              {claims.map((claim) => {
                const statusProps = getStatusProps(claim.status);
                return (
                  <div
                    key={claim.id}
                    className="bg-gray-900 rounded-xl border border-gray-700 shadow-lg overflow-hidden relative"
                  >
                    {/* Status Accent Bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusProps.accentClass}`}
                      aria-hidden
                    />

                    <div className="p-5 flex flex-col md:flex-row gap-5">
                      {/* User Info */}
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-indigo-900 border-4 border-indigo-700 flex items-center justify-center mb-2 overflow-hidden">
                          {claim.claimer?.avatar_url ? (
                            <img
                              src={claim.claimer.avatar_url}
                              alt={claim.claimer.full_name || "User"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-indigo-300">
                              {claim.claimer?.full_name
                                ? claim.claimer.full_name[0].toUpperCase()
                                : "?"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 text-center truncate max-w-[5rem]">
                          {claim.claimer?.full_name || "Unknown"}
                        </span>
                      </div>

                      {/* Claim Info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap justify-between items-center mb-3">
                          <div>
                            <span className="font-semibold text-gray-200">
                              Claim by:{" "}
                            </span>
                            <span className="text-indigo-400 font-medium">
                              {claim.claimer?.full_name || "Unknown User"}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              (ID: ...{claim.claimer_id.slice(-6)})
                            </span>
                          </div>
                          <span
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-bold rounded-full border-2 ${statusProps.colorClass}`}
                          >
                            <span className="text-base">
                              {statusProps.icon}
                            </span>
                            {claim.status.charAt(0).toUpperCase() +
                              claim.status.slice(1)}
                          </span>
                        </div>

                        <blockquote className="bg-gray-800 rounded-lg p-4 my-3 italic text-gray-300 border-l-4 border-indigo-500">
                          &ldquo;{claim.claim_description}&rdquo;
                        </blockquote>

                        <div className="flex flex-wrap gap-6 text-xs text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-indigo-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            Claimed:{" "}
                            {format(new Date(claim.date_claimed), "PPpp")}
                          </span>
                          {claim.date_resolved && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4 text-indigo-400"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Resolved:{" "}
                              {format(new Date(claim.date_resolved), "PPpp")}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {isOwner &&
                          claim.status === 'pending' &&
                          itemStatus !== 'claimed' && (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                onClick={() =>
                                  handleClaimAction(claim.id, "approve")
                                }
                                disabled={isLoading[claim.id]}
                                className="relative px-5 py-2.5 text-base font-semibold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center gap-2 transition-all duration-200"
                              >
                                {isLoading[claim.id] ? (
                                  <span className="inline-block w-5 h-5 border-2 border-white border-t-green-300 rounded-full animate-spin"></span>
                                ) : (
                                  <>
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    Approve
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  handleClaimAction(claim.id, "reject")
                                }
                                disabled={isLoading[claim.id]}
                                className="relative px-5 py-2.5 text-base font-semibold bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2 transition-all duration-200"
                              >
                                {isLoading[claim.id] ? (
                                  <span className="inline-block w-5 h-5 border-2 border-white border-t-red-300 rounded-full animate-spin"></span>
                                ) : (
                                  <>
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                    Reject
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {claims.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <svg
                    className="w-16 h-16 text-gray-600 mb-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-300 mb-1">
                    No claims yet
                  </h3>
                  <p className="text-gray-500 max-w-sm">
                    When someone submits a claim for this item, it will appear
                    here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
