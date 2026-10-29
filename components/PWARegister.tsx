'use client';
import { useEffect } from 'react';
/** Registers the lightweight offline worker after the page becomes interactive. */
export default function PWARegister() { useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined); }, []); return null; }
