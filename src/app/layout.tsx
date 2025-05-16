// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SupabaseListener from "../components/supabase-listener";
import Navbar from "../components/Navbar";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Campus LAFT",
  description: "Track lost and found items on campus.",
};

export const revalidate = 0;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the session for the SupabaseListener
  const supabase = createServerComponentClient({ cookies });
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Pass the session token to the listener */}
        <SupabaseListener serverAccessToken={session?.access_token} />
        {/* Navbar is now a client component, no props needed */}
        <Navbar />
        <main className="min-h-screen bg-background text-foreground p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
