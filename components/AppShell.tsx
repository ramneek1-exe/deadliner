interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
          Deadliner
        </h1>
        <p className="mt-1 text-sm text-muted">
          Syllabus to calendar in seconds.
        </p>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
