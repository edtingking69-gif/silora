import { useRef } from 'react';
import { navigate } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';

export function useSecretAdminTap(targetTaps = 5, timeWindowMs = 2000) {
  const { isAdmin } = useAuth();
  const tapTimesRef = useRef<number[]>([]);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    // Filter out taps older than the time window
    tapTimesRef.current = [...tapTimesRef.current.filter((t) => now - t <= timeWindowMs), now];

    if (tapTimesRef.current.length >= targetTaps) {
      e.preventDefault();
      e.stopPropagation();
      tapTimesRef.current = [];
      navigate(isAdmin ? '/admin/dashboard' : '/admin');
    }
  };

  return handleTap;
}