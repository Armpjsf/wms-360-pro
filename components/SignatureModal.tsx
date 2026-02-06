'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { X, Check, Trash2 } from 'lucide-react';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => Promise<void>;
    docNum: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, docNum }: SignatureModalProps) {
    const sigCanvasRef = useRef<any>(null);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

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
            await onSave(dataUrl);
            onClose();
        } catch (error) {
            console.error("Signature Save Failed", error);
            alert("Failed to save signature");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col pt-safe-area backdrop-blur-sm animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-4 md:px-6">
                <div>
                    <h2 className="text-xl font-bold text-white">Sign for {docNum}</h2>
                    <p className="text-slate-400 text-xs">Customer Acknowledgement</p>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-3 bg-slate-800/80 rounded-full text-white hover:bg-slate-700 transition"
                    disabled={saving}
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            {/* Canvas Container - Constrained Height for Landscape Signature */}
            <div className="h-64 bg-white mx-4 mb-4 rounded-2xl overflow-hidden border-4 border-slate-700 relative shadow-2xl shrink-0">
                 <SignatureCanvas 
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                 />
                 
                 {/* Watermark / Guide */}
                 <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none opacity-10 text-slate-900 font-black text-3xl select-none">
                    SIGN HERE
                 </div>
                 <div className="absolute top-1/2 left-4 right-4 h-px bg-slate-200 -translate-y-1/2 pointer-events-none" />

                 {/* Floating Clear Button */}
                 <button 
                    onClick={handleClear}
                    className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-600 rounded-full shadow-sm hover:bg-red-50 hover:text-red-500 transition"
                    title="Clear Signature"
                 >
                     <Trash2 className="w-5 h-5" />
                 </button>
            </div>

            {/* Actions */}
            <div className="px-4 pb-8 md:pb-10 pt-2">
                <button 
                    onClick={handleConfirm}
                    disabled={saving}
                    className={`w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-lg shadow-xl shadow-green-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${saving ? 'opacity-70 cursor-wait' : ''}`}
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
            </div>
        </div>
    );
}
