'use client';

import { PackagePlus, PackageMinus, RefreshCw, Undo2 } from 'lucide-react';
import Link from 'next/link';

export default function OpsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Daily Operations</h1>
          <p className="text-slate-400">บันทึกการรับ-จ่ายสินค้าประจำวัน (Data Entry)</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           
           {/* Inbound Card */}
           <Link href="/ops/inbound" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackagePlus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-emerald-500/10 w-fit rounded-2xl mb-6 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                           <PackagePlus className="w-8 h-8 text-emerald-500" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">Inbound (รับเข้า)</h2>
                       <p className="text-slate-400">บันทึกการรับสินค้าเข้าสต็อก เพิ่มจำนวนสินค้า และบันทึกต้นทุน</p>
                   </div>
                   <div className="mt-8 flex items-center text-emerald-400 font-medium group-hover:translate-x-2 transition-transform">
                       Start Inbound Process &rarr;
                   </div>
               </div>
           </Link>

           {/* Outbound Card */}
           <Link href="/ops/outbound" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-rose-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackageMinus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-rose-500/10 w-fit rounded-2xl mb-6 border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
                           <PackageMinus className="w-8 h-8 text-rose-500" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">Outbound (จ่ายออก)</h2>
                       <p className="text-slate-400">บันทึกการเบิกจ่ายสินค้า ตัดสต็อกสำหรับออเดอร์ลูกค้า</p>
                   </div>
                   <div className="mt-8 flex items-center text-rose-400 font-medium group-hover:translate-x-2 transition-transform">
                       Start Outbound Process &rarr;
                   </div>
               </div>
           </Link>

           {/* Return Out Card */}
           <Link href="/ops/return-out" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-indigo-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <Undo2 className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-indigo-500/10 w-fit rounded-2xl mb-6 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                           <Undo2 className="w-8 h-8 text-indigo-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">ส่งกลับสินค้า (Return Out)</h2>
                       <p className="text-slate-400">ตัดสต็อกสินค้าจริงตามปกติ (ส่งคืน Supplier / ส่งกลับสาขาใหญ่) โดยไม่นับรวมในยอดขายหรือสถิติจ่ายออก</p>
                   </div>
                   <div className="mt-8 flex items-center text-indigo-400 font-medium group-hover:translate-x-2 transition-transform">
                       Start Return Out Process &rarr;
                   </div>
               </div>
           </Link>

           {/* Cycle Count Card */}
           <Link href="/mobile/cycle-count" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-blue-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <RefreshCw className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-blue-500/10 w-fit rounded-2xl mb-6 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                           <RefreshCw className="w-8 h-8 text-blue-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">Cycle Count (ตรวจนับสต็อก)</h2>
                       <p className="text-slate-400">ตรวจสอบความถูกต้องของสินค้าจริงเทียบกับระบบ</p>
                   </div>
                   <div className="mt-8 flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
                       Start Cycle Count &rarr;
                   </div>
               </div>
           </Link>

       </div>
    </div>
  );
}
