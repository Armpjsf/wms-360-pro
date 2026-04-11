'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, ArrowRight, BarChart, Table, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  endpoint: string;
  color: string;
}

const reports = (t: any): ReportConfig[] => [
  {
    id: 'inventory_summary',
    name: t('inventory_summary_report'),
    description: t('inventory_summary_desc'),
    icon: PackageIcon,
    endpoint: '/api/reports/inventory',
    color: 'bg-indigo-500'
  },
  {
    id: 'stock_movement',
    name: t('stock_movement_report'),
    description: t('stock_movement_desc'),
    icon: ArrowRight,
    endpoint: '/api/reports/movement',
    color: 'bg-emerald-500'
  },
  {
    id: 'low_stock',
    name: t('low_stock_report'),
    description: t('low_stock_desc'),
    icon: Table,
    endpoint: '/api/reports/low-stock',
    color: 'bg-rose-500'
  },
  {
    id: 'damage_report',
    name: t('damage_report_name'),
    description: t('damage_report_desc'),
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
  const { t } = useLanguage();
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);

  const availableReports = reports(t);

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
        <Link href="/dashboard" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-4 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-xl text-white">
              <BarChart className="w-6 h-6" />
            </span>
            {t('report_center_title')}
          </h1>
          <p className="text-slate-500 mt-2 text-lg">{t('report_center_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReports.map((report) => (
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
                  {t('generate_btn')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Configuration Panel (Mock) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            {t('scheduled_reports')}
          </h3>
          <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-300">
             <p className="text-slate-400 font-medium">{t('scheduled_reports_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
