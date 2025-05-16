'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to view notifications.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setNotifications(data || []);
      }
      setLoading(false);
    };
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications => notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Notifications</h1>
      {loading && <div className="text-center">Loading...</div>}
      {error && <div className="text-center text-red-500">{error}</div>}
      {!loading && notifications.length === 0 && (
        <div className="text-center text-gray-500">No notifications yet.</div>
      )}
      <div className="space-y-4">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`p-4 rounded-lg shadow border flex flex-col gap-2 transition bg-white dark:bg-gray-800 ${n.is_read ? 'opacity-70' : 'bg-indigo-50 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${n.is_read ? 'bg-gray-400' : 'bg-indigo-500 animate-pulse'}`}></span>
              <span className="font-semibold text-lg">{n.title}</span>
              <span className="ml-auto text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="text-gray-700 dark:text-gray-200">{n.message}</div>
            <div className="flex gap-3 mt-2">
              {n.item_id && (
                <Link href={`/item/${n.item_id}`} className="text-indigo-600 hover:underline text-sm">View Item</Link>
              )}
              {n.claim_id && (
                <Link href={`/item/${n.item_id}`} className="text-indigo-600 hover:underline text-sm">View Claim</Link>
              )}
              {!n.is_read && (
                <button
                  className="ml-auto px-3 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded"
                  onClick={() => markAsRead(n.id)}
                >
                  Mark as read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 