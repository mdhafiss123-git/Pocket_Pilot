'use client';
import { Moon, Sun } from 'lucide-react'; import { useEffect, useState } from 'react';
export default function ThemeToggle() { const [dark,setDark]=useState(false); useEffect(()=>{setDark(document.documentElement.classList.contains('dark'))},[]); function toggle(){ const d=!dark;setDark(d);document.documentElement.classList.toggle('dark',d);localStorage.theme=d?'dark':'light'; } return <button className="btn-ghost" aria-label="Toggle dark mode" onClick={toggle}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button> }
