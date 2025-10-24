// src/app/home/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import Toast from "@/app/components/Toast";
import RequireAuth from "@/app/components/RequireAuth";
import HeaderCard from "@/app/components/HeaderCard";
import BottomNav from "@/app/components/BottomNav";
import StatusCard from "@/app/components/StatusCard";
import MeasurementHistory from "@/app/components/MeasurmentHistory";
import MqttBridge from "@/app/components/MqttBridge";

export default function HomePage() {
  const params = useSearchParams();
  const toast = params.get("toast"); // "saved" | "cancelled" | "error" | null

  const toastText = toast === "saved" ? "Data saved" : toast === "cancelled" ? "Save cancelled" : toast === "error" ? "Save failed" : null;
  return (
    <RequireAuth>
      <main className="bg-black text-white min-h-dvh">
        <div className="mx-auto w-full max-w-screen-sm px-4 flex flex-col min-h-dvh">
          <HeaderCard />
          <StatusCard className="mt-3 shrink-0" />
          <section className="mt-4 grow -mx-4 bg-white text-black rounded-t-[28px] p-4 pb-[112px]">
            {/* konten lain */}
            <MeasurementHistory className="mt-4" />
          </section>
        </div>
        <BottomNav />
      </main>
      <MqttBridge />
      {toastText && <Toast text={toastText} />}
    </RequireAuth>
  );
}
