import { ChevronRight } from 'lucide-react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  subtitle?: string;
}

export function Section({ title, defaultOpen = false, children, subtitle }: SectionProps) {
  return (
    <details open={defaultOpen} className="group border border-[var(--border)] rounded-xl mb-2 bg-[var(--bg-secondary)]">
      <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none hover:bg-[var(--bg-hover)] rounded-xl transition-colors">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-90" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        {subtitle && (
          <span className="text-xs font-mono text-[var(--text-tertiary)]">{subtitle}</span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-[var(--border)]">
        {children}
      </div>
    </details>
  );
}
