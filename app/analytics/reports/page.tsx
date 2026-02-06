'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, ArrowRight, BarChart, Table } from 'lucide-react';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/config';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  endpoint: string;
  color: string;
}

const reports: ReportConfig[] = [
  {
    id: 'inventory_summary',
    name: 'Inventory Summary',
    description: 'Current stock levels, value, and status',
    icon: PackageIcon,
    endpoint: '/api/reports/inventory',
    color: 'bg-indigo-500'
  },
  {
    id: 'stock_movement',
    name: 'Stock Movement',
    description: 'Inbound, Outbound, and adjustments log',
    icon: ArrowRight,
    endpoint: '/api/reports/movement',
    color: 'bg-emerald-500'
  },
  {
    id: 'low_stock',
    name: 'Low Stock Report',
    description: 'Items below minimum stock level',
    icon: Table,
    endpoint: '/api/reports/low-stock',
    color: 'bg-rose-500'
  },
  {
    id: 'damage_report',
    name: 'Damage Report',
    description: 'Damaged items and reasons',
    icon: FileText,
    endpoint: '/api/reports/damage',
    color: 'bg-amber-500'
  }
];

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (report: ReportConfig) => {
    // Direct link to printable pages for supported reports
    if (report.id === 'inventory_summary') {
        router.push('/analytics/summary');
        return;
    }
    if (report.id === 'low_stock') {
        router.push('/inventory?status=LOW');
        return;
    }
    if (report.id === 'stock_movement') {
        const branchId = new URLSearchParams(window.location.search).get('branchId') || '';
        window.open(getApiUrl(`/api/reports/movement?branchId=${branchId}`), '_blank');
        return;
    }
    if (report.id === 'damage_report') {
        router.push('/damage');
        return;
    }

    setLoading(true);
    // Simulate generation for others
    setTimeout(() => {
      setLoading(false);
      alert(`Generated ${report.name} successfully! (Mock Download)`);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32">
      <AmbientBackground />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-xl text-white">
              <BarChart className="w-6 h-6" />
            </span>
            Report Center
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Generate and export insights from your inventory</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-white shadow-lg", report.color)}>
                <report.icon className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{report.name}</h3>
              <p className="text-slate-500 text-sm mb-6">{report.description}</p>
              
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CSV / PDF</span>
                <button 
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold text-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0",
                    report.color
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerate(report);
                  }}
                >
                  Generate
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Configuration Panel (Mock) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Scheduled Reports
          </h3>
          <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-300">
             <p className="text-slate-400 font-medium">Coming Soon: Schedule automated email reports</p>
          </div>
        </div>
      </div>
    </div>
  );
}
