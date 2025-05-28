"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // Ensure we handle potentially undefined email
          setUserName(user.email || null);

          // Fetch profile data
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, role")
            .eq("id", user.id)
            .single();

          if (error) {
            console.error("Error fetching profile:", error);
          } else if (profile) {
            setUserName(profile.full_name || user.email);
            setUserRole(profile.role || null);
            // Avatar URL fetching removed
          }
        }
      } catch (error) {
        console.error("Error in navbar:", error);
      } finally {
        setLoading(false);
      }
    }

    getUser();
  }, [supabase]);

  // If loading is true, show a simplified navbar
  if (loading) {
    return (
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">
            Campus LAFT
          </Link>
          <div className="space-x-4"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Campus LAFT
        </Link>
        <div className="space-x-4 flex items-center">
          {user && userRole === "admin" && (
            <Link href="/admin" className="hover:text-gray-300">
              Admin Dashboard
            </Link>
          )}
          <Link href="/" className="hover:text-gray-300">
            Home
          </Link>
          <Link
            href="/report"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Report Item
          </Link>
          {user && <NotificationBell userId={user?.id} />}
          {user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center hover:text-gray-300"
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-2 flex items-center justify-center">
                  <div className="text-white font-bold">
                    {userName?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "?"}
                  </div>
                </div>
                <span>{userName || "Profile"}</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/auth" className="hover:text-gray-300">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
