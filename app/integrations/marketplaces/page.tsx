'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Printer,
  Copy,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Sparkles,
  Settings2,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  parseMarketplaceFile,
  NormalizedMarketplaceOrder,
  MarketplacePlatform,
} from '@/lib/marketplaceParser';
import { triggerHaptic } from '@/lib/voiceAssistant';

type ActiveTab = 'IMPORT' | 'API_CONFIG' | 'HISTORY';

export default function MarketplaceIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('IMPORT');

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<NormalizedMarketplaceOrder[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<MarketplacePlatform | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);

  // API Config State (Future Readiness)
  const [shopeeConfig, setShopeeConfig] = useState({
    partnerId: '',
    partnerKey: '',
    shopId: '',
    enabled: false,
  });

  const [tiktokConfig, setTiktokConfig] = useState({
    appKey: '',
    appSecret: '',
    shopCipher: '',
    enabled: false,
  });

  const [lazadaConfig, setLazadaConfig] = useState({
    appKey: '',
    appSecret: '',
    accessToken: '',
    enabled: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process File
  const handleFile = async (file: File) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseMarketplaceFile(buffer);

      if (result.orders.length === 0) {
        toast.error('ไม่พบรายการคำสั่งซื้อในไฟล์');
        return;
      }

      setParsedOrders(result.orders);
      setDetectedPlatform(result.platform);
      triggerHaptic('success');
      toast.success(
        `นำเข้าสำเร็จ! พบ ${result.totalOrders} ออเดอร์ (${result.totalItemsCount} รายการ) จาก ${result.platform}`
      );
    } catch (e: any) {
      console.error('Error parsing file:', e);
      triggerHaptic('error');
      toast.error('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCopyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('คัดลอก Webhook URL แล้ว!');
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-slate-50">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-orange-200 bg-white/90 p-6 shadow-xl shadow-orange-900/5 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-blue-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-3 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 text-orange-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
                  <ShoppingBag className="w-8 h-8 text-orange-600" />
                  Marketplace Integration Hub
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  เชื่อมต่อคำสั่งซื้อ Shopee, TikTok Shop, Lazada • นำเข้าไฟล์ออเดอร์ • รองรับการเชื่อมต่อ API ในอนาคต
                </p>
              </div>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-orange-100 text-orange-800 font-bold rounded-lg text-xs border border-orange-200">
                Shopee
              </span>
              <span className="px-3 py-1 bg-slate-900 text-cyan-300 font-bold rounded-lg text-xs border border-slate-800">
                TikTok
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-xs border border-blue-200">
                Lazada
              </span>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              activeTab === 'IMPORT'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าไฟล์คำสั่งซื้อ (Smart Excel/CSV)
          </button>

          <button
            onClick={() => setActiveTab('API_CONFIG')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              activeTab === 'API_CONFIG'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <Settings2 className="w-4 h-4" />
            ตั้งค่าการเชื่อมต่อ API (Direct API Readiness)
          </button>
        </div>

        {/* TAB 1: SMART FILE IMPORTER */}
        {activeTab === 'IMPORT' && (
          <div className="space-y-6">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-white shadow-sm flex flex-col items-center justify-center space-y-4',
                isDragging
                  ? 'border-orange-500 bg-orange-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-orange-400 hover:bg-orange-50/20'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl border border-orange-200">
                <UploadCloud className="w-10 h-10" />
              </div>

              <div className="max-w-md space-y-1">
                <h3 className="text-base font-black text-slate-800">
                  ลากไฟล์ Excel / CSV คำสั่งซื้อมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  รองรับไฟล์ Export จาก <strong>Shopee Seller Centre</strong>, <strong>TikTok Shop</strong>,{' '}
                  <strong>Lazada</strong> หรือไฟล์ออเดอร์ทั่วไป (.xlsx, .csv)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-mono">
                  .XLSX
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-mono">
                  .CSV
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-mono">
                  Auto Platform Detection
                </span>
              </div>
            </div>

            {/* Parsed Orders Preview Table */}
            {parsedOrders.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 font-mono font-black text-xs rounded-md">
                        {detectedPlatform}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ไฟล์: {fileName}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">
                      พบคำสั่งซื้อทั้งหมด {new Set(parsedOrders.map(o => o.orderNo)).size} ออเดอร์ ({parsedOrders.length} รายการ)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/ops/wave-picking"
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Boxes className="w-4 h-4" /> ส่งเข้า Wave Picking ทันที
                    </Link>

                    <Link
                      href="/barcode/thermal-labels"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4" /> พิมพ์ใบปะหน้า 100x150
                    </Link>

                    <button
                      onClick={() => {
                        setParsedOrders([]);
                        setDetectedPlatform(null);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">แพลตฟอร์ม</th>
                        <th className="py-2.5 px-3">เลขออเดอร์ (Order No)</th>
                        <th className="py-2.5 px-3">ผู้รับ (Customer)</th>
                        <th className="py-2.5 px-3">รหัสสินค้า (SKU)</th>
                        <th className="py-2.5 px-3">ชื่อสินค้า</th>
                        <th className="py-2.5 px-3 text-center">จำนวน</th>
                        <th className="py-2.5 px-3">เลขพัสดุ (Tracking)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedOrders.map((ord, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                              {ord.platform}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{ord.orderNo}</td>
                          <td className="py-2.5 px-3">{ord.customerName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-orange-700">{ord.sku}</td>
                          <td className="py-2.5 px-3 truncate max-w-[200px]">{ord.productName}</td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-900 text-sm">
                            {ord.qty}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {ord.trackingNo || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DIRECT API CONFIGURATIONS (Future Readiness) */}
        {activeTab === 'API_CONFIG' && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-blue-950">โครงสร้างรองรับการเชื่อมต่อ Direct API</h4>
                <p className="mt-0.5 leading-relaxed text-blue-800">
                  ระบบได้เตรียมฟิลด์ Credential และ Webhook Endpoints สำหรับแต่ละแพลตฟอร์มไว้แล้ว เมื่อคุณพร้อมสมัครบัญชี Developer สามารถนำ Key มากรอกเพื่อเปิดใช้งานได้ทันที
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SHOPEE CARD */}
              <div className="bg-white border-2 border-orange-200 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black text-sm">
                      S
                    </div>
                    <h3 className="font-black text-slate-900">Shopee Open API</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Partner ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 2005432"
                      value={shopeeConfig.partnerId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Partner Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={shopeeConfig.partnerKey}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerKey: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Shop ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 98765432"
                      value={shopeeConfig.shopId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, shopId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg text-[10px] font-mono text-slate-600 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/shopee</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/shopee')}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TIKTOK CARD */}
              <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-950 text-cyan-400 flex items-center justify-center font-black text-sm">
                      TT
                    </div>
                    <h3 className="font-black text-slate-900">TikTok Shop Partner</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 6xxyyzz"
                      value={tiktokConfig.appKey}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={tiktokConfig.appSecret}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Shop Cipher</label>
                    <input
                      type="text"
                      placeholder="e.g. ROW_xyz..."
                      value={tiktokConfig.shopCipher}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, shopCipher: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg text-[10px] font-mono text-slate-600 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/tiktok</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/tiktok')}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* LAZADA CARD */}
              <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                      L
                    </div>
                    <h3 className="font-black text-slate-900">Lazada Open Platform</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 102938"
                      value={lazadaConfig.appKey}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={lazadaConfig.appSecret}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Access Token</label>
                    <input
                      type="text"
                      placeholder="e.g. 50000..."
                      value={lazadaConfig.accessToken}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, accessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg text-[10px] font-mono text-slate-600 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/lazada</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/lazada')}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
