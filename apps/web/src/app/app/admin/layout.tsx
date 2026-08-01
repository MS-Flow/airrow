// The operator console (spec 150).
//
// The gate is `requireAdmin()`, which 404s a signed-in non-admin rather than redirecting: a redirect
// to /app would confirm that /app/admin is a real route they cannot have. Every action behind these
// screens gates itself again, and `lib/data/admin.ts` a third time — this one only decides whether
// the page renders.
import { requireAdmin } from "@/lib/auth";
import { PageContainer } from "@/components/shell/page-container";
import { AdminTabs } from "@/features/admin/AdminTabs";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Admin</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-fg-muted">
        Who is here, what they built, where they stopped, and what they thought.
      </p>
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </PageContainer>
  );
}
