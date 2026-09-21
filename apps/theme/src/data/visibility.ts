import { useEffect, useRef, useState } from "react";
export function useVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}
