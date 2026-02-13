import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AgentConsole } from './pages/AgentConsole';
import { AdminQueue } from './pages/AdminQueue';
import { Receipt } from './pages/Receipt';
import { Inventory } from './pages/Inventory';
import { Auth } from './pages/Auth';
import { AgentManager } from './pages/AgentManager';
import { Terminal, Shield, Cpu, Globe, Package, LogIn, LogOut, User, Key } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors ${isActive
        ? 'bg-gray-800 text-white'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
        }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
    >
      <Globe size={12} />
      {language === 'en' ? 'EN' : 'KO'}
    </button>
  );
};

const UserStatus: React.FC = () => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!user) {
    return (
      <button
        onClick={() => navigate('/auth')}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-terminal-green rounded text-terminal-green hover:bg-terminal-green hover:text-black transition-colors"
      >
        <LogIn size={12} />
        {t('auth.signIn')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <User size={12} />
        {user.email.split('@')[0]}
      </span>
      <button
        onClick={signOut}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
        title={t('auth.signOut')}
      >
        <LogOut size={12} />
      </button>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="h-14 border-b border-gray-900 bg-black/50 backdrop-blur fixed top-0 w-full z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 font-bold text-white tracking-tighter">
          <span className="text-terminal-green">{`{`}</span>
          JSONMart
          <span className="text-terminal-green">{`}`}</span>
        </div>
        <div className="flex items-center gap-2">
          <NavLink to="/" icon={<Terminal size={16} />} label={t('nav.humanMode')} />
          <NavLink to="/inventory" icon={<Package size={16} />} label={t('nav.inventory')} />
          <NavLink to="/agent-console" icon={<Cpu size={16} />} label={t('nav.agentConsole')} />
          <NavLink to="/admin-queue" icon={<Shield size={16} />} label={t('nav.adminQueue')} />
          <NavLink to="/agents" icon={<Key size={16} />} label={t('agents.title')} />
          <LanguageToggle />
          <UserStatus />
        </div>
      </nav>
      <main className="flex-1 mt-14">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/agent-console" element={<AgentConsole />} />
                  <Route path="/admin-queue" element={<AdminQueue />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/receipt" element={<Receipt />} />
                  <Route path="/agents" element={<AgentManager />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}