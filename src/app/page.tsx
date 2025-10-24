// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Root() {
  redirect("/login");
}

// import RequireAuth from "./components/RequireAuth";
// import HeaderCard from "./components/HeaderCard";
// import BottomNav from "./components/BottomNav";
// import StatusCard from "./components/StatusCard";
// import MeasurementHistory from "./components/MeasurmentHistory";

// export default function HomePage() {
//   return (
//     <RequireAuth>
//       <main className="bg-black text-white min-h-dvh">
//         <div className="mx-auto w-full max-w-screen-sm px-4 flex flex-col min-h-dvh">
//           <HeaderCard />

//           <StatusCard />

//           <section className="mt-4 grow -mx-4 bg-white text-black rounded-t-[28px] p-4 pb-[112px]">
//             <MeasurementHistory className="mt-4" />
//           </section>
//         </div>
//         <BottomNav />
//       </main>
//     </RequireAuth>
//   );
// }
