import { useEffect, useState } from 'react';

/**
 * Hook that returns true only after the component has mounted on the client.
 * Useful for preventing hydration mismatches with client-only content like i18n.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
