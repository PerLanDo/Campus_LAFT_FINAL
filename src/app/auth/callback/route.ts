// src/app/auth/callback/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    try {
      const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);
      
      if (session?.user) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          // Create profile with email as initial full_name
          const { error: insertError } = await supabase
            .from("profiles")
            .insert([
              {
                id: session.user.id,
                full_name: session.user.email?.split('@')[0] || null,
                email: session.user.email,
              },
            ]);

          if (insertError) {
            console.error("Profile creation error:", insertError);
          }
        }
      }

      return NextResponse.redirect(requestUrl.origin);
    } catch (error) {
      console.error("Auth error:", error);
      return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
}
