"use client";

// src/components/Navbar.tsx
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  useEffect(() => {
    let subscription: any;
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
            setAvatarUrl(profile.avatar_url || null);
          }
        } else {
          setUserName(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error in navbar:", error);
      } finally {
        setLoading(false);
      }
    }

    getUser();

    // Listen for auth state changes
    subscription = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      getUser();
    }).data.subscription;

    return () => {
      if (subscription) subscription.unsubscribe();
    };
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
            <Link href="/admin" className={`hover:text-gray-300 ${pathname === '/admin' ? 'text-indigo-400 font-semibold' : ''}`}>
              Admin Dashboard
            </Link>
          )}
          <Link href="/" className={`hover:text-gray-300 ${pathname === '/' ? 'text-indigo-400 font-semibold' : ''}`}>
            Home
          </Link>
          <Link
            href="/report"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Report Item
          </Link>{" "}
          {user && <NotificationBell userId={user?.id} />}
          {user && (
            <Link
              href="/messages"
              className={`hover:text-gray-300 font-semibold ${pathname === '/messages' ? 'text-indigo-400' : ''}`}
            >
              Messages
            </Link>
          )}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white rounded-md"
                aria-label="Open user menu"
                aria-expanded={isProfileDropdownOpen}
                aria-haspopup="true"
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-600 mr-2 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="object-cover w-8 h-8" />
                  ) : (
                    <div className="text-white font-bold">
                      {userName?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() ||
                        "?"}
                    </div>
                  )}
                </div>
                <span>{userName || "User Menu"}</span>
                <svg className={`w-4 h-4 ml-1 transition-transform duration-200 ${isProfileDropdownOpen ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
              </button>

              {isProfileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button" // Consider adding id="user-menu-button" to the button above
                >
                  <Link
                    href="/profile"
                    className={`block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 ${pathname === '/profile' ? 'bg-gray-100 dark:bg-gray-600 font-semibold' : ''}`}
                    role="menuitem"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  {/* You can add more items like 'My Items' or 'Settings' here */}
                  <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div> {/* Separator */}
                  <div className="px-4 py-2 w-full">
                     <LogoutButton /> {/* Assuming LogoutButton is styled appropriately or takes full width */}
                  </div>
                </div>
              )}
            </div>
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
