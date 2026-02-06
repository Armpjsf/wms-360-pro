"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  ExternalLink,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Truck,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getApiUrl } from "@/lib/config";

export default function POLogPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Summary Pagination & Filter
  const [summaryPage, setSummaryPage] = useState(1);
  const [showWaitingOnly, setShowWaitingOnly] = useState(false);
  const summaryItemsPerPage = 5;

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(getApiUrl("/api/po-logs"));
        const data = await res.json();
        if (Array.isArray(data)) setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  // Filter Logic
  const filtered = logs.filter((log) => {
    const matchText =
      log.orderNo.toLowerCase().includes(filter.toLowerCase()) ||
      log.customer.toLowerCase().includes(filter.toLowerCase()) ||
      log.item.toLowerCase().includes(filter.toLowerCase());

    const matchStatus = statusFilter === "All" || log.status === statusFilter;

    let matchDate = true;
    if (startDate && log.date) {
      matchDate = matchDate && log.date >= startDate;
    }
    if (endDate && log.date) {
      matchDate = matchDate && log.date <= endDate;
    }

    return matchText && matchStatus && matchDate;
  });

  // Simple Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentData = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, statusFilter, startDate, endDate]);

  // Summary Metrics (Keep calculating from FULL filtered set, not just page)
  const totalQty = filtered.reduce((s, l) => s + l.qty, 0);
  const uniqueCustomers = new Set(filtered.map((l) => l.customer)).size;
  const uniqueShipments = new Set(filtered.map((l) => l.orderNo)).size;
  const uniqueOrders = new Set(filtered.map((l) => l.poOrder)).size;
  
  // Group by Customer for Summary
  const customerStats = filtered.reduce((acc, log) => {
    const cust = log.customer || "Unknown";
    if (!acc[cust]) {
      acc[cust] = {
        name: cust,
        orders: new Set(),
        shipments: new Set(),
        qty: 0,
        waitingCount: 0,
        waitingQty: 0
      };
    }
    if (log.poOrder) acc[cust].orders.add(log.poOrder);
    acc[cust].shipments.add(log.orderNo);
    acc[cust].qty += log.qty;

    // Check for Waiting Status (Thai or English)
    if (log.status?.includes('รอ') || log.status?.toLowerCase().includes('wait')) {
        acc[cust].waitingCount += 1;
        acc[cust].waitingQty += log.qty;
    }

    return acc;
  }, {} as Record<string, any>);

  const customerSummary = Object.values(customerStats).map((stat: any) => ({
    name: stat.name,
    orderCount: stat.orders.size,
    shipmentCount: stat.shipments.size,
    totalQty: stat.qty,
    waitingCount: stat.waitingCount,
    waitingQty: stat.waitingQty
  })).sort((a, b) => b.waitingQty - a.waitingQty);

  // Filter & Paginate Summary
  const filteredSummary = showWaitingOnly 
    ? customerSummary.filter(c => c.waitingCount > 0)
    : customerSummary;
    
  const summaryTotalPages = Math.ceil(filteredSummary.length / summaryItemsPerPage);
  const currentSummaryData = filteredSummary.slice(
    (summaryPage - 1) * summaryItemsPerPage,
    summaryPage * summaryItemsPerPage
  );

  const handleExportCSV = () => {
    const bom = "\uFEFF"; // UTF-8 BOM
    const headers = ["Customer", "Total Orders", "Total Shipments", "Total Qty", "Waiting Shipments", "Waiting Qty"];
    const rows = customerSummary.map(c => [
        `"${c.name}"`, 
        c.orderCount, 
        c.shipmentCount, 
        c.totalQty,
        c.waitingCount,
        c.waitingQty
    ]);
    const csvContent = bom + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `po_log_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen p-6 pb-20">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                <FileText className="w-8 h-8" />
              </span>
              {t('po_log_title')}
            </h1>
            <p className="text-slate-500 mt-2 font-medium ml-1">
              {t('po_log_subtitle')}
            </p>
          </div>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                {t('total_shipments')}
              </p>
              <p className="text-2xl font-black text-slate-800 tabular-nums">
                {uniqueShipments}
              </p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                {t('total_orders')}
              </p>
              <p className="text-2xl font-black text-slate-800 tabular-nums">
                {uniqueOrders}
              </p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                {t('active_customers')}
              </p>
              <p className="text-2xl font-black text-slate-800 tabular-nums">
                {uniqueCustomers}
              </p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white/50 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-xl">
              <Filter className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                {t('total_units')}
              </p>
              <p className="text-2xl font-black text-slate-800 tabular-nums">
                {totalQty.toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col xl:flex-row gap-4 shadow-sm"
        >
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder={t('search_po_placeholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 group focus-within:bg-white focus-within:border-indigo-500/50 transition-colors">
              <span className="text-slate-400 text-xs font-bold uppercase whitespace-nowrap group-focus-within:text-indigo-500">
                {t('date_from')}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-900 outline-none text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 group focus-within:bg-white focus-within:border-indigo-500/50 transition-colors">
              <span className="text-slate-400 text-xs font-bold uppercase whitespace-nowrap group-focus-within:text-indigo-500">
                {t('date_to')}
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-900 outline-none text-sm font-medium"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 outline-none font-medium text-sm focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="All">{t('filter_all_status')}</option>
              {Array.from(new Set(logs.map((l) => l.status))).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Customer Summary Table */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div>
                     <h3 className="font-bold text-slate-800 text-lg">สรุปยอดตามลูกค้า (Customer Summary)</h3>
                     <p className="text-xs text-slate-500">
                        {showWaitingOnly ? 'Showing customers with waiting jobs only' : 'Showing all customers'}
                     </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setShowWaitingOnly(!showWaitingOnly);
                            setSummaryPage(1);
                        }}
                        className={cn(
                            "px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2",
                            showWaitingOnly 
                                ? "bg-amber-50 text-amber-600 border-amber-200" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full", showWaitingOnly ? "bg-amber-500" : "bg-slate-300")} />
                        เฉพาะรอรับ (Waiting Only)
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4 text-center">Orders (PO)</th>
                            <th className="px-6 py-4 text-center">Shipments</th>
                            <th className="px-6 py-4 text-center text-amber-600">Waiting (Job)</th>
                            <th className="px-6 py-4 text-right text-amber-600">Waiting (Qty)</th>
                            <th className="px-6 py-4 text-right">Total Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {currentSummaryData.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                                <td className="px-6 py-4 text-center tabular-nums text-slate-600">
                                    <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-xs font-bold">{row.orderCount}</span>
                                </td>
                                <td className="px-6 py-4 text-center tabular-nums text-slate-600">{row.shipmentCount}</td>
                                <td className="px-6 py-4 text-center tabular-nums font-bold text-amber-600 bg-amber-50/50">
                                    {row.waitingCount > 0 ? row.waitingCount : '-'}
                                </td>
                                <td className="px-6 py-4 text-right tabular-nums font-bold text-amber-600 bg-amber-50/50">
                                    {row.waitingQty > 0 ? row.waitingQty.toLocaleString() : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">{row.totalQty.toLocaleString()}</td>
                            </tr>
                        ))}
                        {currentSummaryData.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No summary data available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Summary Pagination */}
            {summaryTotalPages > 1 && (
                <div className="flex justify-between items-center p-4 bg-slate-50/50 border-t border-slate-100">
                    <div className="text-xs text-slate-500 font-medium">
                        Page {summaryPage} of {summaryTotalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSummaryPage(p => Math.max(1, p - 1))}
                            disabled={summaryPage === 1}
                            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setSummaryPage(p => Math.min(summaryTotalPages, p + 1))}
                            disabled={summaryPage === summaryTotalPages}
                            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </motion.div>

        {/* List View */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))
          ) : currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur rounded-[2rem] border border-slate-200 border-dashed">
              <FileText className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">{t('no_logs')}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {currentData.map((log, idx) => {
                  const isCompleted =
                    log.status === "Completed" || log.status === "เสร็จสิ้น";
                  return (
                    <motion.div
                      key={`${log.orderNo}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white group hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-bold text-lg text-slate-900">
                              {log.orderNo}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                                isCompleted
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : "bg-amber-50 text-amber-600 border-amber-100",
                              )}
                            >
                              {log.status}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {log.date}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-bold text-xs uppercase">
                                Customer:
                              </span>
                              <span className="font-medium">
                                {log.customer}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-bold text-xs uppercase">
                                Item:
                              </span>
                              <span
                                className="font-medium group-hover:text-indigo-600 transition-colors"
                                title={log.item}
                              >
                                {log.item}
                              </span>
                            </div>
                            {log.poOrder && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-bold text-xs uppercase">
                                  Order:
                                </span>
                                <span className="font-mono font-semibold text-indigo-600">
                                  {log.poOrder}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 self-end md:self-auto">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                              Quantity
                            </p>
                            <p className="text-xl font-black text-slate-900 tabular-nums">
                              {log.qty.toLocaleString()}
                            </p>
                          </div>

                          {log.pdfLink && (
                            <a
                              href={log.pdfLink}
                              target="_blank"
                              className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-indigo-500/30"
                              title="View PDF"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > itemsPerPage && (
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
