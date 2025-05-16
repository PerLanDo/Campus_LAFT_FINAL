'use client';
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function NotificationBell({ userId }: { userId?: string }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setUnread(count || 0);
    };
    fetchUnread();
  }, [userId]);
  return (
    <button
      className="relative hover:text-indigo-400 focus:outline-none"
      onClick={() => router.push('/notifications')}
      aria-label="Notifications"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold animate-pulse">
          {unread}
        </span>
      )}
    </button>
  );
} 