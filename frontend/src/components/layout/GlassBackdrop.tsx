import { useEffect } from "react";

/**
 * Page-wide pieces of the liquid glass look:
 *  - soft drifting color blobs behind the content so glass has something to refract;
 *  - the SVG filter referenced by `.liquid` (backdrop refraction);
 *  - a capability flag, since only Chromium applies SVG filters inside backdrop-filter.
 */
export function GlassBackdrop() {
  useEffect(() => {
    const brands = (navigator as any).userAgentData?.brands as { brand: string }[] | undefined;
    const chromium = brands?.some((b) => b.brand === "Chromium") ?? /Chrome\//.test(navigator.userAgent);
    document.documentElement.classList.toggle("liquid-ok", chromium);
  }, []);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="blob absolute -left-24 top-24 h-[28rem] w-[28rem] rounded-full bg-brand/35 blur-3xl" />
        <span className="blob absolute right-[-6rem] top-[-4rem] h-[30rem] w-[30rem] rounded-full bg-gold/35 blur-3xl [animation-delay:-8s]" />
        <span className="blob absolute bottom-[-6rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-indigo-300/40 blur-3xl [animation-delay:-16s]" />
      </div>
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="11" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="46" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  );
}
