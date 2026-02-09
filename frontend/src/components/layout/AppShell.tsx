import { Menu } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  onToggleSidebar?: () => void;
}

export function AppShell({ children, onToggleSidebar }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg font-bold text-gray-900">Maven</h1>
            <span className="text-sm text-gray-400 hidden sm:inline">Calculatiemodel</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">v2.1</span>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
