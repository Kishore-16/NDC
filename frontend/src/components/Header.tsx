import React from 'react';
import { OrgProfile } from '../types';
import { ShieldCheck, Layers, GitCompare, Ban, Award, Database, Upload, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProfile: OrgProfile | null;
  onOpenUpload: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeProfile,
  onOpenUpload,
  onSignOut,
}) => {
  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', borderTop: 'none', padding: '16px 32px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              NEXORA <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.8, color: '#60a5fa' }}>Triage Engine v2.0</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Personalised Threat Prioritisation & Decision Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('triage')}
            className={`btn-secondary ${activeTab === 'triage' ? 'active-tab' : ''}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: activeTab === 'triage' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'triage' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'triage' ? '#60a5fa' : 'var(--text-secondary)'
            }}
          >
            <Layers size={16} /> Top 5 Triage
          </button>
          
          <button
            onClick={() => setActiveTab('compare')}
            className={`btn-secondary ${activeTab === 'compare' ? 'active-tab' : ''}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: activeTab === 'compare' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'compare' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'compare' ? '#60a5fa' : 'var(--text-secondary)'
            }}
          >
            <GitCompare size={16} /> Compare Orgs
          </button>

          <button
            onClick={() => setActiveTab('negative')}
            className={`btn-secondary ${activeTab === 'negative' ? 'active-tab' : ''}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: activeTab === 'negative' ? '1px solid var(--urgent-red)' : '1px solid transparent',
              background: activeTab === 'negative' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: activeTab === 'negative' ? '#fca5a5' : 'var(--text-secondary)'
            }}
          >
            <Ban size={16} /> Negative Test
          </button>

          <button
            onClick={() => setActiveTab('goldset')}
            className={`btn-secondary ${activeTab === 'goldset' ? 'active-tab' : ''}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: activeTab === 'goldset' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              background: activeTab === 'goldset' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: activeTab === 'goldset' ? '#67e8f9' : 'var(--text-secondary)'
            }}
          >
            <Award size={16} /> Gold Set Eval
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`btn-secondary ${activeTab === 'inventory' ? 'active-tab' : ''}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: activeTab === 'inventory' ? '1px solid var(--border-glow)' : '1px solid transparent',
              background: activeTab === 'inventory' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'inventory' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            <Database size={16} /> Inventory (540)
          </button>
        </nav>

        {/* Profile Info & Upload Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeProfile && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--border-glow)',
              padding: '6px 14px',
              borderRadius: '10px',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Profile
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd' }}>
                {activeProfile.name}
              </div>
            </div>
          )}

          <button onClick={onOpenUpload} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            <Upload size={16} /> Custom Profile D
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: '#fca5a5', borderColor: 'rgba(248, 113, 113, 0.45)' }}
            aria-label="Sign out"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

      </div>
    </header>
  );
};
