// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { ClaimStatus } from "@/types/database";

interface AdminClaim {
  id: string;
  item_id: string;
  claimer_id: string;
  claim_description: string;
  status: ClaimStatus;
  turn_in_to_security: boolean;
  date_claimed: string;
  claimer: Array<{ id: string; full_name: string; avatar_url: string | null }>;
  item: Array<{ id: string; title: string }>;
}

export default function AdminPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);

  // Client-side auth and role check
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profileError || !profile || profile.role !== "admin") {
        router.push("/");
      } else {
        setRoleChecked(true);
      }
    }
    checkAuth();
  }, [router, supabase]);

  // Fetch pending claims after role verified
  useEffect(() => {
    if (!roleChecked) return;
    async function fetchClaims() {
      try {
        const { data, error } = await supabase
          .from("claims")
          .select(
            "id, item_id, claimer_id, claim_description, status, turn_in_to_security, date_claimed, claimer:claimer_id(id,full_name,avatar_url), item:item_id(id,title)"
          )
          .eq("status", "pending")
          .order("date_claimed", { ascending: false });
        if (error) throw error;
        setClaims(data as AdminClaim[]);
      } catch (err) {
        console.error(err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, [roleChecked, supabase]);

  const handleAction = async (
    claimId: string,
    action: "approve" | "reject"
  ) => {
    try {
      // Update claim status
      await supabase
        .from("claims")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          date_resolved: new Date().toISOString(),
        })
        .eq("id", claimId);
      // If approved, update item status
      if (action === "approve") {
        const claim = claims.find((c) => c.id === claimId);
        if (claim) {
          await supabase
            .from("items")
            .update({ status: "claimed" })
            .eq("id", claim.item_id);
        }
      }
      // Refresh list
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (error) {
      console.error(error);
      setError((error as Error).message);
    }
  };

  if (!roleChecked || loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      {claims.length === 0 ? (
        <p>No pending claims</p>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => {
            const profile = c.claimer[0];
            const itemInfo = c.item[0];
            return (
              <div key={c.id} className="p-4 bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold">{itemInfo?.title}</h2>
                  {c.turn_in_to_security && (
                    <span className="px-2 py-1 bg-blue-600 text-white rounded-full text-xs">
                      🛡️ Turn-In
                    </span>
                  )}
                </div>
                <p className="italic mb-2">“{c.claim_description}”</p>
                <p className="text-sm mb-4">
                  Claimed by: {profile?.full_name || profile?.id}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(c.id, "approve")}
                    className="px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(c.id, "reject")}
                    className="px-4 py-2 bg-red-600 text-white rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
