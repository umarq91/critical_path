export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      {children}
      <p className="text-caption text-muted-foreground">© 2026 Three by one. All rights reserved.</p>
    </div>
  );
}
