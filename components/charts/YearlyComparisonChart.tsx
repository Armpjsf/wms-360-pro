"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface YearlyComparisonProps {
  data: {
    month: string;
    outYear1: number;
    outYear2: number;
    inYear1: number;
    inYear2: number;
  }[];
  year1Label?: string;
  year2Label?: string;
}

export default function YearlyComparisonChart({ data, year1Label = "This Year", year2Label = "Last Year" }: YearlyComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="month" 
          stroke="#94a3b8" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis 
          stroke="#94a3b8" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => `${value}`} 
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          itemStyle={{ color: '#1e293b', fontSize: '12px', fontWeight: 600 }}
          formatter={(value: any) => [value?.toLocaleString() || '0', 'Qty'] as [string, string]}
        />
        <Legend 
            verticalAlign="top" 
            align="right" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', fontWeight: 500 }}
        />
        {/* Inbound Bars */}
        <Bar 
          name={`Inbound ${year2Label}`} 
          dataKey="inYear2" 
          fill="#bbf7d0" // Green-200
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Inbound ${year1Label}`} 
          dataKey="inYear1" 
          fill="#10b981" // Emerald-500
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        
        {/* Outbound Bars */}
        <Bar 
          name={`Outbound ${year2Label}`} 
          dataKey="outYear2" 
          fill="#cbd5e1" // Slate-300
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Outbound ${year1Label}`} 
          dataKey="outYear1" 
          fill="#6366f1" // Indigo-500
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
