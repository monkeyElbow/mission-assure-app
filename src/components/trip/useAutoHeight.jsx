// useAutoHeight.js
import { useEffect, useRef } from "react";

export function useAutoHeight(isOpen) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (isOpen) {
      // from current height (0 or pixels) → content height → auto
      el.style.height = el.scrollHeight + "px";
      const done = () => {
        el.style.height = "auto"; // allow natural growth after anim
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    } else {
      // from auto → pixels → 0
      // 1) lock current height
      el.style.height = el.scrollHeight + "px";
      // 2) force reflow so the browser registers the height before setting 0
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight; 
      // 3) now animate to 0
      el.style.height = "0px";
    }
  }, [isOpen]);

  return wrapRef;
}
