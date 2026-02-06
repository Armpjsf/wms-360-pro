
'use client';

import { useOfflineSync } from "@/hooks/useOfflineSync";
import { WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  // Show if offline OR if there are pending items (even if online, show they are syncing)
  const show = !isOnline || pendingCount > 0;

  return (
    <AnimatePresence>
        {show && (
            <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className={cn(
                    "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border",
                    !isOnline ? "bg-slate-900/90 text-white border-slate-700" : "bg-indigo-600/90 text-white border-indigo-400"
                )}
            >
                {!isOnline ? (
                    <div className="bg-white/10 p-2 rounded-full">
                        <WifiOff className="h-4 w-4" />
                    </div>
                ) : (
                    <div className="bg-white/10 p-2 rounded-full animate-spin">
                        <RefreshCw className="h-4 w-4" />
                    </div>
                )}
                
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                        {!isOnline ? "Offline Mode" : "Syncing Data..."}
                    </h3>
                    <p className="text-[10px] opacity-80 font-medium">
                        {pendingCount} action{pendingCount !== 1 ? 's' : ''} queued
                    </p>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
  );
}
