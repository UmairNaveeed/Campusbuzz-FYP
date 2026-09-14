import { useState, useEffect } from 'react';
import { getUnreadNotificationsCount } from '../services/api';

const POLL_INTERVAL_MS = 15000;

export function useNotificationCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const res = await getUnreadNotificationsCount('main');
      if (res?.success) setCount(res.count ?? 0);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchCount();
      if (!cancelled) setLoading(false);
    })();
    const interval = setInterval(() => {
      if (!cancelled) fetchCount();
    }, POLL_INTERVAL_MS);
    const onCountUpdated = () => {
      if (!cancelled) fetchCount();
    };
    window.addEventListener('notificationCountUpdated', onCountUpdated);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('notificationCountUpdated', onCountUpdated);
    };
  }, []);

  const refetch = async () => {
    await fetchCount();
  };

  return { count, loading, refetch };
}
