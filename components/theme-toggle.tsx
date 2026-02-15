// components/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-9 w-9" />;

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
        >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
    );
}
