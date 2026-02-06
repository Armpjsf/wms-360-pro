
'use client';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';

interface StockData {
    date: string;
    stock: number;
    predicted?: boolean;
}

interface Props {
    data: StockData[];
    productName: string;
    burnRate: number;
    daysLeft: number;
}

export default function StockDepletionChart({ data, productName, burnRate, daysLeft }: Props) {
    // Determine color based on risk
    let lineColor = "#10b981"; // Green
    if (daysLeft < 7) lineColor = "#ef4444"; // Red
    else if (daysLeft < 14) lineColor = "#f59e0b"; // Orange

    // Add a reference line for today if we have mixed data
    const todayIndex = data.findIndex(d => d.predicted === true);
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Stock Depletion Projection</h3>
                    <p className="text-sm text-slate-500">
                        Visualizing burnout for <span className="font-bold text-indigo-600">{productName}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Burn Rate</p>
                    <p className="text-xl font-black text-slate-700">
                        {burnRate.toFixed(1)} <span className="text-xs font-normal text-slate-400">/day</span>
                    </p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                            tickMargin={10}
                        />
                        <YAxis 
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Legend />
                        
                        {/* Historical Line */}
                        <Line 
                            type="monotone" 
                            dataKey="stock" 
                            name="Stock Level" 
                            stroke={lineColor} 
                            strokeWidth={3}
                            dot={{ r: 3, fill: lineColor }}
                            activeDot={{ r: 6 }}
                        />

                        {/* Zero Line */}
                        <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                        
                        {/* Today Marker */}
                        {todayIndex > 0 && (
                            <ReferenceLine x={data[todayIndex].date} stroke="#6366f1" label="Today" strokeDasharray="5 5" />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
