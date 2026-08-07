import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeedbackWidget } from "@/components/ops/FeedbackWidget";

// The application shell: every signed-in / product surface renders inside the
// Header + Footer chrome. Marketing routes live outside this group so they can
// own the full viewport.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* Beta feedback affordance. Lives in the chrome, not on a /feedback
          page, so it captures the path the user is actually looking at.
          Product surfaces only — the marketing page has its own funnel. */}
      <FeedbackWidget />
    </div>
  );
}
