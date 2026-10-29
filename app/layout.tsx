import './globals.css';
import PWARegister from '@/components/PWARegister';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Pocket Pilot', description: 'Personal finance and daily planner', manifest: '/manifest.json' };

export const viewport: Viewport = {
	themeColor: '#18a882',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="font-[var(--font-body)]">
				<PWARegister />
				{children}
			</body>
		</html>
	);
}
