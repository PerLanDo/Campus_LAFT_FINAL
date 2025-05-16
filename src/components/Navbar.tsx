"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LogoutButton from "./LogoutButton";
import NotificationBell from './NotificationBell';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  // const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Avatar feature removed
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user) {
          // Ensure we handle potentially undefined email
          setUserName(user.email || null);
          
          // Fetch profile data
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .single();
            
          if (error) {
            console.error("Error fetching profile:", error);
          } else if (profile) {
            setUserName(profile.full_name || user.email);
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
          <Link href="/" className="hover:text-gray-300">
            Home
          </Link>
          <Link href="/report" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200">
            Report Item
          </Link>
          {user && <NotificationBell userId={user?.id} />}
          {user ? (
            <>
              <Link href="/profile" className="flex items-center hover:text-gray-300">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-2 flex items-center justify-center">
                  <div className="text-white font-bold">
                    {userName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
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
