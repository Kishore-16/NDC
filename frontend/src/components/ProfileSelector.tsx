import React from 'react';
import { OrgProfile } from '../types';
import { Building2, Rocket, Zap, Shield, ChevronRight, Star } from 'lucide-react';

interface ProfileSelectorProps {
  profiles: OrgProfile[];
  activeProfile: OrgProfile | null;
  onSelectProfile: (profile: OrgProfile) => void;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  activeProfile,
  onSelectProfile,
}) => {
  const getIcon = (sector: string, orgId: string) => {
    if (orgId === 'ORG-001' || sector.toLowerCase().includes('bank') || sector.toLowerCase().includes('financial')) {
      return <Building2 size={20} color="#60a5fa" />;
    } else if (orgId === 'ORG-002' || sector.toLowerCase().includes('tech')) {
      return <Rocket size={20} color="#f472b6" />;
    } else if (orgId === 'ORG-003' || sector.toLowerCase().includes('utility')) {
      return <Zap size={20} color="#fbbf24" />;
    }
    return <Shield size={20} color="#34d399" />;
  };

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color="var(--primary)" /> Select Organisation Profile
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Outputs dynamically re-calculate based on risk profile & weight modifiers
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {profiles.map((p) => {
          const isSelected = activeProfile?.org_id === p.org_id;
          const cvssPct = Math.round(p.weight_modifiers.cvss_weight * 100);
          const kevPct = Math.round(p.weight_modifiers.cisa_kev_weight * 100);
          const epssPct = Math.round(p.weight_modifiers.first_epss_weight * 100);

          return (
            <div
              key={p.org_id}
              onClick={() => onSelectProfile(p)}
              className={`glass-panel glass-panel-hover`}
              style={{
                padding: '18px',
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                background: isSelected ? 'rgba(30, 58, 138, 0.25)' : 'var(--bg-card)',
                boxShadow: isSelected ? '0 0 25px rgba(59, 130, 246, 0.25)' : 'none',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'var(--primary)',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.05em'
                }}>
                  ACTIVE TRIAGE
                </div>
              )}

              {/* Profile Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)'
                }}>
                  {getIcon(p.sector, p.org_id)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: isSelected ? '#93c5fd' : '#ffffff' }}>
                    {p.name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                    <span>{p.sector}</span>
                    <span>•</span>
                    <span style={{ color: p.risk_appetite.toLowerCase().includes('high') ? '#f87171' : '#34d399', fontWeight: 600 }}>
                      {p.risk_appetite} Risk Appetite
                    </span>
                  </div>
                </div>
              </div>

              {/* Weight Modifiers Bar */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Weight Modifiers</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>CVSS {cvssPct}% | KEV {kevPct}% | EPSS {epssPct}%</span>
                </div>
                
                {/* Visual Stacked Progress Bar */}
                <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)' }}>
                  <div style={{ width: `${cvssPct}%`, background: '#ef4444' }} title={`CVSS: ${cvssPct}%`} />
                  <div style={{ width: `${kevPct}%`, background: '#f59e0b' }} title={`KEV: ${kevPct}%`} />
                  <div style={{ width: `${epssPct}%`, background: '#3b82f6' }} title={`EPSS: ${epssPct}%`} />
                </div>
              </div>

              {/* Critical Products */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={12} color="#fbbf24" fill="#fbbf24" /> Critical Products (+10 Score Boost)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {p.critical_products.map((prod, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.7rem',
                      background: 'rgba(251, 191, 36, 0.1)',
                      color: '#fef08a',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 500
                    }}>
                      {prod}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
