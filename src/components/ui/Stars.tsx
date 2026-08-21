import { Star } from 'lucide-react';
import { classNames } from '@/utils/format';

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <div className={classNames('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={classNames(
            i <= Math.round(rating) ? 'fill-warning-500 text-warning-500' : 'fill-ink-200 text-ink-200',
          )}
        />
      ))}
    </div>
  );
}
