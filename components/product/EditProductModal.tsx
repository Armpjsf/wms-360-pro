
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

interface Product {
    id: string;
    name: string;
    category: string;
    price: number;
    minStock: number;
    stock: number;
    unit: string;
    location: string;
}

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

export default function EditProductModal({ isOpen, onClose, product, onSuccess }: EditProductModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        name: product.name,
        category: product.category,
        price: product.price,
        minStock: product.minStock,
        location: product.location
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(getApiUrl('/api/products/update'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldName: product.name, // Key to find row
                    updates: formData
                })
            });

            if (!res.ok) throw new Error('Failed to update');

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError('บันทึกไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลสินค้า</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อสินค้า (Product Name)</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                required
                            />
                            <p className="text-xs text-slate-400 mt-1">*การเปลี่ยนชื่ออาจมีผลต่อประวัติ Transaction เก่า</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">ราคา (Price)</label>
                                <input 
                                    type="number" 
                                    value={formData.price}
                                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">หมวดหมู่ (Category)</label>
                                <input 
                                    type="text" 
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">จุดสั่งซื้อ (Min Stock)</label>
                                <input 
                                    type="number" 
                                    value={formData.minStock}
                                    onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value)})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">ที่เก็บ (Location)</label>
                                <input 
                                    type="text" 
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                    className="w-full p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            บันทึก
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
