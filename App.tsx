import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AgentConsole } from './pages/AgentConsole';
import { AdminQueue } from './pages/AdminQueue';
import { Receipt } from './pages/Receipt';
import { Inventory } from './pages/Inventory';
import { Terminal, Shield, Cpu, Globe, Package } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors ${
        isActive 
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
      className="flex items-center gap-1 px-3 py-1.5 ml-4 text-xs font-bold border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
    >
      <Globe size={12} />
      {language === 'en' ? 'EN' : 'KO'}
    </button>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="h-14 border-b border-gray-900 bg-black/50 backdrop-blur fixed top-0 w-full z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 font-bold text-white tracking-tighter">
          <span className="text-terminal-green">{`{`}</span>
          {t('nav.title')}
          <span className="text-terminal-green">{`}`}</span>
        </div>
        <div className="flex items-center gap-2">
          <NavLink to="/" icon={<Terminal size={16} />} label={t('nav.humanMode')} />
          <NavLink to="/inventory" icon={<Package size={16} />} label={t('nav.inventory')} />
          <NavLink to="/agent-console" icon={<Cpu size={16} />} label={t('nav.agentConsole')} />
          <NavLink to="/admin-queue" icon={<Shield size={16} />} label={t('nav.adminQueue')} />
          <LanguageToggle />
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
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/agent-console" element={<AgentConsole />} />
            <Route path="/admin-queue" element={<AdminQueue />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/receipt" element={<Receipt />} />
          </Routes>
        </Layout>
      </HashRouter>
    </LanguageProvider>
  );
}