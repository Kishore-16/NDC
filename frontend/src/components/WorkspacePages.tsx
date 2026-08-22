import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Flame, Layers3, Search, ShieldAlert, Sparkles, Star, Target } from 'lucide-react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { CompareMode } from './CompareMode';
import { GoldSetEvalView } from './GoldSetEvalView';
import { NegativeTestView } from './NegativeTestView';
import { ProfileSelector } from './ProfileSelector';
import { ProfileUploader } from './ProfileUploader';
import { VulnerabilityTable } from './VulnerabilityTable';
import { Skeleton, TableSkeleton, TriageSkeleton } from './LoadingSkeleton';
import { OrgProfile, TriageItem } from '../types';

export interface WorkspaceContext { profiles: OrgProfile[]; activeProfile: OrgProfile; selectProfile: (profile: OrgProfile) => void; top5: TriageItem[]; inventory: TriageItem[]; triageLoading: boolean; showingCachedTriage: boolean; onProfileUploaded: (profile: OrgProfile) => void; customProfileIds: string[]; deleteCustomProfile: (profile: OrgProfile) => Promise<void>; }
const useWorkspace = () => useOutletContext<WorkspaceContext>();
const profileQuery = (profile: OrgProfile) => `?profile=${encodeURIComponent(profile.org_id)}`;
const score = (item: TriageItem) => item.score_breakdown.final_score.toFixed(1);

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-heading"><p>{eyebrow}</p><h1>{title}</h1><div>{children}</div></header>;
}

export function AppOverview() {
  const { activeProfile, top5, inventory, triageLoading, showingCachedTriage } = useWorkspace(); const urgent = top5.filter((item) => item.priority_label.toLowerCase() === 'urgent').length;
  const epssWeight = Math.round(activeProfile.weight_modifiers.first_epss_weight * 100);
  return <div className="page-stack"><PageHeading eyebrow="Current security priority landscape" title={`Good to see you, ${activeProfile.name}.`}><p>Personalised decisions grounded in your organisation’s risk profile.</p></PageHeading>
    <section className="metric-grid">{triageLoading && !showingCachedTriage ? <MetricSkeletons /> : <><Metric value={inventory.length || '—'} label="Vulnerabilities analysed" /><Metric value={top5.length || '—'} label="Priority actions" /><Metric value={activeProfile.critical_products.length} label="Critical products" /><Metric value={`${epssWeight}%`} label="EPSS weighting" /></>}</section>
    {triageLoading && showingCachedTriage && <RefreshNotice />}
    <section className="overview-grid"><div className="priority-panel"><div><p>Current priority</p>{triageLoading && !showingCachedTriage ? <><Skeleton className="skeleton-heading" /><Skeleton className="skeleton-line short" /></> : <><h2>{top5.length} actions require attention</h2><span><i className="dot urgent" /> {urgent} urgent <i className="dot high" /> {Math.max(top5.length - urgent, 0)} other priorities</span></>}</div><Link className="btn-primary" to={`/app/triage${profileQuery(activeProfile)}`}>Open triage <ArrowRight size={16} /></Link></div>
      <div className="overview-panel"><p>Highest signal</p><strong>{epssWeight >= 50 ? 'Exploitation likelihood' : 'Confirmed exploitation'}</strong><span>{epssWeight >= 50 ? 'EPSS carries the most weight for this profile.' : 'CISA KEV and CVSS are strong decision inputs.'}</span></div></section>
    <section className="quick-actions"><Link to={`/app/triage${profileQuery(activeProfile)}`}><ShieldAlert size={19} /><span><strong>Review Top 5</strong><small>See what needs attention first</small></span><ArrowRight size={17} /></Link><Link to={`/app/compare${profileQuery(activeProfile)}`}><Layers3 size={19} /><span><strong>Compare profiles</strong><small>Show how context changes decisions</small></span><ArrowRight size={17} /></Link><Link to={`/app/negative-test${profileQuery(activeProfile)}`}><Target size={19} /><span><strong>Validate relevance</strong><small>Inspect high-CVSS exclusions</small></span><ArrowRight size={17} /></Link></section>
  </div>;
}
function Metric({ value, label }: { value: string | number; label: string }) { return <div className="metric-card"><strong>{value}</strong><span>{label}</span></div>; }
function MetricSkeletons() { return <>{Array.from({ length: 4 }, (_, index) => <div className="metric-card" key={index}><Skeleton className="skeleton-metric" /><Skeleton className="skeleton-label" /></div>)}</>; }
function RefreshNotice() { return <div className="refresh-notice"><span /> Refreshing the latest ranking for this organisation…</div>; }

export function TriagePage() {
  const { activeProfile, top5, triageLoading, showingCachedTriage } = useWorkspace(); const [filter, setFilter] = useState('all');
  const items = filter === 'all' ? top5 : top5.filter((item) => item.priority_label.toLowerCase() === filter);
  return <div className="page-stack"><PageHeading eyebrow={`Ranked for ${activeProfile.name}`} title="Your Top 5"><p>Focus on the vulnerabilities that matter to this organisation first.</p></PageHeading><div className="filter-bar"><div>{['all', 'urgent', 'high', 'medium'].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'selected' : ''}>{item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}</button>)}</div><span>Sorted by personalised score</span></div>{triageLoading && showingCachedTriage && <RefreshNotice />}{triageLoading && !showingCachedTriage ? <TriageSkeleton /> : <div className="triage-list">{items.map((item) => <TriageCard item={item} profile={activeProfile} key={item.cve_id} />)}{!items.length && <EmptyState title="No matching priorities" detail="Try a different severity filter." />}</div>}</div>;
}

function TriageCard({ item, profile }: { item: TriageItem; profile: OrgProfile }) {
  const priority = item.priority_label.toLowerCase();
  return <article className={`triage-card priority-${priority}`}><div className="triage-rank">#{item.rank}</div><div className="triage-card-main"><div className="triage-meta"><span className={`badge badge-${priority === 'urgent' ? 'urgent' : priority === 'high' ? 'high' : 'medium'}`}>{item.priority_label}</span><code>{item.cve_id}</code>{item.cisa_kev && <span className="signal signal-kev"><Flame size={13} /> KEV</span>}</div><h2>{item.plain_title}</h2><p className="triage-product">{item.product_name}{item.score_breakdown.is_critical_product && <span><Star size={13} fill="currentColor" /> Critical product</span>}</p><div className="signal-grid"><span><b>EPSS</b>{(item.first_epss * 100).toFixed(1)}%</span><span><b>CVSS</b>{item.cvss_base_score.toFixed(1)}</span><span><b>Signal</b>{item.cisa_kev ? 'Actively exploited' : 'Context ranked'}</span></div><p className="triage-reason">{item.why_ranked_here}</p></div><div className="triage-card-score"><strong>{score(item)}</strong><span>/ 100</span><Link className="btn-primary" to={`/app/triage/${encodeURIComponent(item.cve_id)}${profileQuery(profile)}`}>View decision <ArrowRight size={15} /></Link></div></article>;
}

export function TriageDetailPage() {
  const { activeProfile, top5, inventory, triageLoading, showingCachedTriage } = useWorkspace(); const { cveId } = useParams(); const navigate = useNavigate();
  const item = [...top5, ...inventory].find((candidate) => candidate.cve_id === cveId);
  if (triageLoading && !showingCachedTriage) return <div className="page-stack"><TriageSkeleton count={1} /></div>;
  if (!item) return <EmptyState title="Vulnerability not found" detail="This CVE is not available for the selected organisation profile." action={<button className="btn-primary" onClick={() => navigate(`/app/triage${profileQuery(activeProfile)}`)}><ArrowLeft size={16} /> Back to triage</button>} />;
  const b = item.score_breakdown;
  const contributions = [['EPSS', b.epss_contrib, '#38bdf8'], ['CISA KEV', b.kev_contrib, '#f59e0b'], ['CVSS', b.cvss_contrib, '#f87171'], ['Critical product', b.critical_product_boost, '#fbbf24']].filter(([, value]) => Number(value) > 0) as [string, number, string][];
  return <div className="page-stack decision-page"><Link className="back-link" to={`/app/triage${profileQuery(activeProfile)}`}><ArrowLeft size={16} /> Back to triage</Link><PageHeading eyebrow={`${item.priority_label} · ${item.cve_id}`} title={item.plain_title}><p>{item.product_name} for {activeProfile.name}</p></PageHeading><section className="decision-hero"><div><p>Personalised score</p><strong>{score(item)}<small>/100</small></strong><span>{item.cisa_kev ? 'Confirmed exploitation signal present' : 'Ranked using organisation context'}</span></div><div><p>Why this ranks #{item.rank}</p><h2>{item.why_ranked_here}</h2></div></section><section className="decision-grid"><div className="decision-panel"><h2>Decision breakdown</h2>{contributions.map(([name, value, color]) => <div className="contribution" key={name}><div><span>{name}</span><b>+{value.toFixed(1)}</b></div><i><em style={{ width: `${Math.min(value, 100)}%`, background: color }} /></i></div>)}</div><div className="decision-panel"><h2>Why this matters</h2><div className="fact-list"><Fact label="Exploitation" value={item.cisa_kev ? 'Confirmed in CISA KEV' : 'Not currently in CISA KEV'} /><Fact label="Likelihood" value={`EPSS ${(item.first_epss * 100).toFixed(1)}%`} /><Fact label="Organisational relevance" value={b.is_critical_product ? `${item.product_name} is a critical product` : item.product_name} /></div></div></section><section className="safe-action"><CheckCircle2 size={22} /><div><p>Next safe action</p><strong>{item.safe_next_action}</strong></div></section><section className="provenance-panel"><div><p>Source & provenance</p><strong>{item.provenance_sources.join(' · ')}</strong></div><div><p>Confidence</p><strong>{item.confidence_level} — {item.confidence_reason}</strong></div>{item.reference_url && <a href={item.reference_url} target="_blank" rel="noreferrer">View source <ExternalLink size={14} /></a>}</section></div>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
export function ComparePage() { const { profiles } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Context-aware ranking" title="Same threats. Different priorities."><p>See how organisation context changes vulnerability decisions.</p></PageHeading><CompareMode profiles={profiles} /></div>; }
export function NegativeTestPage() { const { activeProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Relevance validation" title="Does NEXORA understand relevance?"><p>A high CVSS score does not automatically mean high organisational priority.</p></PageHeading><NegativeTestView profile={activeProfile} /></div>; }
export function GoldSetPage() { const { activeProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Decision quality" title="Gold Set Evaluation"><p>Validate rankings against practitioner-ranked priorities.</p></PageHeading><GoldSetEvalView profile={activeProfile} /></div>; }

export function InventoryPage() {
  const { inventory, activeProfile, triageLoading, showingCachedTriage } = useWorkspace(); const [params] = useSearchParams(); const search = params.get('search') || '';
  return <div className="page-stack"><PageHeading eyebrow={`${inventory.length} records for ${activeProfile.name}`} title="Vulnerability Inventory"><p>Search the supplied data and inspect the contextual triage score.</p></PageHeading>{triageLoading && showingCachedTriage && <RefreshNotice />}{search && <div className="workspace-inline-note"><Search size={16} /> Search filter requested: “{search}”</div>}{triageLoading && !showingCachedTriage ? <TableSkeleton rows={7} /> : <VulnerabilityTable inventory={inventory} profileId={activeProfile.org_id} />}</div>;
}
export function ProfilesPage() { const { profiles, activeProfile, selectProfile, customProfileIds, deleteCustomProfile } = useWorkspace(); return <div className="page-stack"><PageHeading eyebrow="Organisation context" title="Organisation Profiles"><p>Select the organisation whose risk preferences should shape every decision. Custom profiles can be removed here.</p></PageHeading><ProfileSelector profiles={profiles} activeProfile={activeProfile} onSelectProfile={selectProfile} customProfileIds={customProfileIds} onDeleteProfile={deleteCustomProfile} /></div>; }
export function ProfileCustomPage() { const { onProfileUploaded, activeProfile } = useWorkspace(); const navigate = useNavigate(); return <ProfileUploader closeAfterUpload={false} onProfileUploaded={(profile) => { onProfileUploaded(profile); navigate(`/app/profiles${profileQuery(profile)}`); }} onClose={() => navigate(`/app/profiles${profileQuery(activeProfile)}`)} />; }
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <section className="empty-state"><AlertTriangle size={28} /><h1>{title}</h1><p>{detail}</p>{action}</section>; }
