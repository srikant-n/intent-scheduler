import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState icon={<Construction size={36} />} title={title} description={description} />
  );
}
