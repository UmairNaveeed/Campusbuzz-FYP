import { useState, useEffect } from 'react';
import { getForumMessageCount, getUnreadNotificationsCount } from '../services/api';

const POLL_INTERVAL_MS = 8000;

export function useForumMessageCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const [msgRes, notifRes] = await Promise.all([
        getForumMessageCount(),
        getUnreadNotificationsCount('forum'),
      ]);
      const msgCount = msgRes?.success ? (msgRes.count ?? 0) : 0;
      const notifCount = notifRes?.success ? (notifRes.count ?? 0) : 0;
      return msgCount + notifCount;
    } catch {}
    return 0;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await fetchCount();
      if (!cancelled) {
        setCount(c);
        setLoading(false);
      }
    })();
    const interval = setInterval(async () => {
      if (!cancelled) {
        const c = await fetchCount();
        if (!cancelled) setCount(c);
      }
    }, POLL_INTERVAL_MS);
    const onCountUpdated = () => {
      if (!cancelled) fetchCount().then((c) => { if (!cancelled) setCount(c); });
    };
    window.addEventListener('forumNotificationCountUpdated', onCountUpdated);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('forumNotificationCountUpdated', onCountUpdated);
    };
  }, []);

  const refetch = async () => {
    const c = await fetchCount();
    setCount(c);
  };

  return { count, loading, refetch };
}
