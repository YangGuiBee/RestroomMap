import { useEffect, useState } from "react";

const QUERY = "(min-width: 768px)";

// 화면 폭 기준 데스크톱/웹 여부. 모바일은 카드 3개, 데스크톱은 화면이 넓어 6개를 보여준다.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
