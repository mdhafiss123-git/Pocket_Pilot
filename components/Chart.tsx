'use client';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Chart({
	data,
	currency = 'INR',
}: {
	data: { day: string; spending: number }[];
	currency?: string;
}) {
	const formatter = new Intl.NumberFormat('en', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0,
	});

	const symbol =
		formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? '';

	const compact = (value: number) => {
		if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}m`;
		if (value >= 1_000) return `${symbol}${Math.round(value / 1_000)}k`;
		return `${symbol}${Math.round(value)}`;
	};

	return (
		<div className="h-64 w-full min-w-0 sm:h-72" aria-label="Spending trend chart">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
					<defs>
						<linearGradient id="spendingFill" x1="0" x2="0" y1="0" y2="1">
							<stop stopColor="#34d399" stopOpacity="0.55" />
							<stop offset="1" stopColor="#34d399" stopOpacity="0.02" />
						</linearGradient>
					</defs>
					<XAxis
						dataKey="day"
						tickLine={false}
						axisLine={false}
						fontSize={11}
						stroke="var(--text-muted)"
						tickMargin={12}
						minTickGap={16}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						fontSize={11}
						stroke="var(--text-muted)"
						tickMargin={8}
						width={54}
						tickFormatter={(value) => compact(Number(value))}
					/>
					<Tooltip
						cursor={{ stroke: '#34d399', strokeDasharray: '5 4', strokeOpacity: 0.3 }}
						contentStyle={{
							borderRadius: 12,
							border: '1px solid var(--line)',
							backgroundColor: 'var(--surface-strong)',
							boxShadow: 'var(--shadow)',
							color: 'var(--text)',
							padding: '10px 12px',
							fontSize: 12,
						}}
						labelStyle={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 11 }}
						itemStyle={{ color: 'var(--text)' }}
						formatter={(value) => [formatter.format(Number(value)), 'Spent']}
					/>
					<Area
						type="monotone"
						dataKey="spending"
						stroke="#34d399"
						strokeWidth={2.5}
						fill="url(#spendingFill)"
						activeDot={{ r: 5, strokeWidth: 2, stroke: '#020617', fill: '#34d399' }}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
