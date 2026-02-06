'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select...", disabled = false }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-950 border ${
          isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800'
        } rounded-xl p-4 text-white cursor-pointer flex justify-between items-center transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-700'
        }`}
      >
        <span className={selectedOption ? "text-white" : "text-slate-500"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-slate-500" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-slate-600"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No results found</div>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`p-3 text-sm cursor-pointer flex justify-between items-center hover:bg-slate-800 transition-colors ${
                      value === opt.value ? 'bg-slate-800' : ''
                    }`}
                  >
                    <div>
                      <div className="text-white font-medium">{opt.label}</div>
                      {opt.subLabel && <div className="text-xs text-slate-500">{opt.subLabel}</div>}
                    </div>
                    {value === opt.value && <Check className="w-4 h-4 text-blue-500" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
