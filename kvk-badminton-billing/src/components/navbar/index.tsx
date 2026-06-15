import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Maximize2, Minimize2, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onMobileDrawerToggle: () => void;
  mobileDrawerOpen: boolean;
}

export default function Navbar({
  sidebarOpen,
  onSidebarToggle,
  onMobileDrawerToggle,
  mobileDrawerOpen,
}: NavbarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();

  const cashier = localStorage.getItem('cashier') ? JSON.parse(localStorage.getItem('cashier') as string) : null;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    if (accountMenuOpen) {
      document.addEventListener('mousedown', handlePointerDown);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [accountMenuOpen]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  return (
    <nav className={`fixed top-0 right-0 z-40 h-16 border-b border-gray-200/80 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-300 ${sidebarOpen ? 'lg:left-72' : 'lg:left-20'} left-0`}>
      <div className="h-full px-4 md:px-6 flex items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onSidebarToggle}
            className="hidden lg:flex cursor-pointer items-center justify-center w-10 h-10 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={onMobileDrawerToggle}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileDrawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          <button
          onClick={() => {
            navigate("/settings")
          }}
           className="hidden cursor-pointer sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Settings">
            <Settings size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="hidden cursor-pointer sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <div ref={accountMenuRef} className="relative">
            <button
              onClick={() => setAccountMenuOpen((current) => !current)}
              className="w-10 h-10 cursor-pointer rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shadow-sm ring-0 transition hover:bg-blue-200"
              aria-label="Open account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              {cashier?.firstName?.charAt(0)}{cashier?.lastName?.charAt(0)}
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10">
                <div className="border-b border-gray-100 px-3 py-3">
                  <div className="text-sm font-medium text-gray-900">{cashier?.firstName} {cashier?.lastName}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{cashier?.email}</div>
                </div>

                <div className="py-1.5">

                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-red-500 transition hover:bg-red-50 cursor-pointer"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      localStorage.removeItem('cashier');
                      window.location.href = '/';
                    }}
                  >
                    <LogOut size={16} />
                    <span className="text-xs font-medium">Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
