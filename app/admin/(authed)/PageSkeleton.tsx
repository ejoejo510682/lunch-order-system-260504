export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 sm:space-y-6">
      <div className="h-6 w-32 rounded bg-zinc-200" />
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
        <div className="h-10 rounded-lg bg-zinc-100" />
        <div className="h-10 rounded-lg bg-zinc-100" />
        <div className="h-10 rounded-lg bg-zinc-100" />
        <div className="h-10 w-2/3 rounded-lg bg-zinc-100" />
      </div>
    </div>
  );
}
