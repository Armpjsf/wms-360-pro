'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Save, Trash2, Plus, ArrowLeft, RefreshCw, AlertCircle, Link as LinkIcon, Palette } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';

interface BranchConfig {
    id: string;
    name: string;
    spreadsheetId: string;
    color: string;
    status: 'Active' | 'Inactive';
}

export default function AdminBranchesPage() {
    const { sendNotification } = useNotification();
    const [branches, setBranches] = useState<BranchConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<Partial<BranchConfig>>({
        id: '',
        name: '',
        spreadsheetId: '',
        color: 'slate'
    });

    const colors = ['slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

    const fetchData = () => {
        setLoading(true);
        fetch(getApiUrl('/api/branches'))
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBranches(data);
                else setBranches([]);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchData() }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.id || !formData.name || !formData.spreadsheetId) {
            sendNotification('Error', { body: 'Please fill in all required fields.' });
            return;
        }

        try {
            const res = await fetch(getApiUrl('/api/branches'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                sendNotification('Success', { body: 'Branch saved successfully!' });
                setIsAdding(false);
                setFormData({ id: '', name: '', spreadsheetId: '', color: 'slate' });
                fetchData();
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            sendNotification('Error', { body: 'Failed to save branch.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this branch?')) return;

        try {
            const res = await fetch(getApiUrl(`/api/branches?id=${id}`), {
                method: 'DELETE'
            });

            if (res.ok) {
                sendNotification('Success', { body: 'Branch deactivated.' });
                fetchData();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            sendNotification('Error', { body: 'Failed to delete branch.' });
        }
    };

    return (
        <div className="min-h-screen p-8 bg-slate-50 relative overflow-hidden">
             <AmbientBackground />
             
             <div className="max-w-5xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <Link href="/admin" className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Branch Management</h1>
                        <p className="text-slate-500 font-medium">Configure locations and spreadsheet connections</p>
                    </div>
                    <button onClick={fetchData} className="ml-auto p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Add Branch
                    </button>
                </div>

                <AnimatePresence>
                {isAdding && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, mb: 0 }}
                        animate={{ opacity: 1, height: 'auto', mb: 24 }}
                        exit={{ opacity: 0, height: 0, mb: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100">
                            <h3 className="font-bold text-lg text-slate-800 mb-6">New Branch Details</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Branch ID (Slug)</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. branch-2"
                                        value={formData.id}
                                        onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Unique identifier, lowercase, no spaces.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Display Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Chiang Mai Branch"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Google Spreadsheet ID</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="1nIIVyTTtu4VAm..."
                                            value={formData.spreadsheetId}
                                            onChange={e => setFormData({...formData, spreadsheetId: e.target.value})}
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Found in the Google Sheet URL: /spreadsheets/d/<b>ID</b>/edit</p>
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Branch Color</label>
                                     <div className="flex flex-wrap gap-2">
                                        {colors.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({...formData, color})}
                                                className={cn(
                                                    "w-8 h-8 rounded-full border-2 transition-all",
                                                    formData.color === color ? "border-slate-800 scale-110" : "border-transparent hover:scale-105",
                                                    `bg-${color}-500`
                                                )}
                                            />
                                        ))}
                                     </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">Save Branch</button>
                            </div>
                        </form>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 text-slate-400">Loading branches...</div>
                    ) : branches.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border dashed border-slate-200">
                            <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-800">No Branches Configured</h3>
                            <p className="text-slate-500 mb-6">Start by adding your first branch configuration.</p>
                            <button onClick={() => setIsAdding(true)} className="text-indigo-600 font-bold hover:underline">Add Branch</button>
                        </div>
                    ) : (
                        branches.map((branch) => (
                            <motion.div 
                                key={branch.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-5 group hover:border-indigo-100 transition-colors"
                            >
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md", `bg-${branch.color}-500`)}>
                                    <Building2 className="w-6 h-6" />
                                </div>
                                
                                <div className="flex-1">
                                    <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        {branch.name}
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{branch.id}</span>
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                         <LinkIcon className="w-3 h-3 text-slate-400" />
                                         <code className="text-xs text-slate-400 font-mono bg-slate-50 px-1 rounded">{branch.spreadsheetId}</code>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleDelete(branch.id)}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Deactivate Branch"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
             </div>
        </div>
    );
}
