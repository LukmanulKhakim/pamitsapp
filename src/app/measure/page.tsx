"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, where, type DocumentReference, type DocumentData } from "firebase/firestore";
import { getStoredUser, type AppUser } from "@/services/appAuth";
import useMqttTelemetry from "@/hooks/useMqttTelemetry";
import { sendStopMeasurement } from "@/services/mqttCommands";

type SensorState = {
  ffa: number | null;
  carotine: number | null;
  moisture: number | null;
};

type LiveTelemetry = {
  FFA?: number;
  Carotine?: number;
  Moisture?: number;
  result?: boolean;
} | null;

export default function MeasurementDetailPage() {
  const router = useRouter();
  const user: AppUser | null = getStoredUser();

  // AppUser.deviceId sudah bertipe string | null
  const deviceId: string | null = user?.deviceId ?? null;

  // LIVE telemetry dari MQTT
  const live: LiveTelemetry = useMqttTelemetry(deviceId);

  const [processing, setProcessing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [result, setResult] = useState<"Good" | "Poor" | null>(null);
  const [askSave, setAskSave] = useState(false);

  // buffer tampilan (ditarik dari live)
  const [sensor, setSensor] = useState<SensorState>({
    ffa: null,
    carotine: null,
    moisture: null,
  });

  /** Sinkronkan tampilan angka dengan data live dari MQTT */
  useEffect(() => {
    if (!live) return;
    setSensor((prev) => ({
      ffa: typeof live.FFA === "number" ? live.FFA : prev.ffa,
      carotine: typeof live.Carotine === "number" ? live.Carotine : prev.carotine,
      moisture: typeof live.Moisture === "number" ? live.Moisture : prev.moisture,
    }));
  }, [live]);

  /** Tentukan hasil (opsional) dari live.result bila ada */
  useEffect(() => {
    if (typeof live?.result === "boolean" && analyzed) {
      setResult(live.result ? "Good" : "Poor");
    }
  }, [live?.result, analyzed]);

  /** Ambil next measurment_id (berdasar user & terbesar saat ini + 1) */
  const getNextId = useCallback(async (userRef: DocumentReference<DocumentData>) => {
    const qLatest = query(collection(db, "measurments"), where("user_id", "==", userRef), orderBy("measurment_id", "desc"), limit(1));
    const snap = await getDocs(qLatest);
    if (snap.empty) return 1;
    const latest = Number(snap.docs[0].data().measurment_id ?? 0);
    return latest + 1;
  }, []);

  const handleAnalyze = async () => {
    if (processing) return;
    setProcessing(true);

    // TODO: ganti dengan inferensi model ML kamu
    await new Promise((r) => setTimeout(r, 900));

    setAnalyzed(true);

    // fallback jika live.result belum ada → tentukan default
    if (result === null) {
      const good = typeof live?.result === "boolean" ? live.result : true;
      setResult(good ? "Good" : "Poor");
    }

    setProcessing(false);
    setAskSave(true);
  };

  async function stopAndBack(toast?: string) {
    if (deviceId) {
      try {
        await sendStopMeasurement(deviceId);
      } catch {
        // no-op
      }
    }
    router.replace(toast ? `/home?toast=${encodeURIComponent(toast)}` : "/home");
  }

  const handleSave = async (save: boolean) => {
    if (!save) {
      await stopAndBack("cancelled");
      return;
    }

    if (!user?.id || !deviceId) {
      await stopAndBack("error");
      return;
    }

    try {
      const userRef = doc(db, "users", user.id) as DocumentReference<DocumentData>;
      const deviceRef = doc(db, "devices", deviceId) as DocumentReference<DocumentData>;

      const nextId = await getNextId(userRef);

      // bentuk dokumen sesuai skema kamu
      const payload = {
        analyze: analyzed, // true jika tombol Analyze pernah diklik
        created_at: serverTimestamp(),
        time: serverTimestamp(),
        measurment_id: nextId,
        result_analyze: result === "Good", // boolean
        sensor_data: [
          {
            Carotine: sensor.carotine ?? 0,
            FFA: sensor.ffa ?? 0,
            Moisture: sensor.moisture ?? 0,
          },
        ],
        user_id: userRef, // reference
        device_id: deviceRef, // reference
      };

      await addDoc(collection(db, "measurments"), payload);
      await stopAndBack("saved");
    } catch (e) {
      console.error("save measurment error:", e);
      await stopAndBack("error");
    }
  };

  // status tombol analyze (abu-abu sebelum diklik)
  const analyzeCapsuleClass = analyzed ? "bg-black text-white" : "bg-zinc-300 text-zinc-700";

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-screen-sm px-4 pt-4 pb-6 flex flex-col min-h-dvh">
        {/* Header */}
        <div className="mb-2 shrink-0">
          <Link href="/home" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white">
            <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-zinc-800">
              <ChevronLeftIcon className="w-5 h-5" />
            </span>
            <span>Back</span>
          </Link>
          <h1 className="mt-2 text-xl font-semibold">Measurement Detail</h1>
        </div>

        {/* PANEL PUTIH */}
        <section className="-mx-4 mt-3 grow rounded-t-[24px] bg-white text-black p-4 flex flex-col">
          {/* ===== Data Sensor (live) ===== */}
          <div>
            <div className="text-sm font-semibold mb-3">Data Sensor</div>

            <div className="grid grid-cols-[1fr_auto] gap-y-3 items-center">
              <span className="text-sm text-zinc-700">FFA</span>
              <CapsuleValue value={sensor.ffa} unit="%" placeholder="—" />

              <span className="text-sm text-zinc-700">Carotine</span>
              <CapsuleValue value={sensor.carotine} unit="ppm" placeholder="—" />

              <span className="text-sm text-zinc-700">Moisture</span>
              <CapsuleValue value={sensor.moisture} unit="%" placeholder="—" />
            </div>
          </div>

          {/* Kapsul Analyze (abu-abu jika belum diklik) + tombol kanan */}
          <div className={`relative w-full h-12 md:h-14 rounded-full shadow mt-5 ${analyzeCapsuleClass}`}>
            <span className="absolute inset-0 grid place-items-center text-base font-medium select-none">{processing ? "Processing…" : "Analyze"}</span>
            <button
              onClick={handleAnalyze}
              aria-label="Analyze"
              title="Run analysis"
              disabled={processing}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2
                w-11 h-11 md:w-12 md:h-12 rounded-full
                ring-2 grid place-items-center transition
                ${analyzed ? "bg-lime-400 ring-black" : "bg-zinc-400 ring-zinc-600"}
                hover:brightness-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <Image src="/analyze.svg" alt="" height={32} width={32} className={`w-5 h-5 ${processing ? "animate-pulse" : ""}`} />
            </button>
          </div>

          {/* Hasil */}
          <div
            className={`mt-3 w-full h-12 md:h-14 rounded-full grid place-items-center font-semibold
            ${result === "Good" ? "bg-lime-400 text-black" : result === "Poor" ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-600"}`}
          >
            {result ?? "—"}
          </div>

          {/* Konfirmasi simpan */}
          {askSave && (
            <div className="mt-5">
              <p className="text-center text-sm text-zinc-600">Are You Sure Will Save ?</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button onClick={() => handleSave(false)} className="rounded-full bg-zinc-800 text-white py-3">
                  No
                </button>
                <button onClick={() => handleSave(true)} className="rounded-full bg-zinc-800 text-white py-3">
                  Yes
                </button>
              </div>
            </div>
          )}

          {/* Gesture bar */}
          <div className="mt-auto pt-6 grid place-items-center">
            <div className="w-24 h-1.5 rounded-full bg-zinc-300" />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Kapsul nilai abu-abu dengan unit di kanan */
function CapsuleValue({ value, unit, placeholder = "—" }: { value: number | null; unit: string; placeholder?: string }) {
  const shown = value === null || Number.isNaN(value) ? placeholder : String(value);
  return (
    <div className="min-w-[180px] h-10 md:h-11 rounded-full bg-zinc-300/70 border border-zinc-200 shadow-inner flex items-center justify-between px-4">
      <span className="text-sm text-zinc-700">{shown}</span>
      <span className="text-sm text-zinc-500">{unit}</span>
    </div>
  );
}
