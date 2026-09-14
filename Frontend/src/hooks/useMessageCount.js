import { useState, useEffect } from 'react';
import { getUnreadConversationsCount, getConversations } from '../services/api';

const POLL_INTERVAL_MS = 15000;

/**
 * Returns total count of "messages to look at": unread chats + pending message requests.
 * Used for the Messages badge in the sidebar so users see when they have new messages.
 */
export function useMessageCount() {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    let unread = 0;
    let pending = 0;
    try {
      const res = await getUnreadConversationsCount();
      unread = res?.count ?? 0;
    } catch (_) {}
    try {
      const res = await getConversations('pending');
      pending = Array.isArray(res?.conversations) ? res.conversations.length : 0;
    } catch (_) {}
    setCount(unread + pending);
  };

  useEffect(() => {
    let cancelled = false;
    fetchCount();
    const interval = setInterval(() => {
      if (!cancelled) fetchCount();
    }, POLL_INTERVAL_MS);
    const onMessagesUpdated = () => {
      if (!cancelled) fetchCount();
    };
    window.addEventListener('messageCountUpdated', onMessagesUpdated);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('messageCountUpdated', onMessagesUpdated);
    };
  }, []);

  return { count };
}
