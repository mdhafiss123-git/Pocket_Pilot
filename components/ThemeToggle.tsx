'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
	const [dark, setDark] = useState(false);

	useEffect(() => {
		setDark(document.documentElement.classList.contains('dark'));
	}, []);

	function toggle() {
		const next = !dark;
		setDark(next);
		document.documentElement.classList.toggle('dark', next);
		localStorage.theme = next ? 'dark' : 'light';
	}

	return (
		<button
			className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
			aria-label="Toggle dark mode"
			title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
			onClick={toggle}
		>
			{dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
		</button>
	);
}
