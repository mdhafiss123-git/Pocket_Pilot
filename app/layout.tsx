import './globals.css';
import PWARegister from '@/components/PWARegister';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
	title: 'Pocket Pilot',
	description: 'Personal finance and daily planner',
	manifest: '/manifest.json',
	icons: {
		icon: '/logo.png',
		shortcut: '/logo.png',
		apple: '/logo.png',
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: 'Pocket Pilot',
	},
};

export const viewport: Viewport = {
	themeColor: '#000000',
	width: 'device-width',
	initialScale: 1,
	maximumScale: 5,
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
