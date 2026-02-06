'use client';

import Link from 'next/link';
import { LineChart, TrendingUp, Clock, BarChart3 } from 'lucide-react';

export default function AnalyticsLandingPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
       <header>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics Center</h1>
          <p className="text-slate-500">วิเคราะห์ข้อมูลเชิงลึกและรายงาน</p>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/analytics/forecast" className="group bg-white border border-slate-200 p-6 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all">
             <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500/20">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-2">Demand Forecast</h3>
             <p className="text-slate-500 text-sm">พยากรณ์ความต้องการสินค้าล่วงหน้า</p>
          </Link>

          <Link href="/analytics/aging" className="group bg-white border border-slate-200 p-6 rounded-xl hover:border-amber-500 hover:shadow-lg transition-all">
             <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/20">
                <Clock className="w-6 h-6 text-amber-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-2">Inventory Aging</h3>
             <p className="text-slate-500 text-sm">รายงานอายุสินค้าและสินค้าค้างสต็อก</p>
          </Link>

          <Link href="/analytics/summary" className="group bg-white border border-slate-200 p-6 rounded-xl hover:border-emerald-500 hover:shadow-lg transition-all">
             <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-500/20">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-2">Transaction Summary</h3>
             <p className="text-slate-500 text-sm">สรุปยอดรับ-จ่ายแยกตามหมวดหมู่</p>
          </Link>

          <Link href="/analytics/reports" className="group bg-white border border-slate-200 p-6 rounded-xl hover:border-pink-500 hover:shadow-lg transition-all">
             <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-500/20">
                <BarChart3 className="w-6 h-6 text-pink-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-2">Report Center</h3>
             <p className="text-slate-500 text-sm">สร้างและดาวน์โหลดรายงาน (CSV/PDF)</p>
          </Link>
       </div>
    </div>
  );
}
