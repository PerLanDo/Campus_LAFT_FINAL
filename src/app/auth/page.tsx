// src/app/auth/page.tsx
"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [authView, setAuthView] = useState<"sign_in" | "sign_up">("sign_in");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Check if user has completed their profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        if (!profile?.full_name) {
          router.push("/profile/complete");
        } else {
          router.push("/");
        }
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Welcome to Campus LAFT
        </h2>
        <div className="flex justify-center space-x-4 mb-4">
          <button
            onClick={() => setAuthView("sign_in")}
            className={`px-4 py-2 ${
              authView === "sign_in"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-white"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthView("sign_up")}
            className={`px-4 py-2 ${
              authView === "sign_up"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-white"
            }`}
          >
            Sign Up
          </button>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={["google"]}
          redirectTo={`${
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          }/auth/callback`}
          view={authView}
        />
      </div>
    </div>
  );
}
