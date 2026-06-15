import { useEffect, useState, type ReactNode } from 'react';
import Navbar from '@/components/navbar';
import Sidebar from '@/components/sidebar';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const cashier = localStorage.getItem('cashier') ? JSON.parse(localStorage.getItem('cashier') as string) : null;

  useEffect(() => {    
    if (!cashier?.token) {
      window.location.href = '/';
    }
  }, [cashier]);

  return (
    <div className="min-h-screen bg-linear-to-br from-off-white via-white to-light-gray">
      {/* Floating gradient circles background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-soft"></div>
      </div>

      {/* Top Navbar */}
      <Navbar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        onMobileDrawerToggle={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        mobileDrawerOpen={mobileDrawerOpen}
      />

      <div className="flex relative z-10">
        {/* Sidebar - Desktop */}
        <div className={`hidden lg:block ${sidebarOpen ? 'w-72' : 'w-20'} fixed left-0 top-0 h-screen`}>
          <Sidebar isOpen={sidebarOpen} isMobile={false} />
        </div>

        {/* Mobile Drawer */}
        <div className="lg:hidden">
          <Sidebar isOpen={mobileDrawerOpen} isMobile={true} onClose={() => setMobileDrawerOpen(false)} />
        </div>

        {/* Mobile Drawer Backdrop */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 w-full ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-20'} transition-all duration-300 ease-in-out`}>
          <div className="pt-20 px-4 md:px-8 pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
