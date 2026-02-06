"use client";

import { motion } from "framer-motion";

export const AmbientBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      {/* Top Right - Indigo/Blue */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 2 }}
        className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[100px] bg-gradient-to-br from-indigo-200 to-blue-200"
      />
      
      {/* Bottom Left - Rose/Orange */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[100px] bg-gradient-to-tr from-rose-100 to-orange-100"
      />

      {/* Center - Subtle Pulse */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full blur-[120px] bg-slate-200"
      />
    </div>
  );
};
