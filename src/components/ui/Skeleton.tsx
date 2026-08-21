import { classNames } from '@/utils/format';

export function Skeleton({ className }: { className?: string }) {
  return <div className={classNames('skeleton rounded-lg', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
