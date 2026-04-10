'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { X, Check, Trash2 } from 'lucide-react';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string, packs: number, location: string) => Promise<void>;
    docNum: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, docNum }: SignatureModalProps) {
    const sigCanvasRef = useRef<any>(null);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [packs, setPacks] = useState<string | number>(1);
    const [location, setLocation] = useState<string>("");

    // Set mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleClear = () => {
        sigCanvasRef.current?.clear();
    };

    const handleConfirm = async () => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            alert("Please sign before confirming.");
            return;
        }

        setSaving(true);
        try {
            // Get trimmed base64
            const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
            const numericPacks = typeof packs === 'string' ? (parseInt(packs) || 0) : packs;
            await onSave(dataUrl, numericPacks, location);
            onClose();
        } catch (error) {
            console.error("Signature Save Failed", error);
            alert("Failed to save signature");
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] bg-black/40 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Modal Card */}
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white">Sign for {docNum}</h2>
                        <p className="text-slate-400 text-xs">Customer Acknowledgement</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        disabled={saving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Canvas Container */}
                <div className="p-6 overflow-y-auto">
                    {/* Location Input */}
                    <div className="mb-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">สถานที่จัดส่ง (Delivery Location)</label>
                        <textarea 
                            value={location} 
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="ระบุสถานที่จัดส่ง..."
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-sm outline-none focus:border-indigo-500 resize-none h-20"
                        />
                    </div>

                    {/* Packs Input */}
                    <div className="mb-6 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">จำนวนแพ็ก (Number of Packs)</label>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setPacks(Math.max(1, packs - 1))}
                                className="w-12 h-12 bg-slate-700 rounded-xl text-white font-black text-xl flex items-center justify-center active:scale-95 transition-transform"
                            >-</button>
                            <input 
                                type="number" 
                                value={packs} 
                                onChange={(e) => setPacks(parseInt(e.target.value) || 1)}
                                className="flex-1 bg-transparent text-white text-3xl font-black text-center outline-none"
                            />
                            <button 
                                onClick={() => setPacks(packs + 1)}
                                className="w-12 h-12 bg-indigo-600 rounded-xl text-white font-black text-xl flex items-center justify-center active:scale-95 transition-transform"
                            >+</button>
                        </div>
                    </div>

                    <div className="h-64 bg-white rounded-2xl overflow-hidden border-2 border-slate-700 relative shadow-inner shrink-0 mb-6">
                        <SignatureCanvas 
                            ref={sigCanvasRef}
                            penColor="black"
                            backgroundColor="white"
                            canvasProps={{ 
                                className: 'w-full h-full cursor-crosshair touch-none',
                                style: { touchAction: 'none' }
                            }}
                         />
                         
                         {/* Watermark / Guide */}
                         <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none opacity-10 text-slate-900 font-black text-3xl select-none">
                            SIGN HERE
                         </div>
                         <div className="absolute top-1/2 left-4 right-4 h-px bg-slate-100 -translate-y-1/2 pointer-events-none" />
        
                         {/* Floating Clear Button */}
                         <button 
                            onClick={handleClear}
                            className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-500 transition-colors"
                            title="Clear Signature"
                         >
                             <Trash2 className="w-4 h-4" />
                         </button>
                    </div>
        
                    {/* Actions */}
                    <button 
                        onClick={handleConfirm}
                        disabled={saving}
                        className={`w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${saving ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {saving ? (
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check className="w-6 h-6" />
                                CONFIRM SIGNATURE
                            </>
                        )}
                    </button>
                    <button 
                        onClick={onClose}
                        disabled={saving}
                        className="w-full mt-3 text-slate-500 hover:text-slate-300 font-bold py-2 text-sm transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

