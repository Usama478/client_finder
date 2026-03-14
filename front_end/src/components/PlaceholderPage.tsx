import { EmptyState } from './page/EmptyState';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description = "This section is coming soon." }: PlaceholderPageProps) {
  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-[50vh] flex items-center justify-center">
      <EmptyState title={title} description={description} className="w-full max-w-2xl" />
    </div>
  );
}
