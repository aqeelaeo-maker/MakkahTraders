import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  Menu,
  X,
  Store,
  ShieldAlert
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { CompanyProfile } from '../types';

export default function Layout() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
        if (currentUser.email?.toLowerCase() === 'aqeelaeo@gmail.com') {
          setIsAuthorized(true);
        } else {
          try {
            const emailLower = currentUser.email?.toLowerCase() || '';
            const docRef = doc(db, 'authorized_users', emailLower);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
            }
          } catch (e) {
            console.error("Authorization check failed:", e);
            setIsAuthorized(false);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (isAuthorized && user) {
      const unsub = onSnapshot(doc(db, 'companies', user.uid), (doc) => {
        if (doc.exists()) {
          setCompanyProfile(doc.data() as CompanyProfile);
        } else {
          setCompanyProfile(null);
        }
      });
      return () => unsub();
    }
  }, [isAuthorized, user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Invoices', path: '/invoices', icon: FileText },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: Store },
    { name: 'Settings', path: '/settings', icon: Settings },
    // Only show Team navigation to Admin, or let everyone see it (but only admin can edit)
  ];

  if (user?.email?.toLowerCase() === 'aqeelaeo@gmail.com') {
    navItems.push({ name: 'Team', path: '/team', icon: Users });
  }

  if (!user || isAuthorized === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-200 rounded-full mb-4"></div>
          <div className="text-slate-400 font-medium">Checking permissions...</div>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-8">
            Your email address (<span className="font-semibold text-slate-800">{user.email}</span>) is not authorized to access this company's dashboard. Please contact the administrator.
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const companyName = companyProfile?.name || 'Company Name';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col p-6 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 mb-10">
          {companyProfile?.logoUrl ? (
            <img src={companyProfile.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg bg-white p-1" />
          ) : (
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white">
              {companyName.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-white font-bold text-lg leading-tight tracking-tight line-clamp-2">{companyName}</h1>
            <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center p-3 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-xs uppercase font-bold tracking-widest text-indigo-400' : 'text-sm font-medium'}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto pt-6">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-slate-800 transition-colors mb-4"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
          <div className="bg-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(user.displayName || user.email || 'A')[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-white font-bold truncate">{user.displayName || user.email}</p>
                <p className="text-[10px] text-slate-400">Admin User</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Company Profile</span>
                <span className="font-bold text-slate-800">{companyName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NTN / STRN</span>
                <span className="font-mono text-xs text-slate-600">{companyProfile?.ntn || '-'} / {companyProfile?.strn || '-'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
             {/* Page specific actions can go here if moved to Context, otherwise handled inside Outlet */}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <Outlet context={{ companyProfile }} />
        </div>
      </main>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
