'use client';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Chart({ data }: { data: { day: string; spending: number }[] }) {
	return (
		<div className="h-60" aria-label="Spending trend chart">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
					<defs>
						<linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
							<stop stopColor="#36c2a1" stopOpacity="0.62" />
							<stop offset="1" stopColor="#36c2a1" stopOpacity="0.03" />
						</linearGradient>
					</defs>
					<XAxis
						dataKey="day"
						tickLine={false}
						axisLine={false}
						fontSize={12}
						stroke="var(--text-muted)"
						tickMargin={10}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						fontSize={12}
						stroke="var(--text-muted)"
						tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`}
					/>
					<Tooltip
						cursor={{ stroke: '#36c2a1', strokeDasharray: '5 4', strokeOpacity: 0.35 }}
						contentStyle={{
							borderRadius: 12,
							border: '1px solid var(--line)',
							backgroundColor: 'var(--surface-strong)',
							boxShadow: 'var(--shadow)',
							color: 'var(--text)',
						}}
						formatter={(value) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value)), 'Spent']}
					/>
					<Area dataKey="spending" stroke="#1ea97c" strokeWidth={2.5} fill="url(#g)" />
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
