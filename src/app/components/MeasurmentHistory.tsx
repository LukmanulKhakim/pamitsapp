"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, type DocumentReference, type DocumentData } from "firebase/firestore";
import { getStoredUser, type AppUser } from "@/services/appAuth";

type Row = {
  id: string;
  measurment_id: number;
  created_at: Date;
  result_analyze: boolean;
};

type MeasDoc = {
  measurment_id?: number;
  created_at?: Timestamp;
  result_analyze?: boolean;
  user_id?: DocumentReference<DocumentData>;
  device_id?: DocumentReference<DocumentData>;
};

function startEndOfDay(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function daysInMonth(y: number, m0to11: number) {
  return new Date(y, m0to11 + 1, 0).getDate();
}

function fmtClock(d: Date) {
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}.${mm}`;
}

export default function MeasurementHistory({
  className = "",
  year,
  month, // 1..12
}: {
  className?: string;
  year?: number;
  month?: number;
}) {
  const today = useMemo(() => new Date(), []);
  const yr = year ?? today.getFullYear();
  const mo = month ?? today.getMonth() + 1; // 1..12
  const mIdx = mo - 1; // 0..11

  // container untuk bar tanggal
  const barRef = useRef<HTMLDivElement | null>(null);

  // selected day
  const [selectedDay, setSelectedDay] = useState<number>(1);
  useEffect(() => {
    const inThisMonth = today.getFullYear() === yr && today.getMonth() === mIdx;
    setSelectedDay(inThisMonth ? today.getDate() : 1);
  }, [yr, mIdx, today]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);

  const monthLabel = useMemo(() => new Date(yr, mIdx, 1).toLocaleString(undefined, { month: "long" }), [yr, mIdx]);

  const dayList = useMemo(() => {
    const n = daysInMonth(yr, mIdx);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [yr, mIdx]);

  // Auto-scroll
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${selectedDay}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDay]);

  // Query Firestore realtime
  useEffect(() => {
    const user: AppUser | null = getStoredUser();
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPermError(null);

    const userRef = doc(db, "users", user.id) as DocumentReference<DocumentData>;

    const day = new Date(yr, mIdx, selectedDay);
    const { start, end } = startEndOfDay(day);

    const q = query(collection(db, "measurments"), where("user_id", "==", userRef), where("created_at", ">=", Timestamp.fromDate(start)), where("created_at", "<", Timestamp.fromDate(end)), orderBy("created_at", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const r: Row[] = snap.docs.map((d) => {
          const data = d.data() as MeasDoc;
          const ts = data.created_at;
          return {
            id: d.id,
            measurment_id: Number(data.measurment_id ?? 0),
            created_at: ts instanceof Timestamp ? ts.toDate() : new Date(),
            result_analyze: data.result_analyze === true,
          };
        });
        setRows(r);
        setLoading(false);
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Query error";
        console.error("measurments query error:", err);
        setPermError(msg);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [yr, mIdx, selectedDay]);

  return (
    <div className={className}>
      <div className="rounded-3xl bg-white text-black shadow-sm">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold">Measurment History</h3>
        </div>

        {/* Bar tanggal horizontal */}
        <div className="px-2 pb-2">
          <div className="px-2 text-xs font-semibold text-zinc-500">{monthLabel}</div>
          <div ref={barRef} className="mt-2 flex items-center gap-3 overflow-x-auto no-scrollbar px-2 py-1">
            {dayList.map((d) => {
              const active = d === selectedDay;
              return (
                <button
                  key={d}
                  data-day={d}
                  onClick={() => setSelectedDay(d)}
                  className={`px-2 pb-1 text-sm border-b-2 transition
                    ${active ? "border-lime-400 text-black" : "border-transparent text-zinc-500"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="mt-1 space-y-3 px-4 pb-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : permError ? (
            <div className="text-sm text-red-600">Permission error: {permError}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-zinc-500">Not found</div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs">
                  <div className="font-semibold">ID : {row.measurment_id}</div>
                  <div className="text-zinc-500">Clock : {fmtClock(row.created_at)}</div>
                </div>
                <span className={`inline-block h-5 w-5 rounded-full ${row.result_analyze ? "bg-lime-400" : "bg-red-500"}`} aria-label={row.result_analyze ? "good" : "bad"} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
