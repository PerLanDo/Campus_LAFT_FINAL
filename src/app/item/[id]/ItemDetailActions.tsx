"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Item } from "@/types/database";
import type { Profile } from "@/types/database";

interface UserClaim {
  id: string;
  status: string;
  claim_description: string;
}

interface ItemDetailActionsProps {
  item: Item;
  user: Profile | null; // user profile with full_name and email fields
  isOwner: boolean;
  itemUrl: string;
}

export default function ItemDetailActions({
  item,
  user,
  isOwner,
  itemUrl,
}: ItemDetailActionsProps) {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [turnInToSecurity, setTurnInToSecurity] = useState(false); // new flag
  const [claimError, setClaimError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [userClaim, setUserClaim] = useState<UserClaim | null>(null);
  const [pendingClaimsCount, setPendingClaimsCount] = useState<number>(0);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Fetch claims for this item/user on mount
  useEffect(() => {
    if (!user) return;
    const fetchClaims = async () => {
      // Fetch user's claim for this item
      const { data: userClaims } = await supabase
        .from("claims")
        .select("id, status, claim_description")
        .eq("item_id", item.id)
        .eq("claimer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setUserClaim(userClaims && userClaims.length > 0 ? userClaims[0] : null);
      // If owner, fetch all pending claims for this item
      if (isOwner) {
        const { count } = await supabase
          .from("claims")
          .select("id", { count: "exact", head: true })
          .eq("item_id", item.id)
          .eq("status", "pending");
        setPendingClaimsCount(count || 0);
      }
    };
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, item.id, isOwner]);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this item? This action cannot be undone."
      )
    )
      return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { error } = await supabase.from("items").delete().eq("id", item.id);
      if (error) throw error;
      router.push("/");
    } catch (err) {
      const error = err as Error;
      setDeleteError(error.message || "Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  const handleClaim = async () => {
    setClaimError("");
    setClaimSuccess(false);
    if (!claimText || claimText.length < 10) {
      setClaimError("Please provide a reason (at least 10 characters).");
      return;
    }
    if (!user) {
      setClaimError("You must be logged in to claim an item.");
      return;
    }
    // Prevent duplicate claims
    if (userClaim && ["pending", "approved"].includes(userClaim.status)) {
      setClaimError("You have already submitted a claim for this item.");
      return;
    }
    // Insert claim into Supabase
    const { data: inserted, error } = await supabase
      .from("claims")
      .insert({
        item_id: item.id,
        claimer_id: user.id,
        claim_description: claimText,
        turn_in_to_security: turnInToSecurity, // flag for security handover
      })
      .select();
    if (error) {
      setClaimError(error.message || "Failed to submit claim.");
    } else {
      // Create notification for item owner
      const insertedClaim = inserted && inserted[0];
      if (insertedClaim) {
        await supabase.from("notifications").insert({
          user_id: item.user_id,
          item_id: item.id,
          claim_id: insertedClaim.id,
          type: "new_claim",
          title: "New Claim Submitted",
          message: `${
            user?.full_name || "A user"
          } submitted a claim for your item: ${item.title}`,
        });
      }
      setClaimSuccess(true);
      setShowClaimModal(false);
      setClaimText("");
      // Refetch claim status
      const { data: userClaims } = await supabase
        .from("claims")
        .select("id, status, claim_description")
        .eq("item_id", item.id)
        .eq("claimer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setUserClaim(userClaims && userClaims.length > 0 ? userClaims[0] : null);
    }
  };

  return (
    <>
      {/* Enhanced QR Code Presentation */}
      <div className="mb-6 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg p-5 flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-3 flex items-center text-indigo-300">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
          QR Code
        </h2>
        <div className="bg-white p-3 rounded-lg shadow-inner">
          <QRCodeCanvas value={itemUrl} size={150} />
        </div>
        <p className="text-sm text-gray-400 mt-3 text-center">
          Scan to quickly access this item on any device
        </p>
      </div>

      {/* Notification for Pending Claims */}
      {isOwner && pendingClaimsCount > 0 && (
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-900 to-amber-800 border border-yellow-700 text-yellow-100 px-5 py-3 rounded-lg text-sm font-semibold shadow-lg">
            <svg
              className="w-5 h-5 text-yellow-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>New Claims: {pendingClaimsCount}</span>
          </div>
        </div>
      )}

      {/* Action Buttons with Enhanced Styling */}
      <div className="mt-6 flex flex-wrap gap-3 justify-end">
        {isOwner ? (
          <>
            <Link
              href={`/item/${item.id}/edit`}
              className="flex-grow sm:flex-grow-0"
            >
              <button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
            </Link>
            <button
              className="flex-grow sm:flex-grow-0 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              onClick={handleDelete}
              disabled={deleting}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {deleting ? "Deleting..." : "Delete"}
            </button>
            {deleteError && (
              <span className="w-full text-red-400 text-sm mt-2 bg-red-900 bg-opacity-30 p-2 rounded border border-red-700">
                {deleteError}
              </span>
            )}
          </>
        ) : (
          <>
            {userClaim ? (
              <div className="w-full bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
                  <h3 className="text-base font-semibold text-white mb-1">
                    Your Claim Status
                  </h3>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        userClaim.status === "pending"
                          ? "bg-yellow-400"
                          : userClaim.status === "approved"
                          ? "bg-green-400"
                          : "bg-red-400"
                      }`}
                    ></div>
                    <span
                      className={`font-medium ${
                        userClaim.status === "pending"
                          ? "text-yellow-300"
                          : userClaim.status === "approved"
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      {userClaim.status.charAt(0).toUpperCase() +
                        userClaim.status.slice(1)}
                    </span>
                  </div>
                  <blockquote className="bg-gray-900 rounded-lg p-3 text-gray-300 italic border-l-4 border-indigo-500 mb-3">
                    &quot;{userClaim.claim_description}&quot;
                  </blockquote>
                  {userClaim.status === "rejected" && (
                    <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900 bg-opacity-30 p-3 rounded-lg border border-red-800">
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span>
                        Your claim was rejected. You may contact the item owner
                        for more information.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                onClick={() => setShowClaimModal(true)}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Claim this item
              </button>
            )}

            {/* Enhanced Claim Modal */}
            {showClaimModal && (
              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full animate-fadeIn">
                  <div className="p-5 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <svg
                        className="w-6 h-6 text-indigo-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Claim this item
                    </h2>
                  </div>
                  <div className="p-5">
                    <textarea
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-indigo-500 transition mb-4"
                      rows={4}
                      placeholder="Why do you believe this is yours? Please provide specific details..."
                      value={claimText}
                      onChange={(e) => setClaimText(e.target.value)}
                    />
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={turnInToSecurity}
                        onChange={(e) => setTurnInToSecurity(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-gray-300 text-sm">
                        I will turn this item in to campus security
                      </span>
                    </label>
                    {claimError && (
                      <div className="flex items-center gap-2 text-red-300 bg-red-900 bg-opacity-30 p-3 rounded-lg border border-red-800 mb-4">
                        <svg
                          className="w-5 h-5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <span>{claimError}</span>
                      </div>
                    )}
                    {claimSuccess && (
                      <div className="flex items-center gap-2 text-green-300 bg-green-900 bg-opacity-30 p-3 rounded-lg border border-green-800 mb-4">
                        <svg
                          className="w-5 h-5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>Claim submitted successfully!</span>
                      </div>
                    )}
                    <p className="text-gray-400 text-sm mb-4">
                      Your claim will be reviewed by the item reporter. Please
                      provide accurate information.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        onClick={() => setShowClaimModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg transition-colors"
                        onClick={handleClaim}
                      >
                        Submit Claim
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
