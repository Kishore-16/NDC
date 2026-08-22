import { ReactNode, useState } from 'react';
import { BarChart3, Building2, ChevronDown, FlaskConical, GitCompare, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { OrgProfile } from '../types';
import type { SessionUser } from '../App';

interface WorkspaceShellProps { activeProfile: OrgProfile; user: SessionUser; onSignOut: () => void; children: ReactNode; }
const navItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
  { to: '/app/triage', label: 'Triage', icon: ShieldCheck, group: 'Triage' }, { to: '/app/compare', label: 'Compare', icon: GitCompare, group: 'Triage' },
  { to: '/app/negative-test', label: 'Negative Test', icon: FlaskConical, group: 'Validation' }, { to: '/app/gold-set', label: 'Gold Set', icon: BarChart3, group: 'Validation' },
  { to: '/app/inventory', label: 'Vulnerabilities', icon: Building2, group: 'Data' }, { to: '/app/profiles', label: 'Profiles', icon: Building2, group: 'Organisation' },
];

export function WorkspaceShell({ activeProfile, user, onSignOut, children }: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false); const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nexora_sidebar_collapsed') === 'true'); const navigate = useNavigate(); const location = useLocation();
  const sections = [...new Set(navItems.map((item) => item.group))]; const query = `?profile=${encodeURIComponent(activeProfile.org_id)}`;
  const pageName = navItems.find((item) => location.pathname === item.to)?.label || (location.pathname.includes('/triage/') ? 'Decision' : 'Workspace');
  const toggleSidebar = () => setCollapsed((current) => { const next = !current; localStorage.setItem('nexora_sidebar_collapsed', String(next)); return next; });
  return <div className={`workspace-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`workspace-sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="workspace-brand"><span><ShieldCheck size={19} /></span><div><strong>NEXORA</strong><small>Triage Engine</small></div><button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <nav className="workspace-nav">{sections.map((section) => <div className="workspace-nav-group" key={section}><p>{section}</p>{navItems.filter((item) => item.group === section).map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={`${item.to}${query}`} end={item.end} aria-label={item.label} onClick={() => setMobileOpen(false)} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}><Icon size={17} />{item.label}</NavLink>; })}</div>)}</nav>
    </aside>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="workspace-main"><header className="workspace-header"><div className="workspace-header-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><button className="desktop-sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><div className="workspace-crumb"><span>NEXORA</span><b>/</b><strong>{pageName}</strong></div></div><div className="workspace-header-actions"><button className="header-profile-switch" onClick={() => navigate(`/app/profiles${query}`)} title={`Active organisation: ${activeProfile.name}`}><Building2 size={16} /><span>{activeProfile.name}</span></button><div className="user-bubble" title={user.email || user.name}><span>{user.name.charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong>{user.email && <small>{user.email}</small>}</div><UserRound size={15} /></div><button className="header-icon-action" onClick={() => navigate(`/app/profiles/custom${query}`)} title="Create profile"><Plus size={18} /></button><button className="header-icon-action danger" onClick={onSignOut} title="Sign out"><LogOut size={18} /></button></div></header><main className="workspace-content">{children}</main></div>
  </div>;
}
