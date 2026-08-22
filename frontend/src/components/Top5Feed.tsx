import React from 'react';
import { TriageItem, OrgProfile } from '../types';
import { ShieldAlert, Flame, TrendingUp, HelpCircle, ArrowRight, CheckCircle, Info, Star } from 'lucide-react';

interface Top5FeedProps {
  top5: TriageItem[];
  profile: OrgProfile | null;
  onSelectItem: (item: TriageItem) => void;
}

export const Top5Feed: React.FC<Top5FeedProps> = ({
  top5,
  profile,
  onSelectItem,
}) => {
  if (!top5 || top5.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <Info size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>No matching vulnerabilities found for this profile.</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Nothing matched this profile in the supplied data.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      
      {/* Feed Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="var(--urgent-red)" /> TOP 5 PERSONALISED PRIORITIES
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Personalised threat intelligence output for <strong style={{ color: '#93c5fd' }}>{profile?.name}</strong>
          </p>
        </div>
        
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid var(--border-glow)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          color: '#60a5fa',
          fontWeight: 600
        }}>
          5 Actions Ranked by Risk Engine
        </div>
      </div>

      {/* Top 5 Cards Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {top5.map((item) => {
          const b = item.score_breakdown;
          const isUrgent = item.priority_label.toLowerCase() === 'urgent';
          const isHigh = item.priority_label.toLowerCase() === 'high';

          return (
            <div
              key={item.cve_id}
              className="glass-panel glass-panel-hover"
              style={{
                padding: '24px',
                borderLeft: item.rank === 1 ? '5px solid var(--urgent-red)' : (item.rank === 2 ? '5px solid var(--high-amber)' : '5px solid var(--primary)'),
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                
                {/* Left Section: Rank, Title, Product, Signals */}
                <div style={{ flex: '1 1 500px' }}>
                  
                  {/* Top Badges Row */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    
                    {/* Rank Badge */}
                    <span style={{
                      background: item.rank === 1 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      #{item.rank}
                    </span>

                    {/* Priority Badge */}
                    <span className={`badge ${isUrgent ? 'badge-urgent' : (isHigh ? 'badge-high' : 'badge-medium')}`}>
                      {item.priority_label}
                    </span>

                    {/* CVE ID */}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}>
                      {item.cve_id}
                    </span>

                    {/* Critical Product Badge */}
                    {b.is_critical_product && (
                      <span className="badge badge-critical-product">
                        <Star size={12} fill="#fbbf24" /> CRITICAL PRODUCT (+10 BOOST)
                      </span>
                    )}

                    {/* CISA KEV Badge */}
                    {item.cisa_kev && (
                      <span className="badge badge-kev">
                        <Flame size={12} /> CISA KEV EXPLOITED
                      </span>
                    )}

                    {/* EPSS Badge */}
                    <span className="badge badge-epss">
                      <TrendingUp size={12} /> EPSS {(item.first_epss * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Plain Language Title */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    {item.plain_title}
                  </h3>

                  {/* Affected Product */}
                  <div style={{ fontSize: '0.9rem', color: '#93c5fd', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Affected System:</span>
                    <span style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '2px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      {item.product_name}
                    </span>
                  </div>

                  {/* Short Why Summary */}
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <strong style={{ color: '#e2e8f0' }}>Why it matters:</strong> {item.why_ranked_here}
                  </p>

                </div>

                {/* Right Section: Score Ring & Action Button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minWidth: '180px' }}>
                  
                  {/* Priority Score Box */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid var(--border-glow)',
                    borderRadius: '14px',
                    padding: '12px 18px',
                    textAlign: 'center',
                    marginBottom: '16px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    width: '100%'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Personalised Score
                    </div>
                    <div style={{
                      fontSize: '2.2rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: item.rank === 1 ? '#f87171' : '#60a5fa',
                      lineHeight: '1.1'
                    }}>
                      {b.final_score.toFixed(1)}
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}> / 100</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Base: {b.base_score.toFixed(1)} {b.critical_product_boost > 0 ? `+ ${b.critical_product_boost.toFixed(0)} Boost` : ''}
                    </div>
                  </div>

                  {/* View Details / Explanation Button */}
                  <button
                    onClick={() => onSelectItem(item)}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
                  >
                    <HelpCircle size={16} /> Why is this #{item.rank}? <ArrowRight size={14} />
                  </button>

                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
