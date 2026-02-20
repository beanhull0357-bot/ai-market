import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { AgentConsole } from './pages/AgentConsole';
import { AdminQueue } from './pages/AdminQueue';
import { Receipt } from './pages/Receipt';
import { Inventory } from './pages/Inventory';
import { Auth } from './pages/Auth';
import { AgentManager } from './pages/AgentManager';
import { PolicyManager } from './pages/PolicyManager';
import { AgentPlayground } from './pages/AgentPlayground';
import { AgentDocs } from './pages/AgentDocs';
import { MerchantPolicies } from './pages/MerchantPolicies';
import { AIOps } from './pages/AIOps';
import { DomeggookSync } from './pages/DomeggookSync';
import { OrderManager } from './pages/OrderManager';
import { LiveFeed } from './pages/LiveFeed';
import { SLADashboard } from './pages/SLADashboard';
import { AgentQA } from './pages/AgentQA';
import { AgentAnalytics } from './pages/AgentAnalytics';
import { MCPIntegration } from './pages/MCPIntegration';
import { OrderTracking } from './pages/OrderTracking';
import { Promotions } from './pages/Promotions';
import { AgentSandbox } from './pages/AgentSandbox';
import { ProductCompare } from './pages/ProductCompare';
import { AutoReorder } from './pages/AutoReorder';
import { AgentReputation } from './pages/AgentReputation';
import { AdminDashboard } from './pages/AdminDashboard';
import { AgentActivityLog } from './pages/AgentActivityLog';
import { DataExport } from './pages/DataExport';
import { WebhookConfig } from './pages/WebhookConfig';
import { SwaggerUI } from './pages/SwaggerUI';
import { AgentPortal } from './pages/AgentPortal';
import { A2ANetwork } from './pages/A2ANetwork';
import { SellerCenter } from './pages/SellerCenter';
import { SellerRegistry } from './pages/SellerRegistry';
import { AgentWallet } from './pages/AgentWallet';
import { UsageTiers } from './pages/UsageTiers';
import { PredictiveProcurement } from './pages/PredictiveProcurement';
import { ConformanceTest } from './pages/ConformanceTest';
import { PublicAnalytics } from './pages/PublicAnalytics';
import EcosystemMap from './pages/EcosystemMap';
import NegotiationCenter from './pages/NegotiationCenter';
import { DecisionReplay } from './pages/DecisionReplay';
import { A2AMarket } from './pages/A2AMarket';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { NotificationBell } from './components/NotificationBell';
import { GuidePopup } from './components/GuidePopup';
import { GUIDE_CONTENT } from './data/guideContent';
import { Terminal, Shield, Cpu, Globe, Package, LogIn, LogOut, User, Key, FileCheck, Zap, BookOpen, Bot, Radio, BarChart3, ChevronDown, Menu, X, Store, Truck, MessageSquare, Tag, Users, FlaskConical, GitCompare, RefreshCw, Activity, Download, Webhook, LayoutDashboard, FileJson, Handshake, Brain, Workflow } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

/* ━━━ Toast System ━━━ */
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; }
const ToastContext = React.createContext<{
  addToast: (type: Toast['type'], message: string) => void;
}>({ addToast: () => { } });

export const useToast = () => React.useContext(ToastContext);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '✕'}
            {t.type === 'info' && 'ℹ'}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ━━━ Nav Group Dropdown ━━━ */
interface NavItem { to: string; icon: React.ReactNode; label: string; }
interface NavGroupProps { label: string; icon: React.ReactNode; items: NavItem[]; }

function NavGroup({ label, icon, items }: NavGroupProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isGroupActive = items.some(i => location.pathname === i.to);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="nav-group" ref={ref}>
      <button
        className={`nav-group-btn ${isGroupActive ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {label}
        <ChevronDown size={10} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="nav-dropdown">
          {items.map(i => (
            <Link
              key={i.to}
              to={i.to}
              className={location.pathname === i.to ? 'active-link' : ''}
              onClick={() => setOpen(false)}
            >
              {i.icon}
              {i.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ━━━ Direct Nav Link ━━━ */
function NavLink({ to, icon, label }: NavItem) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', fontSize: 12, fontWeight: 600,
        color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
        background: isActive ? 'var(--bg-card-hover)' : 'transparent',
        borderRadius: 'var(--radius-sm)', textDecoration: 'none',
        transition: 'all 150ms',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ━━━ Language Toggle ━━━ */
const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', fontSize: 11, fontWeight: 700,
        border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-tertiary)', background: 'transparent', cursor: 'pointer',
        transition: 'all 150ms',
      }}
    >
      <Globe size={11} />
      {language === 'en' ? 'EN' : 'KO'}
    </button>
  );
};

/* ━━━ Notification Bell Wrapper ━━━ */
const NotificationBellWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <NotificationBell navigate={navigate} />;
};

/* ━━━ User Status ━━━ */
const UserStatus: React.FC = () => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <User size={11} />
        {user.email.split('@')[0]}
      </span>
      <button
        onClick={signOut}
        style={{
          display: 'flex', alignItems: 'center', padding: '4px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'var(--text-muted)', transition: 'color 150ms',
        }}
        title={t('auth.signOut')}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <LogOut size={12} />
      </button>
    </div>
  );
};

/* ━━━ Mobile Menu ━━━ */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const groups = [
    {
      label: t('nav.commerce'), items: [
        { to: '/', icon: <Terminal size={15} />, label: t('nav.home') },
        ...(isAdmin ? [
          { to: '/inventory', icon: <Package size={15} />, label: t('nav.inventory') },
          { to: '/admin-queue', icon: <Shield size={15} />, label: t('nav.adminQueue') },
          { to: '/domeggook', icon: <Store size={15} />, label: t('nav.domeggook') },
        ] : []),
      ],
    },
    {
      label: t('nav.agents'), items: [
        { to: '/agent-console', icon: <Cpu size={15} />, label: t('nav.agentConsole') },
        ...(isAdmin ? [
          { to: '/agents', icon: <Key size={15} />, label: t('nav.agentManager') },
          { to: '/policies', icon: <FileCheck size={15} />, label: t('nav.policies') },
        ] : []),
        { to: '/playground', icon: <Zap size={15} />, label: t('nav.playground') },
        { to: '/sandbox', icon: <FlaskConical size={15} />, label: 'Sandbox' },
        { to: '/negotiate', icon: <Handshake size={15} />, label: 'Negotiate' },
        { to: '/agent/docs', icon: <BookOpen size={15} />, label: t('nav.docs') },
        ...(isAdmin ? [
          { to: '/agent-qa', icon: <MessageSquare size={15} />, label: 'Agent Q&A' },
          { to: '/agent-reputation', icon: <Shield size={15} />, label: 'Reputation' },
        ] : []),
      ],
    },
    {
      label: t('nav.ai'), items: [
        ...(isAdmin ? [
          { to: '/ai-ops', icon: <Bot size={15} />, label: t('nav.aiOps') },
          { to: '/analytics', icon: <BarChart3 size={15} />, label: 'Analytics' },
        ] : []),
        { to: '/live', icon: <Radio size={15} />, label: t('nav.live') },
        { to: '/sla', icon: <BarChart3 size={15} />, label: t('nav.sla') },
        { to: '/mcp', icon: <Cpu size={15} />, label: 'MCP' },
        { to: '/compare', icon: <GitCompare size={15} />, label: 'Compare' },
        ...(isAdmin ? [
          { to: '/promotions', icon: <Tag size={15} />, label: 'Promotions' },
          { to: '/auto-reorder', icon: <RefreshCw size={15} />, label: 'Auto Reorder' },
          { to: '/tracking', icon: <Truck size={15} />, label: 'Tracking' },
        ] : []),
        { to: '/ecosystem', icon: <Globe size={15} />, label: 'Ecosystem' },
      ],
    },
  ];

  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <div className="mobile-menu">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--accent-green)' }}>{'{'}</span> JSONMart <span style={{ color: 'var(--accent-green)' }}>{'}'}</span>
          </span>
          <button onClick={onClose} style={{ padding: 4, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {groups.map(g => (
          <div key={g.label} className="mobile-menu-group">
            <div className="mobile-menu-group-label">{g.label}</div>
            {g.items.map(i => (
              <Link key={i.to} to={i.to} className={location.pathname === i.to ? 'active-link' : ''} onClick={onClose}>
                {i.icon} {i.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ━━━ Layout ━━━ */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const { isAdmin, isDemo } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const commerceItems: NavItem[] = [
    { to: '/', icon: <Terminal size={13} />, label: t('nav.humanMode') },
    ...(isAdmin ? [
      { to: '/dashboard', icon: <LayoutDashboard size={13} />, label: 'Dashboard' },
      { to: '/inventory', icon: <Package size={13} />, label: t('nav.inventory') },
      { to: '/admin-queue', icon: <Shield size={13} />, label: t('nav.adminQueue') },
      { to: '/domeggook', icon: <Store size={13} />, label: t('nav.domeggook') },
      { to: '/orders', icon: <Truck size={13} />, label: t('nav.orders') },
      { to: '/export', icon: <Download size={13} />, label: 'Export' },
      { to: '/seller-registry', icon: <Shield size={13} />, label: 'Seller 관리' },
    ] : []),
    { to: '/seller', icon: <Store size={13} />, label: 'Seller Center' },
  ];
  const agentItems: NavItem[] = [
    { to: '/agent-console', icon: <Cpu size={13} />, label: t('nav.agentConsole') },
    ...(isAdmin ? [
      { to: '/agents', icon: <Key size={13} />, label: t('agents.title') },
      { to: '/policies', icon: <FileCheck size={13} />, label: t('policies.title') },
    ] : []),
    { to: '/playground', icon: <Zap size={13} />, label: t('playground.navTitle') },
    { to: '/sandbox', icon: <FlaskConical size={13} />, label: 'Sandbox' },
    { to: '/portal', icon: <User size={13} />, label: 'Portal' },
    { to: '/agent/docs', icon: <BookOpen size={13} />, label: t('nav.docs') },
    { to: '/swagger', icon: <FileJson size={13} />, label: 'API Docs' },
    { to: '/a2a', icon: <Radio size={13} />, label: 'A2A Network' },
    { to: '/wallet', icon: <Zap size={13} />, label: 'Wallet' },
    { to: '/tiers', icon: <BarChart3 size={13} />, label: 'Tiers' },
    { to: '/predictions', icon: <Bot size={13} />, label: 'Predictions' },
    { to: '/conformance', icon: <Shield size={13} />, label: 'Conformance' },
    ...(isAdmin ? [
      { to: '/agent-qa', icon: <MessageSquare size={13} />, label: 'Q&A' },
      { to: '/agent-reputation', icon: <Shield size={13} />, label: 'Reputation' },
    ] : []),
    { to: '/negotiate', icon: <Handshake size={13} />, label: 'Negotiate' },
  ];
  const aiItems: NavItem[] = [
    ...(isAdmin ? [
      { to: '/ai-ops', icon: <Bot size={13} />, label: t('nav.aiOps') },
      { to: '/analytics', icon: <BarChart3 size={13} />, label: 'Analytics' },
    ] : []),
    { to: '/live', icon: <Radio size={13} />, label: t('nav.live') },
    { to: '/sla', icon: <BarChart3 size={13} />, label: t('nav.sla') },
    { to: '/mcp', icon: <Cpu size={13} />, label: 'MCP' },
    { to: '/compare', icon: <GitCompare size={13} />, label: 'Compare' },
    ...(isAdmin ? [
      { to: '/promotions', icon: <Tag size={13} />, label: 'Promotions' },
      { to: '/auto-reorder', icon: <RefreshCw size={13} />, label: 'Reorder' },
      { to: '/tracking', icon: <Truck size={13} />, label: 'Tracking' },
      { to: '/activity-log', icon: <Activity size={13} />, label: 'Log' },
      { to: '/webhooks', icon: <Webhook size={13} />, label: 'Webhooks' },
    ] : []),
    { to: '/public-analytics', icon: <Globe size={13} />, label: 'Analytics' },
    { to: '/ecosystem', icon: <Globe size={13} />, label: 'Ecosystem' },
    { to: '/decision-replay', icon: <Brain size={13} />, label: 'Decision Replay' },
    { to: '/a2a-market', icon: <Radio size={13} />, label: 'A2A Market' },
    { to: '/workflow-builder', icon: <Workflow size={13} />, label: 'Workflow' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ━━━ Navbar ━━━ */}
      <nav style={{
        height: 52, borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)',
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(10px, 3vw, 20px)',
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none', fontSize: 15, letterSpacing: -0.5 }}>
          <span style={{ color: 'var(--accent-green)' }}>{'{'}</span>
          JSONMart
          <span style={{ color: 'var(--accent-green)' }}>{'}'}</span>
        </Link>

        {/* Desktop Nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavGroup label={t('nav.commerce')} icon={<Package size={13} />} items={commerceItems} />
          <NavGroup label={t('nav.agents')} icon={<Cpu size={13} />} items={agentItems} />
          <NavGroup label={t('nav.ai')} icon={<Bot size={13} />} items={aiItems} />
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBellWrapper />
          <LanguageToggle />
          <UserStatus />
          {/* Mobile Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'none', alignItems: 'center', justifyContent: 'center',
              padding: 6, border: 'none', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}

      {/* Demo Guide Popup */}
      {isDemo && GUIDE_CONTENT[location.pathname] && (
        <GuidePopup
          pageKey={location.pathname}
          {...GUIDE_CONTENT[location.pathname]}
        />
      )}

      {/* Main Content with page transition */}
      <main className="page-enter" key={location.pathname} style={{ flex: 1, marginTop: 52 }}>
        {children}
      </main>
    </div>
  );
};

/* ━━━ App ━━━ */
export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/agent-console" element={<AgentConsole />} />
                    <Route path="/admin-queue" element={<AdminRoute><AdminQueue /></AdminRoute>} />
                    <Route path="/inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
                    <Route path="/receipt" element={<Receipt />} />
                    <Route path="/agents" element={<AdminRoute><AgentManager /></AdminRoute>} />
                    <Route path="/policies" element={<AdminRoute><PolicyManager /></AdminRoute>} />
                    <Route path="/playground" element={<AgentPlayground />} />
                    <Route path="/agent/docs" element={<AgentDocs />} />
                    <Route path="/policies/returns" element={<MerchantPolicies />} />
                    <Route path="/policies/merchant" element={<MerchantPolicies />} />
                    <Route path="/ai-ops" element={<AdminRoute><AIOps /></AdminRoute>} />
                    <Route path="/live" element={<LiveFeed />} />
                    <Route path="/sla" element={<SLADashboard />} />
                    <Route path="/domeggook" element={<AdminRoute><DomeggookSync /></AdminRoute>} />
                    <Route path="/orders" element={<AdminRoute><OrderManager /></AdminRoute>} />
                    <Route path="/agent-qa" element={<AdminRoute><AgentQA /></AdminRoute>} />
                    <Route path="/analytics" element={<AdminRoute><AgentAnalytics /></AdminRoute>} />
                    <Route path="/mcp" element={<MCPIntegration />} />
                    <Route path="/tracking" element={<AdminRoute><OrderTracking /></AdminRoute>} />
                    <Route path="/promotions" element={<AdminRoute><Promotions /></AdminRoute>} />
                    <Route path="/sandbox" element={<AgentSandbox />} />
                    <Route path="/swagger" element={<SwaggerUI />} />
                    <Route path="/a2a" element={<A2ANetwork />} />
                    <Route path="/seller" element={<SellerCenter />} />
                    <Route path="/seller-registry" element={<AdminRoute><SellerRegistry /></AdminRoute>} />
                    <Route path="/portal" element={<AgentPortal />} />
                    <Route path="/compare" element={<ProductCompare />} />
                    <Route path="/auto-reorder" element={<AdminRoute><AutoReorder /></AdminRoute>} />
                    <Route path="/agent-reputation" element={<AdminRoute><AgentReputation /></AdminRoute>} />
                    <Route path="/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/activity-log" element={<AdminRoute><AgentActivityLog /></AdminRoute>} />
                    <Route path="/export" element={<AdminRoute><DataExport /></AdminRoute>} />
                    <Route path="/webhooks" element={<AdminRoute><WebhookConfig /></AdminRoute>} />
                    <Route path="/wallet" element={<AgentWallet />} />
                    <Route path="/tiers" element={<UsageTiers />} />
                    <Route path="/predictions" element={<PredictiveProcurement />} />
                    <Route path="/conformance" element={<ConformanceTest />} />
                    <Route path="/public-analytics" element={<PublicAnalytics />} />
                    <Route path="/ecosystem" element={<EcosystemMap />} />
                    <Route path="/negotiate" element={<NegotiationCenter />} />
                    <Route path="/decision-replay" element={<DecisionReplay />} />
                    <Route path="/a2a-market" element={<A2AMarket />} />
                    <Route path="/workflow-builder" element={<WorkflowBuilder />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}