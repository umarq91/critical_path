import Image from "next/image";

export const AuthBrand = () => (
  <div className="flex flex-col items-center gap-1.5">
    <Image
      src="/icons/logo.jpeg"
      alt="Threebyone"
      width={1600}
      height={328}
      priority
      className="h-14 w-auto object-contain"
    />
    {/* Same treatment as the sidebar's wordmark (app-sidebar.tsx) — same hex, weight, and font-serif,
        matching the logo's own ink and typeface, so both instances match the logo exactly. */}
    <span className="text-2xl font-light uppercase tracking-[0.02em] text-[#3B3D3F] font-serif">Critical Path</span>
  </div>
);
