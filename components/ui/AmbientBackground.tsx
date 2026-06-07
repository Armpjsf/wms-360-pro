"use client";

export const AmbientBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4f7fb_0%,#eef6f4_42%,#f8fafc_100%)]" />
      <div className="absolute inset-0 opacity-[0.34] [background-image:linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(90deg,rgba(30,64,175,0.18),rgba(15,118,110,0.16),rgba(180,83,9,0.10))]" />
      <div className="absolute left-0 top-0 h-full w-1/3 bg-[linear-gradient(90deg,rgba(15,118,110,0.09),transparent)]" />
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
    </div>
  );
};
