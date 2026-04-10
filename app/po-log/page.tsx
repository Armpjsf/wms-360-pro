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
  ArrowLeft,
  Plus,
  X as CloseIcon,
  DollarSign,
  MapPin,
  Package,
  Trash2,
  Edit2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getApiUrl } from "@/lib/config";

export default function POLogPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orders' | 'delivery'>('orders');
  const [logs, setLogs] = useState<any[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deliveryStartDate, setDeliveryStartDate] = useState("");
  const [deliveryEndDate, setDeliveryEndDate] = useState("");

  // Manual Entry Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    customer: "",
    location: "",
    orderNo: "",
    sku: "",
    qty: "" as any,
    packs: "" as any,
    shippingCost: "" as any,
    notes: "",
    pdfLink: ""
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [deliveryCurrentPage, setDeliveryCurrentPage] = useState(1);
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

  const fetchDeliveryLogs = async () => {
    setDeliveryLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/delivery-history"));
      const data = await res.json();
      if (Array.isArray(data)) setDeliveryLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDeliveryLoading(false);
    }
  };

  // Filter Delivery Logs
  const filteredDeliveryLogs = deliveryLogs.filter(log => {
    let match = true;
    if (deliveryStartDate && log.date) {
        // Handle Thai date conversion if needed, but assuming ISO comparison for now
        // If Google Sheets returns DD/MM/YYYY, we might need a parser
        match = match && log.date >= deliveryStartDate;
    }
    if (deliveryEndDate && log.date) {
        match = match && log.date <= deliveryEndDate;
    }
    return match;
  });

  // Delivery Pagination Logic
  const deliveryTotalPages = Math.ceil(filteredDeliveryLogs.length / itemsPerPage);
  
  // Helper to parse DD/MM/YYYY or YYYY-MM-DD for comparison
  const parseDate = (d: string) => {
    if (!d) return 0;
    if (d.includes('-')) return new Date(d).getTime(); // ISO
    if (d.includes('/')) {
        const [day, month, year] = d.split('/').map(Number);
        // Handle Buddhist Year if > 2500
        const finalYear = year > 2500 ? year - 543 : year;
        return new Date(finalYear, month - 1, day).getTime();
    }
    return 0;
  };

  // Sort by date descending (Newest first)
  const sortedDeliveryLogs = [...filteredDeliveryLogs].sort((a, b) => {
    const timeA = parseDate(a.date);
    const timeB = parseDate(b.date);
    if (timeA !== timeB) return timeB - timeA;
    // Fallback to orderNo descending if dates are same
    return (b.orderNo || "").localeCompare(a.orderNo || "");
  });

  const currentDeliveryData = sortedDeliveryLogs.slice(
    (deliveryCurrentPage - 1) * itemsPerPage,
    deliveryCurrentPage * itemsPerPage
  );

  // Reset page when filter changes
  useEffect(() => {
    setDeliveryCurrentPage(1);
  }, [deliveryStartDate, deliveryEndDate]);

  // Calculate Location Summary from FILTERED logs
  const locationSummary = filteredDeliveryLogs.reduce((acc, log) => {
    const loc = log.location?.trim() || "";
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    if (activeTab === 'delivery') {
      fetchDeliveryLogs();
    }
  }, [activeTab]);

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // If editing, delete the old record first
      if (editingLog) {
        const params = new URLSearchParams({
            date: editingLog.date,
            customer: editingLog.customer,
            orderNo: editingLog.orderNo,
            sku: editingLog.sku
        });
        await fetch(getApiUrl(`/api/delivery-history?${params.toString()}`), {
            method: 'DELETE'
        });
      }

      const res = await fetch(getApiUrl("/api/delivery-history"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingLog(null);
        fetchDeliveryLogs();
        setFormData({
            date: new Date().toISOString().split('T')[0],
            customer: "",
            location: "",
            orderNo: "",
            sku: "",
            qty: "" as any,
            packs: "" as any,
            shippingCost: "" as any,
            notes: "",
            pdfLink: ""
        });
      } else {
        alert("Failed to save delivery record");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDelivery = (log: any) => {
    setEditingLog(log);
    setFormData({
        date: log.date.includes('/') ? new Date().toISOString().split('T')[0] : log.date, // Try to parse or fallback
        customer: log.customer,
        location: log.location,
        orderNo: log.orderNo,
        sku: log.sku,
        qty: log.qty,
        packs: log.packs,
        shippingCost: log.shippingCost,
        notes: log.notes,
        pdfLink: log.pdfLink
    });
    setShowAddForm(true);
  };

  const handleDeleteDelivery = async (log: any) => {
    if (!confirm(`ยืนยันการลบประวัติการส่งของลูกค้า ${log.customer} (Order: ${log.orderNo}) ใช่หรือไม่?`)) {
        return;
    }

    try {
        const params = new URLSearchParams({
            date: log.date,
            customer: log.customer,
            orderNo: log.orderNo,
            sku: log.sku
        });
        const res = await fetch(getApiUrl(`/api/delivery-history?${params.toString()}`), {
            method: 'DELETE'
        });

        if (res.ok) {
            fetchDeliveryLogs();
        } else {
            const err = await res.json();
            alert(err.error || "Failed to delete record");
        }
    } catch (err) {
        console.error(err);
        alert("Error deleting record");
    }
  };

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

    // Check for Waiting Status (Thai or English) - Unify with "กำลังดำเนินการ"
    const statusLower = log.status?.toLowerCase() || "";
    if (statusLower.includes('รอ') || statusLower.includes('wait') || statusLower.includes('กำลังดำเนินการ')) {
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
  })).sort((a, b) => b.totalQty - a.totalQty); // Sorted by Total Qty (High to Low)

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
        <Link href="/dashboard" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-4 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
        </Link>
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

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "px-6 py-3 font-bold text-sm transition-all border-b-2",
              activeTab === 'orders'
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            {t('po_log_title')} (Order Logs)
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={cn(
              "px-6 py-3 font-bold text-sm transition-all border-b-2",
              activeTab === 'delivery'
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            ประวัติงานส่ง (Delivery History)
          </button>
        </div>

        {activeTab === 'orders' ? (
          <motion.div 
            key="orders-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* ... existing KPIs ... */}
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
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col xl:flex-row gap-4 shadow-sm">
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
            </div>

            {/* Customer Summary Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
            </div>

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

                            <div className="flex items-center gap-4 self-end md:self-auto">
                              {/* NEW: Send to Delivery Button */}
                              {/* NEW: Send to Delivery Button - Aggregated by Order */}
                              <button
                                onClick={async () => {
                                  try {
                                    // 1. Group items by OrderNo
                                    const sameOrderItems = logs.filter(l => l.orderNo === log.orderNo);
                                    
                                    // 2. Aggregate Data
                                    // - Total Qty
                                    // - Combined SKU string (e.g. "SKU-A, SKU-B")
                                    const totalQty = sameOrderItems.reduce((sum, item) => sum + (item.qty || 0), 0);
                                    const combinedSKUs = Array.from(new Set(sameOrderItems.map(item => item.item))).join(", ");

                                    // 3. Prepare Single Row Payload
                                    const payload = {
                                      date: log.date,
                                      customer: log.customer,
                                      orderNo: log.orderNo,
                                      sku: combinedSKUs, // All SKUs in one string
                                      qty: totalQty,     // Sum of all quantities
                                      packs: 0,
                                      shippingCost: 0,
                                      notes: "รอแอดมินลงข้อมูล",
                                      pdfLink: log.pdfLink || ""
                                    };

                                    const res = await fetch(getApiUrl("/api/delivery-history"), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(payload)
                                    });

                                    if (res.ok) {
                                      alert(`รวบรวมข้อมูลเลขที่ ${log.orderNo} จำนวน ${sameOrderItems.length} รายการ (รวม ${totalQty} ชิ้น) ไปยังประวัติงานส่งแล้ว`);
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert("เกิดข้อผิดพลาดในการรวบรวมข้อมูล");
                                  }
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-100 whitespace-nowrap"
                                title={`รวบส่งทั้ง Order (${log.orderNo})`}
                              >
                                <Truck className="w-4 h-4" />
                                <span>รวบส่ง Order</span>
                              </button>
                              <div className="text-right min-w-[80px]">
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
          </motion.div>
        ) : (
          <motion.div 
            key="delivery-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Delivery KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">รวมค่าขนส่ง</p>
                        <p className="text-2xl font-black text-slate-800">
                            ฿{filteredDeliveryLogs.reduce((sum, log) => sum + (log.shippingCost || 0), 0).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">รวมจำนวนแพ็ก</p>
                        <p className="text-2xl font-black text-slate-800">
                            {filteredDeliveryLogs.reduce((sum, log) => sum + (log.packs || 0), 0).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Truck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">จำนวนงานส่ง</p>
                        <p className="text-2xl font-black text-slate-800">
                            {filteredDeliveryLogs.length.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Delivery Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row gap-4 shadow-sm items-center">
                <div className="flex-1 w-full flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                        <span className="text-slate-400 text-xs font-bold uppercase">วันที่เริ่ม</span>
                        <input
                            type="date"
                            value={deliveryStartDate}
                            onChange={(e) => setDeliveryStartDate(e.target.value)}
                            className="bg-transparent text-slate-900 outline-none text-sm font-medium w-full"
                        />
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                        <span className="text-slate-400 text-xs font-bold uppercase">วันที่สิ้นสุด</span>
                        <input
                            type="date"
                            value={deliveryEndDate}
                            onChange={(e) => setDeliveryEndDate(e.target.value)}
                            className="bg-transparent text-slate-900 outline-none text-sm font-medium w-full"
                        />
                    </div>
                </div>
                <button
                    onClick={() => {
                        setDeliveryStartDate("");
                        setDeliveryEndDate("");
                    }}
                    className="px-4 py-2 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase"
                >
                    ล้างการกรอง
                </button>
            </div>

            {/* Location Summary */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
                <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                    สรุปพื้นที่จัดส่ง (Delivery Areas)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(locationSummary).map(([loc, count], idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <p className="text-xs text-slate-400 font-bold uppercase truncate" title={loc}>{loc || "ไม่ระบุที่อยู่"}</p>
                            <p className="text-xl font-black text-indigo-600">{count} <span className="text-[10px] text-slate-400 font-medium">ครั้ง</span></p>
                        </div>
                    ))}
                    {Object.keys(locationSummary).length === 0 && (
                        <p className="col-span-full text-center py-4 text-slate-400 text-sm">ยังไม่มีข้อมูลพื้นที่จัดส่ง</p>
                    )}
                </div>
            </div>

            {/* Delivery History Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800">ประวัติการจัดส่งสินค้า</h2>
                <button
                    onClick={() => {
                        setEditingLog(null);
                        setFormData({
                            date: new Date().toISOString().split('T')[0],
                            customer: "",
                            location: "",
                            orderNo: "",
                            sku: "",
                            qty: "" as any,
                            packs: "" as any,
                            shippingCost: "" as any,
                            notes: "",
                            pdfLink: ""
                        });
                        setShowAddForm(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    เพิ่มข้อมูลการส่ง
                </button>
            </div>

            {/* Manual Entry Modal/Form */}
            <AnimatePresence>
                {showAddForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">บันทึกข้อมูลการจัดส่งสินค้า</h3>
                                    <p className="text-slate-500 text-sm">กรอกรายละเอียดเพื่อบันทึกลงในประวัติ</p>
                                </div>
                                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                    <CloseIcon className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleAddDelivery} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">วันที่จัดส่ง</label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="date" 
                                                required
                                                value={formData.date}
                                                onChange={e => setFormData({...formData, date: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">ชื่อลูกค้า</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="ระบุชื่อลูกค้า..."
                                            value={formData.customer}
                                            onChange={e => setFormData({...formData, customer: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">สถานที่จัดส่ง</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                        <textarea 
                                            rows={2}
                                            placeholder="คีย์ที่อยู่จัดส่งที่นี่..."
                                            value={formData.location}
                                            onChange={e => setFormData({...formData, location: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">เลขที่ Order</label>
                                        <input 
                                            type="text" 
                                            placeholder="เช่น 20260410-001"
                                            value={formData.orderNo}
                                            onChange={e => setFormData({...formData, orderNo: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">รหัสสินค้า (SKU)</label>
                                        <div className="relative group">
                                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="SKU-123"
                                                value={formData.sku}
                                                onChange={e => setFormData({...formData, sku: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">จำนวนของ</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={formData.qty}
                                            onChange={e => setFormData({...formData, qty: parseFloat(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">จำนวนแพ็ก</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={formData.packs}
                                            onChange={e => setFormData({...formData, packs: parseFloat(e.target.value) || 0})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                                            <DollarSign className="w-3 h-3" /> ค่าขนส่ง
                                        </label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            placeholder="ใส่ราคาค่าส่ง..."
                                            value={formData.shippingCost}
                                            onChange={e => setFormData({...formData, shippingCost: parseFloat(e.target.value) || 0})}
                                            className="w-full bg-indigo-50/50 border border-indigo-100 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">หมายเหตุ</label>
                                        <input 
                                            type="text" 
                                            value={formData.notes}
                                            onChange={e => setFormData({...formData, notes: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">ลิงก์เอกสาร (PDF)</label>
                                        <div className="relative group">
                                            <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                placeholder="https://drive.google.com/..."
                                                value={formData.pdfLink}
                                                onChange={e => setFormData({...formData, pdfLink: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowAddForm(false)}
                                        className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all active:scale-95"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-[2] px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
                                    >
                                        {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delivery History Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="px-6 py-5">วันที่</th>
                                <th className="px-6 py-5">ชื่อลูกค้า / สถานที่</th>
                                <th className="px-6 py-5">Order / SKU</th>
                                <th className="px-6 py-5 text-center">จำนวน / แพ็ก</th>
                                <th className="px-6 py-5 text-right">ค่าขนส่ง</th>
                                <th className="px-6 py-5">หมายเหตุ</th>
                                <th className="px-6 py-5 text-center">เอกสาร</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {deliveryLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-6 py-4"><Skeleton className="h-10 w-full" /></td></tr>
                                ))
                            ) : currentDeliveryData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-medium">
                                        ยังไม่มีข้อมูลการจัดส่งสินค้า
                                    </td>
                                </tr>
                            ) : (
                                currentDeliveryData.map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">{log.date}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{log.customer}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                <MapPin className="w-3 h-3" /> {log.location || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-indigo-600 font-bold">{log.orderNo || '-'}</div>
                                            <div className="text-xs text-slate-500 mt-1">{log.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="font-bold text-slate-900 tabular-nums">{log.qty.toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{log.packs} แพ็ก</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={cn(
                                                "font-black tabular-nums",
                                                log.shippingCost > 0 ? "text-emerald-600" : "text-slate-300"
                                            )}>
                                                {log.shippingCost > 0 ? `฿${log.shippingCost.toLocaleString()}` : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                                                {log.notes || 'เสร็จสิ้น'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {log.pdfLink && (
                                                    <a 
                                                        href={log.pdfLink} 
                                                        target="_blank" 
                                                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                                        title="ดู PDF"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleEditDelivery(log)}
                                                    className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all"
                                                    title="แก้ไขข้อมูล"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDelivery(log)}
                                                    className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                                    title="ลบรายการ"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Delivery Pagination */}
                {!deliveryLoading && filteredDeliveryLogs.length > itemsPerPage && (
                    <div className="flex justify-between items-center bg-slate-50/50 p-4 border-t border-slate-100">
                        <div className="text-sm text-slate-500 font-medium">
                            Page {deliveryCurrentPage} of {deliveryTotalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeliveryCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={deliveryCurrentPage === 1}
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setDeliveryCurrentPage((p) => Math.min(deliveryTotalPages, p + 1))}
                                disabled={deliveryCurrentPage === deliveryTotalPages}
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
