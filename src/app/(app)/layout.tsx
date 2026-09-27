import { AppShell } from "@/components/shell/AppShell";
import { AppStoreProvider } from "@/store/app-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <AppShell>{children}</AppShell>
    </AppStoreProvider>
  );
}
