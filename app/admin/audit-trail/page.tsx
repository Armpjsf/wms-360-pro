'use client';

import { useState, useEffect } from 'react';
import { History, ArrowLeft, Filter, Search, Clock, User, Package, FileText, Trash2, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  module: string;
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

const modules = ['All', 'inventory', 'inbound', 'outbound', 'damage', 'users', 'po-log'];
const actions = ['All', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'];

const getActionColor = (action: string) => {
  switch (action) {
    case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'UPDATE': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'DELETE': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'EXPORT': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'VIEW': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE': return <Package className="w-3 h-3" />;
    case 'UPDATE': return <FileText className="w-3 h-3" />;
    case 'DELETE': return <Trash2 className="w-3 h-3" />;
    case 'EXPORT': return <Download className="w-3 h-3" />;
    case 'VIEW': return <Eye className="w-3 h-3" />;
    default: return <FileText className="w-3 h-3" />;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('th-TH');
};

export default function AuditTrailPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (moduleFilter !== 'All') params.set('module', moduleFilter);
      if (actionFilter !== 'All') params.set('action', actionFilter);
      params.set('limit', '200');

      const res = await fetch(getApiUrl(`/api/audit?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(search.toLowerCase()) || 
                          log.description.toLowerCase().includes(search.toLowerCase()) ||
                          log.module.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesModule && matchesAction;
  });

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32">
      <AmbientBackground />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600" />
              {t('logs_title')}
            </h1>
            <p className="text-sm text-slate-500">{t('logs_subtitle')}</p>
          </div>
        </div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
        >
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>

            {/* Module Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
              >
                {modules.map(m => (
                  <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
            >
              {actions.map(a => (
                <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Logs List */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">
              Activity Log
              <span className="ml-2 px-2 py-0.5 bg-slate-200 rounded-lg text-xs">{filteredLogs.length}</span>
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No activity logs found</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <li 
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 border",
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                        {log.action}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{log.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.userName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.timestamp)}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase">
                            {log.module}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        {/* Detail Modal */}
        {selectedLog && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Log Details</h3>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold mb-1">Action</p>
                  <span className={cn("px-3 py-1 rounded-lg text-xs font-bold border", getActionColor(selectedLog.action))}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold mb-1">Description</p>
                  <p className="text-slate-700">{selectedLog.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">User</p>
                    <p className="text-slate-700">{selectedLog.userName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Module</p>
                    <p className="text-slate-700">{selectedLog.module}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold mb-1">Timestamp</p>
                  <p className="text-slate-700">{formatDate(selectedLog.timestamp)}</p>
                </div>
                {selectedLog.oldValues && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Old Values</p>
                    <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newValues && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">New Values</p>
                    <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
