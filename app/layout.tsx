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
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#f8fafc' },
		{ media: '(prefers-color-scheme: dark)', color: '#020617' },
	],
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	viewportFit: 'cover',
	colorScheme: 'light dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="font-[var(--font-body)]">
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.theme;var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
					}}
				/>
				<PWARegister />
				{children}
			</body>
		</html>
	);
}
