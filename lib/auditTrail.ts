// Audit Trail Utility for WMS 360
// Logs user actions for tracking changes (Persistent via Google Sheets)

import { appendAuditLog, fetchAuditLogsFromSheet, AuditLogEntry } from './googleSheets';

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  module: string; 
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
}

// Log an action (Async)
export async function logAction(params: {
  userId: string;
  userName: string;
  action: AuditLog['action'];
  module: string;
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}) {
  const timestamp = new Date().toISOString();
  
  const entry: AuditLogEntry = {
      timestamp,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      module: params.module,
      recordId: params.recordId || '',
      description: params.description,
      ipAddress: ''
  };

  // Fire and forget (don't block UI strictly, but if awaited it waits)
  await appendAuditLog(entry);
  
  console.log('[Audit]', params.action, params.module, params.description);
  return entry;
}

// Get audit logs (Async)
export async function getAuditLogs(params?: {
  module?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  let filtered = await fetchAuditLogsFromSheet();
  
  if (params?.module) {
    filtered = filtered.filter((l: any) => l.module === params.module);
  }
  
  if (params?.action) {
    filtered = filtered.filter((l: any) => l.action === params.action);
  }
  
  if (params?.userId) {
    filtered = filtered.filter((l: any) => l.userId === params.userId);
  }
  
  // Date filtering on string timestamp? 
  // Standard format ISO, comparison works lexically or convert.
  // ... Simplified for now.
  
  return filtered.slice(0, params?.limit || 100);
}

// Clear all logs (Not implemented for Sheets yet)
export function clearAuditLogs() {
  // no-op
}

// Get action color
export function getActionColor(action: AuditLog['action']): string {
  switch (action) {
    case 'CREATE': return 'bg-emerald-100 text-emerald-700';
    case 'UPDATE': return 'bg-blue-100 text-blue-700';
    case 'DELETE': return 'bg-rose-100 text-rose-700';
    case 'VIEW': return 'bg-slate-100 text-slate-700';
    case 'EXPORT': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// Format timestamp
export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
