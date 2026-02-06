"use client";

import { getApiUrl } from "@/lib/config";
import { useEffect, useState } from "react";
import CountUp from 'react-countup';
import { 
  BarChart3, 
  Activity, 
  Package, 
  ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, DollarSign, 
  Calendar, Clock, LayoutDashboard, Presentation, CheckCircle, MapPin
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { cn } from "@/lib/utils";
import WaterfallChart from "@/components/charts/WaterfallChart";
import YearlyComparisonChart from "@/components/charts/YearlyComparisonChart";
import AnnualTrendChart from "@/components/charts/AnnualTrendChart";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import DashboardAlertsBanner from "@/components/DashboardAlertsBanner";
import QuickActionsPanel from "@/components/QuickActionsPanel";
import { DashboardCustomizer, useDashboardCustomization } from "@/components/DashboardCustomizer";
import { DashboardGridLayout } from "@/components/dashboard/DashboardGridLayout";
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import StockDepletionChart from "@/components/StockDepletionChart";
import { generateDepletionData } from "@/lib/forecast";

export default function Dashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"operational" | "executive" | "forecast">("operational");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Date Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedYear1, setSelectedYear1] = useState(new Date().getFullYear().toString());
  const [selectedYear2, setSelectedYear2] = useState((new Date().getFullYear() - 1).toString());
  
  // Dashboard Customization
  const { visibleWidgets, toggleWidget, mounted } = useDashboardCustomization();
  const [selectedForecastItem, setSelectedForecastItem] = useState<any>(null);

  // Set default date range on mount (Start from 2024 to include historical data)
  useEffect(() => {
     const now = new Date();
     const firstDay = new Date(2024, 0, 1); // Jan 1st, 2024
     setStartDate(firstDay.toISOString().split('T')[0]);
     setEndDate(now.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!startDate || !endDate) return; // Wait for initialization

      try {
        setLoading(true); // Show loading state on refetch
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('year1', selectedYear1);
        params.append('year2', selectedYear2);
        
        const url = getApiUrl(`/api/dashboard?${params.toString()}`);
        setDebugInfo(url);
        console.log("[Dashboard] Fetching URL:", url);
        
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
        }

        const json = await res.json();
        setData(json);
        if (json?.forecasts?.length > 0) {
           setSelectedForecastItem(json.forecasts[0]);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, selectedYear1, selectedYear2]); // Trigger on changes

  if (loading && !data && !startDate) { // Only show full screen loader on initial load
    return (
      <div className="min-h-screen p-8 space-y-8">
         <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-[2rem]" />)}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 rounded-3xl col-span-2" />
            <Skeleton className="h-96 rounded-3xl" />
         </div>
      </div>
    );
  }

  // ... Error handling remains the same ...
  if (error && !data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
            <div className="max-w-md w-full bg-white border border-red-200 p-6 rounded-2xl shadow-lg">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Connection Error</h2>
                <p className="text-red-600 text-center mb-4">{error}</p>
                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-600 break-all mb-4">
                    Attempted URL: {debugInfo}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-200"
                >
                    Retry Connection
                </button>
            </div>
        </div>
      );
  }

  // Stagger children animation
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <div className="min-h-screen relative p-8 pb-32">
      <AmbientBackground />
      
      {/* Critical Alerts & Quick Actions */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col gap-4">
        {visibleWidgets['alerts'] && <DashboardAlertsBanner />}
        {visibleWidgets['quick_actions'] && <QuickActionsPanel />}
      </div>
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <motion.div variants={item}>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl">WMS</span>
              {t('dashboard_title')}
            </h1>
            <p className="text-slate-500 mt-1 font-medium">{t('dashboard_subtitle')}</p>
          </motion.div>
          
          <motion.div variants={item} className="flex gap-4">
             <DashboardCustomizer visibleWidgets={visibleWidgets} toggleWidget={toggleWidget} />
             
             <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
               <div className="relative group">
                 <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                 <input 
                   type="date" 
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer hover:bg-indigo-50/50"
                 />
               </div>
               <span className="text-slate-300 font-bold">→</span>
               <div className="relative group">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer hover:bg-indigo-50/50"
                  />
               </div>
            </div>
          </motion.div>
        </div>

        {/* Tab Navigation */}
        <motion.div variants={item} className="flex space-x-1 bg-white p-1 rounded-2xl w-fit shadow-sm border border-slate-200">
          <button
            onClick={() => setActiveTab("operational")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
              activeTab === "operational"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {t('tab_operational')}
          </button>
          <button
            onClick={() => setActiveTab("executive")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
              activeTab === "executive"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {t('tab_executive')}
          </button>
          <button
            onClick={() => setActiveTab("forecast")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
              activeTab === "forecast"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {/* Brain icon or similar would be nice, but simple text is fine for now */}
            <span>Forecast</span>
            {/* Optional: Add a 'Beta' or 'New' badge */}
            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">Beta</span>
          </button>
        </motion.div>

        {activeTab === "operational" && (
           <DashboardGridLayout 
              defaultLayout={[
                  'kpi_grid', 
                  'chart_top_sellers', 
                  'chart_inventory_health', 
                  'chart_sales_category', 
                  'chart_weekly_activity',
                  'table_low_stock',
                  'table_recent_activity'
              ]}
              widgets={{
                  kpi_grid: visibleWidgets['stats'] ? (
                     <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                        <motion.div variants={item} transition={{ delay: 0.05 }}>
                          <KpiCard label={t('kpi_active_items')} value={data?.summary?.activeSkuCount || 0} icon={CheckCircle} bg="bg-violet-50" color="text-violet-500" href="/inventory?status=ALL" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.1 }}>
                          <KpiCard label={t('kpi_total_stock')} value={data?.summary?.totalStock || 0} icon={Package} bg="bg-blue-50" color="text-blue-500" href="/inventory?status=ALL" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.15 }}>
                          <KpiCard label={t('kpi_total_value')} value={`฿${(data?.summary?.totalValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} bg="bg-green-50" color="text-green-600" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.2 }}>
                          <KpiCard label={t('kpi_inbound_total')} value={data?.summary?.inboundPeriod || 0} icon={ArrowDownRight} bg="bg-indigo-50" color="text-indigo-500" href="/inventory/inbound" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.25 }}>
                           <KpiCard label={t('kpi_outbound_total')} value={data?.summary?.outboundPeriod || 0} icon={ArrowUpRight} bg="bg-emerald-50" color="text-emerald-500" href="/inventory/outbound" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.3 }}>
                          <KpiCard label={t('kpi_dead_stock')} value={data?.summary?.deadStockCount || 0} icon={Clock} bg="bg-slate-100" color="text-slate-500" href="/inventory?movement=Deadstock" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.35 }}>
                          <KpiCard label={t('kpi_aging_stock')} value={data?.summary?.agingStockCount || 0} icon={Clock} bg="bg-rose-50" color="text-rose-600" border={data?.summary?.agingStockCount > 10 ? "border-rose-200" : ""} />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.4 }}>
                           <KpiCard label={t('kpi_low_stock')} value={data?.summary?.lowStockCount || 0} icon={AlertTriangle} bg="bg-rose-50" color="text-rose-500" border={data?.summary?.lowStockCount > 0 ? "border-rose-200" : ""} href="/inventory?status=LOW" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.5 }}>
                           <KpiCard label={t('kpi_turnover_rate')} value={`${(data?.summary?.turnoverRate || 0).toFixed(1)}%`} icon={Activity} bg="bg-emerald-50" color="text-emerald-500" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.6 }}>
                           <KpiCard 
                             label={t('kpi_empty_locations') || "Empty Locations"} 
                             value={data?.summary?.emptyLocationCount || 0} 
                             icon={MapPin} 
                             bg="bg-gray-50" 
                             color="text-gray-500"
                             title={data?.summary?.emptyLocationList?.join('\n')}
                           />
                        </motion.div>
                     </div>
                  ) : null,

                  chart_top_sellers: visibleWidgets['charts'] ? (
                      <div className="h-96 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                            {t('chart_top_sellers')}
                          </h3>
                          <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                               <BarChart
                                     data={data?.topSellers?.slice(0, 10) || []}
                                     layout="vertical"
                                     margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                                 >
                                     <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                                     <XAxis type="number" stroke="#9ca3af" fontSize={10} tick={{fill: '#475569'}} />
                                     <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={10} tick={{fill: '#475569'}} width={100} />
                                     <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }} />
                                     <Bar dataKey="qty" name="Sold Qty" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                        {(data?.topSellers || []).map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={['#4f46e5', '#6366f1', '#818cf8', '#7c3aed', '#8b5cf6', '#a78bfa', '#c026d3', '#d946ef', '#e879f9', '#db2777'][index % 10]} />
                                        ))}
                                     </Bar>
                                 </BarChart>
                            </ResponsiveContainer>
                         </div>
                     </div>
                  ) : null,

                  chart_inventory_health: visibleWidgets['charts'] ? (
                      <div className="h-96 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                            {t('chart_inventory_health')}
                         </h3>
                         <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                  <Pie 
                                     data={data?.healthData || []} 
                                     dataKey="value" 
                                     nameKey="name"
                                     cx="50%" cy="50%" 
                                     innerRadius={45} outerRadius={65}
                                     paddingAngle={5} cornerRadius={5}
                                     label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                                        if (!value) return null;
                                        const RADIAN = Math.PI / 180;
                                        const r = (outerRadius || 0) * 1.25;
                                        const x = (cx || 0) + r * Math.cos(-(midAngle || 0) * RADIAN);
                                        const y = (cy || 0) + r * Math.sin(-(midAngle || 0) * RADIAN);
                                        return <text x={x} y={y} fill="#1e293b" textAnchor={x > (cx || 0) ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">{value}</text>;
                                     }}
                                  >
                                     {(data?.healthData || []).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Healthy' ? '#22c55e' : entry.name === 'Low' ? '#eab308' : '#ef4444'} stroke="none" />
                                     ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                               </PieChart>
                            </ResponsiveContainer>
                         </div>
                     </div>
                  ) : null,
                  
                  chart_sales_category: visibleWidgets['charts'] ? (
                       <div className="h-96 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                           <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                             <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                             {t('chart_sales_category')}
                           </h3>
                           <div className="flex-1 w-full min-h-0">
                               <ResponsiveContainer width="100%" height="100%">
                                   <PieChart>
                                       <Pie
                                           data={data?.categorySales || []}
                                           dataKey="value"
                                           nameKey="name"
                                           cx="50%" cy="50%"
                                           innerRadius={50} outerRadius={65}
                                           paddingAngle={2} cornerRadius={4}
                                       >
                                           {(data?.categorySales || []).map((entry: any, index: number) => (
                                               <Cell key={`cell-${index}`} fill={['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa'][index % 5]} stroke="none" />
                                           ))}
                                       </Pie>
                                       <Tooltip />
                                       <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                   </PieChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                  ) : null,

                  chart_weekly_activity: visibleWidgets['charts'] ? (
                       <div className="h-96 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                           <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                             <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                             {t('chart_weekly_activity')}
                           </h3>
                           <div className="flex-1 w-full min-h-0">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data?.movementData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tick={{fill: '#475569'}} />
                                      <YAxis stroke="#9ca3af" fontSize={10} tick={{fill: '#475569'}} />
                                      <Tooltip cursor={{fill: '#f1f5f9'}} />
                                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                      <Bar dataKey="in" name={t('legend_inbound')} fill="#818cf8" radius={[4, 4, 0, 0]} />
                                      <Bar dataKey="out" name={t('legend_outbound')} fill="#34d399" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                       </div>
                  ) : null,

                  table_low_stock: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl overflow-hidden flex flex-col shadow-sm">
                        <h3 className="text-sm font-bold text-rose-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <AlertTriangle className="h-4 w-4 drop-shadow-md" /> {t('section_low_stock_alert')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <table className="w-full text-sm">
                              <thead className="text-slate-400 uppercase font-bold text-[10px] sticky top-0 bg-white/80 border-b border-slate-200">
                                  <tr>
                                     <th className="text-left pb-3 pl-2">{t('col_product_name')}</th>
                                     <th className="text-right pb-3">{t('col_qty')}</th>
                                     <th className="text-center pb-3">{t('col_status')}</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                  {data?.lowStock?.map((item: any, index: number) => (
                                     <tr key={index} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="py-3 pl-2 text-slate-700 font-medium flex items-center gap-2">
                                           {item.image ? (
                                               <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} alt={item.name} className="w-6 h-6 rounded-lg object-cover" />
                                           ) : <div className="w-6 h-6 bg-slate-100 rounded-lg"></div>}
                                           <span className="truncate max-w-[120px]">{item.name}</span>
                                        </td>
                                        <td className="py-3 text-right text-rose-500 font-bold">{item.qty}</td>
                                        <td className="py-3 text-center">
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                             item.status === 'Fast Moving' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                          }`}>
                                             {item.status?.split(' ')[0]}
                                          </span>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                           </table>
                        </div>
                     </div>
                  ) : null,

                  table_recent_activity: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl overflow-hidden flex flex-col shadow-sm">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Activity className="h-4 w-4 text-indigo-500" /> {t('section_recent_activity')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <ul className="space-y-4">
                              {data?.recentActivity?.map((activity: any, index: number) => (
                                 <li key={index} className="flex items-center space-x-3 text-sm p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                    {activity.type === 'inbound' ? (
                                       <div className="bg-emerald-100 p-2 rounded-lg"><ArrowDownRight className="h-3 w-3 text-emerald-600" /></div>
                                    ) : (
                                       <div className="bg-rose-100 p-2 rounded-lg"><ArrowUpRight className="h-3 w-3 text-rose-600" /></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                       <span className="text-slate-700 font-medium block truncate">{activity.description}</span>
                                       <span className="text-slate-400 text-xs">{activity.time}</span>
                                    </div>
                                 </li>
                              ))}
                           </ul>
                        </div>
                     </div>
                  ) : null
              }}
           />
        )}

        {/* Executive Tab - including Waterfall and Radar */}
        {activeTab === "executive" && (
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.5 }}
             className="h-full flex flex-col gap-8 overflow-auto pr-2 pb-8"
           >
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <AdminMetric label={t('metric_accuracy')} value={`${(data?.executive?.accuracy || 0).toFixed(2)}%`} target="100%" color="text-indigo-500" />
                  <AdminMetric label={t('metric_damage')} value={`${(data?.executive?.damageRate || 0).toFixed(2)}%`} target="0.00%" color="text-rose-500" />
                  <AdminMetric label={t('metric_space')} value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`} target="100%" color="text-amber-500" />
                  <AdminMetric label={t('metric_fulfillment')} value={`${(data?.executive?.otif || 98.5).toFixed(1)}%`} target="100%" color="text-emerald-500" />
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl shadow-sm">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                         <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                         {t('chart_flow_analysis')}
                       </h3>
                     <div className="h-64 w-full">
                        {data?.executive?.waterfallData ? (
                           <WaterfallChart data={data.executive.waterfallData} />
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading waterfall...</div>
                        )}
                     </div>
                  </div>
                  
                   <div className="rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl shadow-sm">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                         <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                         {t('chart_performance_radar')}
                       </h3>
                      <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data?.executive?.radarData || []}>
                               <PolarGrid stroke="#e2e8f0" />
                               <PolarAngleAxis dataKey="metric" stroke="#cbd5e1" fontSize={11} tick={{ fill: '#475569', fontWeight: 600 }} />
                               <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" fontSize={9} tick={false} />
                               <Radar name="Actual" dataKey="actual" stroke="#818cf8" fill="#818cf8" fillOpacity={0.6} animationDuration={1000} />
                               <Radar name="Target" dataKey="target" stroke="#34d399" fill="#34d399" fillOpacity={0.2} animationDuration={1000} />
                               <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} itemStyle={{ color: '#1e293b' }} />
                               <Legend />
                            </RadarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
               </div>

               {/* Year Over Year Comparison */}
               <div className="rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                         <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                         {t('chart_yoy')}
                       </h3>
                      <div className="flex gap-2 text-sm">
                         <select 
                            value={selectedYear1} 
                            onChange={(e) => setSelectedYear1(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                         >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                         <span className="text-slate-400 font-bold">vs</span>
                         <select 
                            value={selectedYear2} 
                            onChange={(e) => setSelectedYear2(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                         >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                      </div>
                  </div>
                  <div className="h-80 w-full">
                     {data?.executive?.yearlyComparison?.data ? (
                        <YearlyComparisonChart 
                            data={data.executive.yearlyComparison.data} 
                            year1Label={data.executive.yearlyComparison.labels.year1}
                            year2Label={data.executive.yearlyComparison.labels.year2}
                        />
                     ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading comparison...</div>
                     )}
                  </div>
               </div>

               {/* All-Time Annual Trend */}
               <div className="rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                     <span className="w-1 h-4 bg-violet-600 rounded-full"></span>
                     {t('chart_growth_trend')}
                   </h3>
                  <div className="h-80 w-full">
                     {data?.executive?.annualTrend ? (
                        <AnnualTrendChart data={data.executive.annualTrend} />
                     ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading trend...</div>
                     )}
                  </div>
               </div>
            </motion.div>
         )}

         {/* Forecast Tab */}
         {activeTab === "forecast" && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col gap-6"
            >
                {/* 1. Depletion Chart (Selected Item) */}
                {selectedForecastItem && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-3">
                             <StockDepletionChart 
                                data={generateDepletionData(selectedForecastItem.stock, selectedForecastItem.burnRate)}
                                productName={selectedForecastItem.name}
                                burnRate={selectedForecastItem.burnRate}
                                daysLeft={selectedForecastItem.daysLeft}
                             />
                        </div>
                    </div>
                )}

                <div className="rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl shadow-sm overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1 h-4 bg-purple-600 rounded-full"></span>
                          Forecast Radar (AI Prediction)
                        </h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-bold uppercase tracking-wide border border-rose-200">Critical: &lt; 7 Days</span>
                            <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wide border border-amber-200">High: &lt; 14 Days</span>
                        </div>
                   </div>
                   
                   <div className="overflow-x-auto">
                       <table className="w-full text-sm">
                           <thead className="text-slate-400 uppercase font-bold text-[10px] bg-slate-50/50 border-b border-slate-200">
                               <tr>
                                   <th className="text-left py-4 pl-4 rounded-l-xl">Product</th>
                                   <th className="text-right py-4">Current Stock</th>
                                   <th className="text-right py-4">Burn Rate (Avg/Day)</th>
                                   <th className="text-right py-4">Days Left</th>
                                   <th className="text-center py-4">Est. Stockout</th>
                                   <th className="text-center py-4 pr-4 rounded-r-xl">Risk Level</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {data?.forecasts?.length > 0 ? (
                                   data.forecasts.map((item: any, idx: number) => (
                                       <tr 
                                          key={idx} 
                                          onClick={() => setSelectedForecastItem(item)}
                                          className={cn(
                                             "transition-colors group cursor-pointer border-l-4",
                                             selectedForecastItem?.name === item.name 
                                                ? "bg-indigo-50/80 border-l-indigo-500 shadow-sm" 
                                                : "hover:bg-purple-50/30 border-l-transparent"
                                          )}
                                       >
                                           <td className="py-4 pl-4 font-bold text-slate-700 flex items-center gap-3">
                                               {item.image ? (
                                                   <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm group-hover:scale-105 transition-transform" />
                                               ) : (
                                                   <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-bold">N/A</div>
                                               )}
                                               <div>
                                                   <div className="text-sm">{item.name}</div>
                                                   <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.category}</div>
                                               </div>
                                           </td>
                                           <td className="py-4 text-right font-mono text-slate-600">{item.stock.toLocaleString()}</td>
                                           <td className="py-4 text-right font-mono text-slate-500">
                                               {item.burnRate > 0 ? `-${item.burnRate.toFixed(1)}` : '0'} 
                                               <span className="text-[10px] text-slate-400 ml-1">/day</span>
                                           </td>
                                           <td className="py-4 text-right">
                                               <span className={cn(
                                                   "font-black text-lg",
                                                   item.daysLeft < 7 ? "text-rose-600" :
                                                   item.daysLeft < 14 ? "text-amber-500" : "text-emerald-500"
                                               )}>
                                                   {item.daysLeft}
                                               </span>
                                           </td>
                                           <td className="py-4 text-center font-medium text-slate-500">
                                               {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                           </td>
                                           <td className="py-4 text-center pr-4">
                                               <span className={cn(
                                                   "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                                                   item.risk === 'CRITICAL' ? "bg-rose-50 text-rose-600 border-rose-200" :
                                                   item.risk === 'HIGH' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                                                   "bg-emerald-50 text-emerald-600 border-emerald-200"
                                               )}>
                                                   {item.risk}
                                               </span>
                                           </td>
                                       </tr>
                                   ))
                               ) : (
                                   <tr>
                                       <td colSpan={6} className="text-center py-12 text-slate-400 flex flex-col items-center">
                                           <CheckCircle className="w-12 h-12 mb-3 text-emerald-200" />
                                           <p className="font-medium">All systems normal. No stockout risks detected.</p>
                                       </td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
                </div>
            </motion.div>
         )}
       </motion.div>
     </div>
   );
 }
 
function KpiCard({ label, value, icon: Icon, color, bg, border, href, title }: any) {
    const Content = (
     <div title={title} className={cn("bg-white border shadow-sm p-6 rounded-[2rem] flex flex-col justify-between h-40 group hover:border-indigo-500/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden cursor-pointer", border || "border-slate-200")}>
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
          <Icon className="h-24 w-24 text-slate-900" />
        </div>
        <div className="flex justify-between items-start relative z-10">
           <div className={cn("p-3 rounded-2xl w-fit", bg)}>
             <Icon className={cn("h-6 w-6", color.split(' ')[0])} />
           </div>
        </div>
        <div className="relative z-10">
           <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
           <p className={cn("text-4xl font-black tabular-nums tracking-tighter text-slate-900")}>
              {typeof value === 'number' ? <CountUp end={value} duration={1.8} separator="," /> : value}
           </p>
        </div>
     </div>
    );

    if (href) {
        return <Link href={href} className="block">{Content}</Link>;
    }
    return Content;
}
 
 function AdminMetric({ label, value, target, color }: any) {
   return (
     <div className="bg-white/60 border border-white/40 p-6 rounded-[2rem] flex flex-col h-32 backdrop-blur-xl hover:border-white/60 transition-colors shadow-sm">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
        <p className={cn("text-3xl font-black mb-1 tracking-tight", color.split(' ')[0])}>{value}</p>
        <p className="text-[10px] text-slate-500 font-medium">Target: <span className="text-slate-700 font-bold">{target}</span></p>
     </div>
   );
 }
