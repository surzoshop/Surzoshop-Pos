import { useEffect, useState } from "react";

export function useStandalone() {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const check = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const update = () => {
      const s = check();
      setStandalone(s);
      document.documentElement.classList.toggle("pwa-standalone", s);
    };
    update();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return standalone;
}
