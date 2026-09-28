import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { X, Check, Trash2, RotateCw } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { appAlert } from '@/components/ui/MobileDialog';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

// ตัดขอบขาวรอบลายเซ็นออก เหลือเฉพาะเส้นหมึก (+ขอบเล็กน้อย)
// getTrimmedCanvas() ของไลบรารีตัดเฉพาะพิกเซลโปร่งใส แต่ผืนผ้าใบเป็นพื้นขาว เลยไม่ได้ตัดอะไรเลย
// -> ส่งทั้งผืนไป แล้ว PDF ย่อทั้งผืนลงช่องเซ็น ลายเซ็นจริงจึงเล็กมาก
function cropToInk(source: HTMLCanvasElement, pad = 12): HTMLCanvasElement {
    const ctx = source.getContext('2d');
    if (!ctx) return source;
    const { width, height } = source;
    const px = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // หมึก = พิกเซลทึบที่ไม่ขาว
            if (px[i + 3] > 0 && (px[i] < 200 || px[i + 1] < 200 || px[i + 2] < 200)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return source;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    if (!octx) return source;
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, w, h);
    octx.drawImage(source, minX, minY, w, h, 0, 0, w, h);
    return out;
}


// หมุนรูป 90° ทวนเข็ม — ใช้กับลายเซ็นที่เซ็นตอนจอเป็นแนวตั้ง
// (หน้าจอแนวตั้งจัด UI ตะแคงไว้ ให้ลูกค้าหมุนเครื่องทวนเข็มแล้วเซ็นตามแนวยาว
//  สิ่งที่ลูกค้าเห็นว่า "ซ้าย→ขวา" คือ "บน→ล่าง" ของจอ จึงต้องหมุนกลับให้ตั้งตรง)
function rotateCCW(source: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = source.height;
    out.height = source.width;
    const ctx = out.getContext('2d');
    if (!ctx) return source;
    ctx.translate(0, source.width);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(source, 0, 0);
    return out;
}

function useIsPortrait() {
    const query = '(orientation: portrait)';
    const [portrait, setPortrait] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches
    );
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setPortrait(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return portrait;
}

// Maximum smoothness configuration
const MemoizedSignaturePad = memo(({ sigRef, onClear, portrait }: { sigRef: any, onClear: () => void, portrait: boolean }) => {
    const { t } = useLanguage();

    // Effect to handle canvas resolution for high-DPI screens
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = sigRef.current?.getCanvas();
            if (canvas) {
                const ratio = Math.max(window.devicePixelRatio || 1, 2);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d")?.scale(ratio, ratio);
                sigRef.current?.clear(); // Need to clear after resize to fix scaling
            }
        };

        window.addEventListener("resize", resizeCanvas);
        // Initial delay to ensure offsetWidth is ready
        const timer = setTimeout(resizeCanvas, 100);

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            clearTimeout(timer);
        };
    }, [sigRef, portrait]);

    return (
        <div className="flex-1 bg-white relative shadow-inner touch-none overflow-hidden">
            <SignatureCanvas
                ref={sigRef}
                penColor="black"
                backgroundColor="white"
                // Performance & Smoothness Tuning
                velocityFilterWeight={0} // Raw input for zero lag
                minWidth={2}
                maxWidth={3.5}
                dotSize={2.5}
                throttle={0}
                minDistance={0}
                canvasProps={{
                    className: 'w-full h-full cursor-crosshair',
                    style: { touchAction: 'none' }
                }}
            />

            {/* Watermark (แนวตั้ง: ตะแคงตามทิศที่ลูกค้าจะหมุนเครื่อง) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none">
                <span className={`text-8xl font-black uppercase whitespace-nowrap ${portrait ? 'rotate-90' : 'rotate-[-20deg]'}`}>{t('sign_here')}</span>
            </div>

            {/* เส้นนำให้เซ็นเต็มพื้นที่ (เป็น DOM ไม่ติดไปในรูปลายเซ็น)
                แนวตั้ง: "ด้านล่าง" ของลูกค้า (หลังหมุนเครื่อง) คือขอบซ้ายของจอ */}
            {portrait ? (
                <div className="absolute top-6 bottom-6 left-[22%] border-l-2 border-dashed border-slate-200 pointer-events-none" />
            ) : (
                <div className="absolute left-6 right-6 bottom-[22%] border-b-2 border-dashed border-slate-200 pointer-events-none" />
            )}

            {/* Floating Clear Button */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    onClear();
                }}
                className="absolute top-4 right-4 p-3 bg-slate-100 text-slate-400 rounded-full shadow-md hover:bg-rose-50 hover:text-rose-500 transition-all z-10 active:scale-90"
                title="Clear Signature"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </div>
    );
});

MemoizedSignaturePad.displayName = 'MemoizedSignaturePad';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => Promise<void>;
    docNum: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, docNum }: SignatureModalProps) {
    const { t } = useLanguage();
    const sigCanvasRef = useRef<any>(null);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const portrait = useIsPortrait();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleClear = () => {
        sigCanvasRef.current?.clear();
    };

    const handleConfirm = async () => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            appAlert(t('sign_instruction'));
            return;
        }

        setSaving(true);
        try {
            const canvas: HTMLCanvasElement = sigCanvasRef.current.getCanvas();
            // ตัดสินจากรูปทรงผืนผ้าใบจริงตอนเซ็น (สูงกว่ากว้าง = จอแนวตั้ง -> UI ตะแคง)
            const signedSideways = canvas.height > canvas.width;
            const cropped = cropToInk(canvas);
            const upright = signedSideways ? rotateCCW(cropped) : cropped;
            const dataUrl = upright.toDataURL('image/jpeg', 0.85);
            await onSave(dataUrl);
            onClose();
        } catch (error) {
            console.error("Signature Save Failed", error);
            appAlert('บันทึกลายเซ็นไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    };

    const confirmInner = saving ? (
        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
    ) : (
        <>
            <Check className="w-5 h-5" />
            {t('confirm_signature')}
        </>
    );

    // จอแนวตั้ง: จัดทุกอย่างตะแคง 90° ให้ลูกค้าหมุนเครื่องเป็นแนวนอน (หัวเครื่องไปทางซ้าย)
    // แล้วเซ็นตามแนวยาวของจอ แถบปุ่มอยู่ขอบซ้าย = ด้านล่างเมื่อหมุนเครื่อง
    // ถ้าเครื่องหมุนจอตามเองเป็นแนวนอน จะได้ layout แนวนอนปกติและไม่ต้องหมุนรูป
    const portraitLayout = (
        <div className="w-full h-full flex flex-row">
            <div className="w-16 bg-slate-900 border-r border-slate-800 py-3 flex flex-col items-center justify-between gap-3 shrink-0">
                {/* ข้อความตะแคง: อ่านจากบนลงล่าง = อ่านซ้ายไปขวาเมื่อหมุนเครื่อง */}
                <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                    <div className="rotate-90 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 text-indigo-400 text-[11px] font-bold">
                            <RotateCw className="w-4 h-4 -scale-x-100" />
                            หมุนโทรศัพท์เป็นแนวนอน แล้วเซ็นตามแนวยาว
                        </div>
                        <div className="text-white font-black text-base leading-tight">
                            {t('sign_title')} <span className="text-slate-500 text-[11px] font-mono font-normal">{docNum}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-12 h-24 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center active:scale-95"
                    >
                        <span className="rotate-90 whitespace-nowrap">{t('btn_cancel')}</span>
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className="w-12 h-52 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-900/40 flex items-center justify-center active:scale-95"
                    >
                        <span className="rotate-90 whitespace-nowrap flex items-center gap-2">{confirmInner}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col relative bg-white">
                <MemoizedSignaturePad sigRef={sigCanvasRef} onClear={handleClear} portrait />
            </div>
        </div>
    );

    const landscapeLayout = (
        <div className="w-full h-full flex flex-row">
            <div className="w-44 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between gap-2 shrink-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <RotateCw className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('landscape_mode')}</span>
                    </div>
                    <h2 className="text-lg font-black text-white leading-tight truncate">{t('sign_title')}</h2>
                    <p className="text-slate-500 text-[11px] font-mono truncate">{docNum}</p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-4 py-4 rounded-xl font-black text-sm shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {confirmInner}
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-bold text-xs transition-all active:scale-95"
                    >
                        {t('btn_cancel')}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col relative bg-white">
                <MemoizedSignaturePad sigRef={sigCanvasRef} onClear={handleClear} portrait={false} />
            </div>
        </div>
    );

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
        >
            {portrait ? portraitLayout : landscapeLayout}
        </div>
    );

    return createPortal(modalContent, document.body);
}
