'use client';

import Link from 'next/link';
import { LineChart, TrendingUp, Clock, BarChart3, Sparkles, FileText, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function AnalyticsLandingPage() {
  const { t } = useLanguage();

  const cards = [
    {
      title: t('demand_forecast'),
      desc: t('demand_forecast_desc'),
      href: '/analytics/forecast',
      icon: TrendingUp,
      color: 'from-blue-600 to-indigo-600',
      lightBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600'
    },
    {
      title: t('inventory_aging'),
      desc: t('inventory_aging_desc'),
      href: '/analytics/aging',
      icon: Clock,
      color: 'from-orange-500 to-amber-600',
      lightBg: 'bg-amber-50',
      iconColor: 'text-amber-600'
    },
    {
      title: t('transaction_summary'),
      desc: t('transaction_summary_desc'),
      href: '/analytics/summary',
      icon: BarChart3,
      color: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600'
    },
    {
      title: t('profit_title'),
      desc: t('profit_subtitle'),
      href: '/analytics/profit',
      icon: PieChart,
      color: 'from-purple-500 to-pink-600',
      lightBg: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
        title: t('report_center'),
        desc: t('report_center_desc'),
        href: '/analytics/reports',
        icon: FileText,
        color: 'from-rose-500 to-red-600',
        lightBg: 'bg-rose-50',
        iconColor: 'text-rose-600'
    },
    {
        title: t('menu_smart_restock'),
        desc: "AI-powered reorder optimization and stockout prediction.",
        href: '/ai-reorder',
        icon: Sparkles,
        color: 'from-violet-600 to-purple-700',
        lightBg: 'bg-violet-50',
        iconColor: 'text-violet-600'
    }
  ];

  return (
    <div className="relative min-h-screen p-8 pb-32 overflow-hidden">
       <AmbientBackground />
       
       <div className="relative z-10 max-w-6xl mx-auto space-y-12">
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center md:text-left"
          >
             <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">
                {t('analytics_center')}
             </h1>
             <p className="text-slate-500 text-lg font-medium">{t('analytics_subtitle')}</p>
          </motion.header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {cards.map((card, idx) => (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                   <Link 
                     href={card.href} 
                     className="group relative border-none p-8 rounded-[2.5rem] flex flex-col h-full shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden"
                   >
                      {/* Permanent Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.color} transition-transform duration-700 group-hover:scale-110`} />
                      
                      {/* Decorative Circles */}
                      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white opacity-10 blur-2xl group-hover:scale-150 transition-transform duration-700`} />

                      <div className="relative z-10">
                        <div className={`w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                           <card.icon className={`w-8 h-8 text-white`} />
                        </div>
                        
                        <h3 className={`text-2xl font-black text-white mb-3 tracking-tight`}>
                           {card.title}
                        </h3>
                        
                        <p className="text-white/80 leading-relaxed font-medium">
                           {card.desc}
                        </p>
                      </div>

                      <div className="mt-8 flex items-center gap-2 text-white font-black text-sm uppercase tracking-widest relative z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                         {t('go_to_section') || 'Open Module'}
                         <TrendingUp className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                   </Link>
                </motion.div>
             ))}
          </div>
       </div>
    </div>
  );
}
