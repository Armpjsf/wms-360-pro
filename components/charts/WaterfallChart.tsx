"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const WaterfallChart = ({ data }: { data: any[] }) => {
  // Config for waterfall coloring
  const getBarColor = (name: string, value: number) => {
    if (name === 'Closing') return '#8b5cf6'; // Violet (Final)
    if (name === 'Opening') return '#22c55e'; // Green (Start)
    if (name === 'Outbound') return '#f43f5e'; // Red (Negative)
    if (name === 'Damage') return '#a855f7'; // Purple/Red (Loss) - Let's use Red or distinct
    if (value < 0) return '#f43f5e'; // Fallback
    return '#10b981'; // Emerald (Positive/Inbound)
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="#cbd5e1" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b' }}
        />
        <YAxis 
          stroke="#cbd5e1" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b' }}
        />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{ 
            backgroundColor: '#ffffff', 
            borderColor: '#e2e8f0',
            borderRadius: '0.5rem',
            fontSize: '12px',
            color: '#1e293b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          itemStyle={{ color: '#1e293b' }}
          formatter={(value: any) => [Math.abs(value), 'Quantity']}
        />
        <Bar dataKey="value" stackId="a" fill="transparent" />
        <Bar dataKey="barValue" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.name, entry.barValue)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WaterfallChart;
