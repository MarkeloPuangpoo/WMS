import { ToastProvider } from "@/components/ui/Toast";

export default function DriverLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
            {/* Mobile-style Top Nav */}
            <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
                <div className="flex justify-between items-center max-w-md mx-auto relative">
                    <h1 className="font-bold text-lg tracking-tight">Driver App</h1>
                </div>
            </header>

            {/* Main Content Area (constrain width for mobile feel on desktop) */}
            <main className="max-w-md mx-auto w-full min-h-[calc(100vh-60px)] shadow-xl bg-white/50 backdrop-blur-sm relative">
                <ToastProvider>
                    {children}
                </ToastProvider>
            </main>
        </div>
    );
}
