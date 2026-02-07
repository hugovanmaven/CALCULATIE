import { ChevronRight } from 'lucide-react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  subtitle?: string;
}

export function Section({ title, defaultOpen = false, children, subtitle }: SectionProps) {
  return (
    <details open={defaultOpen} className="group border border-gray-200 rounded-lg mb-2">
      <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {subtitle && (
          <span className="text-xs font-mono text-gray-500">{subtitle}</span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        {children}
      </div>
    </details>
  );
}
