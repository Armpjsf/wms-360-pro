"use client";

export const AmbientBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7fafc_0%,#eef6f2_46%,#f8fafc_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_55%_at_18%_0%,rgba(29,78,216,0.14),transparent_58%),radial-gradient(70%_52%_at_88%_12%,rgba(13,148,136,0.16),transparent_56%),radial-gradient(62%_46%_at_58%_100%,rgba(217,119,6,0.10),transparent_60%)]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(115deg,rgba(255,255,255,0.74),rgba(255,255,255,0.18)_45%,rgba(255,255,255,0.58))]" />
      <div className="absolute left-0 top-0 h-full w-full opacity-[0.38] [background-image:linear-gradient(135deg,rgba(15,23,42,0.055)_0%,transparent_32%,rgba(15,118,110,0.055)_62%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(0deg,rgba(255,255,255,0.86),transparent)]" />
    </div>
  );
};
