import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';
import { ComparisonItem, OrgProfile } from '../types';
import { apiFetch } from '../api';
import { TableSkeleton } from './LoadingSkeleton';

interface CompareModeProps { profiles: OrgProfile[]; }

export const CompareMode: React.FC<CompareModeProps> = ({ profiles }) => {
  const [orgId1, setOrgId1] = useState('ORG-001');
  const [orgId2, setOrgId2] = useState('ORG-002');
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);
  const profile1 = profiles.find((profile) => profile.org_id === orgId1) || profiles[0];
  const profile2 = profiles.find((profile) => profile.org_id === orgId2) || profiles[1] || profiles[0];

  useEffect(() => { void fetchComparison(); }, [orgId1, orgId2]);
  const fetchComparison = async () => {
    setLoading(true);
    try { const response = await apiFetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id_1: orgId1, org_id_2: orgId2 }) }); const data = await response.json(); setComparison(data.comparison || []); }
    catch (error) { console.error('Error fetching comparison:', error); }
    finally { setLoading(false); }
  };

  return <div className="compare-mode">
    <section className="validation-intro compare-intro"><Sparkles size={21} /><div><p>Context comparison</p><h2>Same CVE. Different business priority.</h2><span>Compare how each organisation's critical inventory and scoring preferences alter the outcome.</span></div></section>
    <div className="profile-compare-controls"><ProfileControl label="Profile A" profile={profile1} value={orgId1} profiles={profiles} onChange={setOrgId1} tone="blue" /><div className="compare-switch"><ArrowRightLeft size={18} /></div><ProfileControl label="Profile B" profile={profile2} value={orgId2} profiles={profiles} onChange={setOrgId2} tone="pink" /></div>
    <div className="compare-table-wrap">{loading ? <TableSkeleton rows={4} /> : <table className="compare-table"><thead><tr><th>Vulnerability</th><th>{profile1?.name}</th><th>{profile2?.name}</th><th>Context</th></tr></thead><tbody>{comparison.map((item) => <tr key={item.cve_id}><td><code>{item.cve_id}</code><strong>{item.product_name}</strong><span>CVSS {item.cvss_base_score.toFixed(1)} · EPSS {(item.first_epss * 100).toFixed(1)}%</span></td><td><RankCell rank={item.rank_org1} score={item.score_org1} tone="blue" /></td><td><RankCell rank={item.rank_org2} score={item.score_org2} tone="pink" /></td><td><ComparisonContext item={item} profile1={profile1} profile2={profile2} /></td></tr>)}</tbody></table>}</div>
  </div>;
};

function ProfileControl({ label, profile, value, profiles, onChange, tone }: { label: string; profile?: OrgProfile; value: string; profiles: OrgProfile[]; onChange: (value: string) => void; tone: 'blue' | 'pink' }) { return <section className={`profile-compare-card ${tone}`}><p>{label}</p><select value={value} onChange={(event) => onChange(event.target.value)}>{profiles.map((candidate) => <option key={candidate.org_id} value={candidate.org_id}>{candidate.name}</option>)}</select><span>{profile?.critical_products.length || 0} critical products · EPSS weight {Math.round((profile?.weight_modifiers.first_epss_weight || 0) * 100)}%</span></section>; }
function RankCell({ rank, score, tone }: { rank: number | null; score: number | null; tone: 'blue' | 'pink' }) { return rank ? <div className={`rank-cell ${tone}`}><b>#{rank}</b><span>{score?.toFixed(1)}</span></div> : <span className="excluded-chip">Excluded</span>; }
function ComparisonContext({ item, profile1, profile2 }: { item: ComparisonItem; profile1?: OrgProfile; profile2?: OrgProfile }) { if (item.rank_org1 && item.rank_org2) return <span className="comparison-context">Both organisations use this asset; their weights change its rank.</span>; if (item.rank_org1) return <span className="comparison-context">Critical for {profile1?.name}; outside {profile2?.name}'s critical inventory.</span>; if (item.rank_org2) return <span className="comparison-context">Critical for {profile2?.name}; outside {profile1?.name}'s critical inventory.</span>; return <span className="comparison-context">Outside both critical inventories.</span>; }
