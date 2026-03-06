import MainLayout from "@/components/layout/MainLayout";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ToastProvider>
            <MainLayout>{children}</MainLayout>
        </ToastProvider>
    );
}
