interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Maven</h1>
            <span className="text-sm text-gray-400">Calculatiemodel</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">v2.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
