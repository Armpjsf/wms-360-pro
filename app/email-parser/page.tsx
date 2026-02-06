'use client';

import { useState } from 'react';
import { Mail, RefreshCw, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';

export default function EmailParserPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    setLoading(true);
    setLogs(['Initiating Gmail Scan...', 'Checking for unread emails from formica.com...']);
    setResult(null);

    try {
        const res = await fetch('/api/email/scan', { method: 'POST' });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Scan failed');

        setLogs(prev => [...prev, `Found ${data.processed} emails with valid attachments.`]);
        if (data.details) {
            data.details.forEach((d: any) => {
                setLogs(prev => [...prev, `✅ Parsed ${d.file}: Found ${d.data.length} customers.`]);
            });
        }
        setResult(data);

    } catch (error: any) {
        setLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-500/10 rounded-xl">
          <Mail className="w-8 h-8 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">ระบบดึงข้อมูลอีเมล (Email Automation)</h1>
          <p className="text-slate-400 text-sm">สแกนอีเมล คัดแยกไฟล์ Excel และนำเข้า Roll Tag อัตโนมัติ</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
         <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-6">
             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto relative">
                 <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                 {loading && (
                     <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                 )}
             </div>
             
             <div>
                <h2 className="text-xl font-bold text-white mb-2">พร้อมทำงาน</h2>
                <p className="text-slate-500 max-w-md mx-auto">
                    ระบบจะค้นหาอีเมลที่ยังไม่ได้อ่านจาก <b>formica.com</b> ที่มีไฟล์แนบ .xlsx/.csv และนำเข้าข้อมูลสู่ Roll Tag 1 & 2
                </p>
             </div>

             <button 
                onClick={handleScan}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 mx-auto"
             >
                {loading ? 'กำลังทำงาน...' : 'เริ่มสแกนอีเมล'}
             </button>
         </div>

         {/* Logs Console */}
         <div className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto">
             <div className="text-slate-500 mb-2 border-b border-slate-800 pb-2">Console Output_</div>
             <div className="space-y-1">
                 {logs.length === 0 && <span className="text-slate-700 opacity-50">Waiting for command...</span>}
                 {logs.map((log, i) => (
                     <div key={i} className={`
                        ${log.includes('Error') ? 'text-red-400' : ''}
                        ${log.includes('Success') || log.includes('✅') ? 'text-green-400' : 'text-slate-300'}
                     `}>
                        <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
}
