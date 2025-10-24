"use client";
import { useEffect, useState } from "react";

export default function Toast({ text }: { text: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 2300);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[60]">
      <div className="rounded-full bg-black text-white/90 px-4 py-2 shadow-lg border border-white/10">{text}</div>
    </div>
  );
}
