"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where, type DocumentReference, type DocumentData } from "firebase/firestore";
import { getStoredUser, type AppUser } from "@/services/appAuth";
import useMqttTelemetry from "@/hooks/useMqttTelemetry";
import { sendStopMeasurement } from "@/services/mqttCommands";

/** ===== Types (moisture diabaikan) ===== */
type SensorState = {
  turbidity: number | null;
  r: number | null;
  g: number | null;
  b: number | null;
};

type LiveTelemetry = {
  Turbidity?: number;
  R?: number;
  G?: number;
  B?: number;
  result?: boolean; // opsional dari device
} | null;

// ===== Types & defaults =====
type CpoThresholds = {
  /** Volt minimum agar dianggap GOOD. Jika Turbidity < nilai ini → BAD */
  turbidity_min_good_v: number;
  /** Batas bawah rasio warna R/(R+G+B); jika di bawah ini → BAD */
  r_ratio_min: number;
};

const FALLBACK_THRESHOLDS: CpoThresholds = {
  turbidity_min_good_v: 1.0, // sesuai dataset kamu: <1 BAD, ≥1 GOOD
  r_ratio_min: 0.35, // tetap dipakai
};

/** Bentuk dokumen di Firestore (nilai bisa string/number) */
type FirestoreThresholdDoc = Partial<{
  turbidity_min_good_v: number | string;
  turbidity_max_v: number | string; // legacy key
  r_ratio_min: number | string;
}>;

// ===== Fetch thresholds dari Firestore (configs/cpo_thresholds) =====
async function fetchThresholdsFromFirestore(): Promise<CpoThresholds | null> {
  try {
    const ref = doc(db, "configs", "cpo_thresholds") as DocumentReference<DocumentData>;
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as unknown as FirestoreThresholdDoc;

      const toNum = (v: number | string | undefined, fallback: number) => (v === undefined ? fallback : Number(v));

      // backward compat: jika dulu ada turbidity_max_v, pakai sebagai min_good
      const minGood =
        d.turbidity_min_good_v !== undefined
          ? toNum(d.turbidity_min_good_v, FALLBACK_THRESHOLDS.turbidity_min_good_v)
          : d.turbidity_max_v !== undefined
          ? toNum(d.turbidity_max_v, FALLBACK_THRESHOLDS.turbidity_min_good_v)
          : FALLBACK_THRESHOLDS.turbidity_min_good_v;

      return {
        turbidity_min_good_v: minGood,
        r_ratio_min: toNum(d.r_ratio_min, FALLBACK_THRESHOLDS.r_ratio_min),
      };
    }
  } catch {
    // fallback akan dipakai
  }
  return null;
}

// ===== Classifier: dua aturan aktif =====
function classifyCPO(s: { R: number; G: number; B: number; Turbidity: number }, t: CpoThresholds): { label: "Good" | "Bad"; y: 0 | 1; result_analyze: boolean; r_ratio: number } {
  const R = Number(s.R) || 0;
  const G = Number(s.G) || 0;
  const B = Number(s.B) || 0;
  const T = Number(s.Turbidity) || 0;

  // r_ratio dengan guard zero-division
  const sum = Math.max(R + G + B, Number.EPSILON);
  const r_ratio = R / sum;

  let isBad = false;

  // ✅ Aturan turbidity utama
  if (T < t.turbidity_min_good_v) isBad = true;

  // ✅ Aturan warna tetap dipakai
  if (r_ratio < t.r_ratio_min) isBad = true;

  const label: "Good" | "Bad" = isBad ? "Bad" : "Good";
  const y: 0 | 1 = isBad ? 1 : 0; // 0=Good, 1=Bad (sesuai dataset)
  const result_analyze = !isBad; // Good → true, Bad → false
  return { label, y, result_analyze, r_ratio };
}

/** ===== Komponen Halaman ===== */
export default function MeasurementDetailPage() {
  const router = useRouter();
  const user: AppUser | null = getStoredUser();
  const deviceId: string | null = user?.deviceId ?? null;

  // LIVE telemetry dari MQTT
  const live: LiveTelemetry = useMqttTelemetry(deviceId);

  const [processing, setProcessing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [result, setResult] = useState<"Good" | "Bad" | null>(null);
  const [askSave, setAskSave] = useState(false);

  // buffer tampilan (tanpa moisture)
  const [sensor, setSensor] = useState<SensorState>({
    turbidity: null,
    r: null,
    g: null,
    b: null,
  });

  // simpan info tambahan untuk audit (opsional)
  const [usedThresholds, setUsedThresholds] = useState<CpoThresholds | null>(null);

  /** Sinkronkan tampilan angka dengan data live dari MQTT */
  useEffect(() => {
    if (!live) return;
    setSensor((prev) => ({
      turbidity: typeof live.Turbidity === "number" ? live.Turbidity : prev.turbidity,
      r: typeof live.R === "number" ? live.R : prev.r,
      g: typeof live.G === "number" ? live.G : prev.g,
      b: typeof live.B === "number" ? live.B : prev.b,
    }));
  }, [live]);

  /** Jika device kirim live.result dan sudah dianalisis manual, ikutkan sebagai override opsional */
  useEffect(() => {
    if (typeof live?.result === "boolean" && analyzed) {
      setResult(live.result ? "Good" : "Bad");
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

    try {
      const R = sensor.r ?? 0;
      const G = sensor.g ?? 0;
      const B = sensor.b ?? 0;
      const Turbidity = sensor.turbidity ?? 0;

      // Ambil ambang dari Firestore, kalau tidak ada pakai fallback
      const t = (await fetchThresholdsFromFirestore()) ?? FALLBACK_THRESHOLDS;
      setUsedThresholds(t);

      // Klasifikasi sederhana
      const { label } = classifyCPO({ R, G, B, Turbidity }, t);

      setAnalyzed(true);
      setResult(label);
      setAskSave(true);
    } catch (e: unknown) {
      console.error("analyze error:", e);
    } finally {
      setProcessing(false);
    }
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

      // Hitung ulang label numerik agar konsisten
      const R = sensor.r ?? 0;
      const G = sensor.g ?? 0;
      const B = sensor.b ?? 0;
      const Turbidity = sensor.turbidity ?? 0;
      const t = usedThresholds ?? FALLBACK_THRESHOLDS;
      const { y, r_ratio } = classifyCPO({ R, G, B, Turbidity }, t);

      // Bentuk dokumen sesuai skema kamu
      const payload = {
        analyze: analyzed, // true jika tombol Analyze pernah diklik
        created_at: serverTimestamp(),
        time: serverTimestamp(),
        measurment_id: nextId,

        // Hasil analisis (Good → true, Bad → false)
        result_analyze: (result ?? (y === 0 ? "Good" : "Bad")) === "Good",
        result_label: y, // 0=Good, 1=Bad (sesuai dataset)
        debug_rratio: r_ratio, // opsional untuk audit

        sensor_data: [
          {
            Turbidity: Turbidity,
            R: R,
            G: G,
            B: B,
          },
        ],

        thresholds_used: t, // opsional: simpan jejak ambang yang dipakai
        user_id: userRef, // reference
        device_id: deviceRef, // reference
      };

      await addDoc(collection(db, "measurments"), payload);
      await stopAndBack("saved");
    } catch (e: unknown) {
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
          <h1 className="mt-2 text-xl font-semibold">Measurment Detail</h1>
        </div>

        {/* PANEL PUTIH */}
        <section className="-mx-4 mt-3 grow rounded-t-[24px] bg-white text-black p-4 flex flex-col">
          {/* ===== Data Sensor (live) ===== */}
          <div>
            <div className="text-sm font-semibold mb-3">Data Sensor</div>

            {/* Turbidity */}
            <div className="grid grid-cols-[1fr_auto] gap-y-3 items-center">
              <span className="text-sm text-zinc-700">Turbidity</span>
              <CapsuleValue value={sensor.turbidity} unit="V" placeholder="—" />
            </div>

            {/* Color Parameter: R G B */}
            <div className="mt-6">
              <span className="block text-sm text-zinc-700 mb-4 md:mb-5">Color Parameter</span>
              <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-xs">
                <MiniCapsule label="R" value={sensor.r} />
                <MiniCapsule label="G" value={sensor.g} />
                <MiniCapsule label="B" value={sensor.b} />
              </div>
            </div>
          </div>

          {/* Kapsul Analyze */}
          <div className={`relative w-full h-12 md:h-14 rounded-full shadow mt-8 md:mt-10 ${analyzeCapsuleClass}`}>
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
            ${result === "Good" ? "bg-lime-400 text-black" : result === "Bad" ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-600"}`}
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

/** Kapsul nilai abu-abu dengan unit di kanan (untuk Turbidity) */
function CapsuleValue({ value, unit, placeholder = "—" }: { value: number | null; unit: string; placeholder?: string }) {
  const shown = value === null || Number.isNaN(value) ? placeholder : String(value);
  return (
    <div className="min-w-[180px] h-10 md:h-11 rounded-full bg-zinc-300/70 border border-zinc-200 shadow-inner flex items-center justify-between px-4">
      <span className="text-sm text-zinc-700">{shown}</span>
      <span className="text-sm text-zinc-500">{unit}</span>
    </div>
  );
}

/** Kapsul kecil untuk R/G/B tanpa unit */
function MiniCapsule({ label, value }: { label: string; value: number | null }) {
  const shown = value === null || Number.isNaN(value) ? "—" : String(value);
  return (
    <div className="h-10 rounded-full bg-zinc-300/70 border border-zinc-200 shadow-inner px-3 flex items-center justify-between">
      <span className="text-sm text-zinc-700">{label}</span>
      <span className="text-sm text-zinc-700">{shown}</span>
    </div>
  );
}
