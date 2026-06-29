import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-colors duration-300 hover:bg-black/5 dark:hover:bg-white/10 ${className}`}
      aria-label={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-gray-600" />
      ) : (
        <Sun size={20} className="text-yellow-400" />
      )}
    </button>
  );
}
