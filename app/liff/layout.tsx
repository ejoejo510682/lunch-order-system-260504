export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
