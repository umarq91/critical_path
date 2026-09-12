import { MarketingPanel } from "@/app/auth/marketing-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-background lg:block">
        <MarketingPanel />
      </div>
      <div className="flex flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
        {children}
        <p className="text-caption text-muted-foreground">
          © 2026 Three by one. All rights reserved.
        </p>
      </div>
    </div>
  );
}
