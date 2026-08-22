import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { LandingAuth } from './components/LandingAuth';
import { WorkspaceShell } from './components/WorkspaceShell';
import { AppOverview, ComparePage, GoldSetPage, InventoryPage, NegativeTestPage, ProfileCustomPage, ProfilesPage, TriageDetailPage, TriagePage, WorkspaceContext } from './components/WorkspacePages';
import { apiFetch } from './api';
import { OrgProfile, TriageItem } from './types';

const AUTH_STORAGE_KEY = 'nexora_auth_token';
export interface SessionUser { name: string; email: string; }

function sessionUserFromToken(token: string | null): SessionUser {
  try {
    const payload = token?.split('.')[1];
    if (!payload) throw new Error('No token payload');
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return { name: data.name || data.email || 'Nexora user', email: data.email || '' };
  } catch { return { name: 'Nexora user', email: '' }; }
}

function LoadingState({ message = 'Loading workspace…' }: { message?: string }) {
  return <div className="workspace-state"><RefreshCw size={28} className="spin" /><p>{message}</p></div>;
}

function ProtectedWorkspace({ onSignOut, user }: { onSignOut: () => void; user: SessionUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [customProfileIds, setCustomProfileIds] = useState<string[]>([]);
  const [top5, setTop5] = useState<TriageItem[]>([]);
  const [inventory, setInventory] = useState<TriageItem[]>([]);
  const [triageLoading, setTriageLoading] = useState(true);
  const [showingCachedTriage, setShowingCachedTriage] = useState(false);
  const triageCache = useRef(new Map<string, { top5: TriageItem[]; inventory: TriageItem[] }>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedProfileId = searchParams.get('profile');
  const activeProfile = useMemo(() => profiles.find((profile) => profile.org_id === requestedProfileId) || profiles.find((profile) => profile.org_id === 'ORG-002') || profiles[0] || null, [profiles, requestedProfileId]);

  const selectProfile = (profile: OrgProfile) => {
    const next = new URLSearchParams(searchParams);
    next.set('profile', profile.org_id);
    setSearchParams(next, { replace: true });
  };
  const refreshProfiles = async () => {
    setLoading(true); setError(null);
    try {
      const profilesResponse = await apiFetch('/api/profiles');
      if (!profilesResponse.ok) throw new Error('Failed to load organisation profiles.');
      const result = await profilesResponse.json();
      setProfiles(result.profiles || []);
      setCustomProfileIds(result.custom_profile_ids || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cannot connect to the backend server.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refreshProfiles(); }, []);
  useEffect(() => {
    if (!activeProfile) return;
    const controller = new AbortController();
    const cached = triageCache.current.get(activeProfile.org_id);
    setTriageLoading(true);
    setShowingCachedTriage(Boolean(cached));
    if (cached) {
      setTop5(cached.top5);
      setInventory(cached.inventory);
    } else {
      setTop5([]);
      setInventory([]);
    }
    const loadTriage = async () => {
      try {
        const response = await apiFetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ profile_id: activeProfile.org_id }) });
        if (!response.ok) throw new Error('Unable to calculate triage for this profile.');
        const result = await response.json();
        const nextData = { top5: result.top_5 || [], inventory: result.inventory || [] };
        triageCache.current.set(activeProfile.org_id, nextData);
        setTop5(nextData.top5); setInventory(nextData.inventory); setShowingCachedTriage(false);
      } catch (reason) { if ((reason as Error).name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Unable to load triage data.'); }
      finally { if (!controller.signal.aborted) setTriageLoading(false); }
    };
    void loadTriage(); return () => controller.abort();
  }, [activeProfile]);
  const onProfileUploaded = (profile: OrgProfile) => { setProfiles((current) => [...current.filter((item) => item.org_id !== profile.org_id), profile]); setCustomProfileIds((current) => [...new Set([...current, profile.org_id])]); selectProfile(profile); };
  const deleteCustomProfile = async (profile: OrgProfile) => {
    const response = await apiFetch(`/api/profiles/${encodeURIComponent(profile.org_id)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Unable to delete this custom profile.');
    const remaining = profiles.filter((item) => item.org_id !== profile.org_id);
    setProfiles(remaining); setCustomProfileIds((current) => current.filter((id) => id !== profile.org_id));
    if (activeProfile?.org_id === profile.org_id && remaining[0]) selectProfile(remaining.find((item) => item.org_id === 'ORG-002') || remaining[0]);
  };

  if (loading) return <LoadingState message="Loading organisation profiles…" />;
  if (error && profiles.length === 0) return <div className="workspace-state"><AlertCircle size={32} /><h2>Workspace unavailable</h2><p>{error}</p><button className="btn-primary" onClick={() => void refreshProfiles()}><RefreshCw size={16} /> Retry</button></div>;
  if (!activeProfile) return <div className="workspace-state"><AlertCircle size={32} /><h2>No organisation profiles found</h2></div>;
  const context: WorkspaceContext = { profiles, activeProfile, selectProfile, top5, inventory, triageLoading, showingCachedTriage, onProfileUploaded, customProfileIds, deleteCustomProfile };
  return <WorkspaceShell activeProfile={activeProfile} user={user} onSignOut={onSignOut}>{error && <div className="workspace-inline-error"><AlertCircle size={17} /> {error}</div>}<Outlet context={context} /></WorkspaceShell>;
}

function AuthenticatedRoutes() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY));
  const navigate = useNavigate(); const location = useLocation();
  const signIn = (nextToken: string) => { localStorage.setItem(AUTH_STORAGE_KEY, nextToken); setToken(nextToken); navigate('/app', { replace: true }); };
  const signOut = () => { localStorage.removeItem(AUTH_STORAGE_KEY); setToken(null); navigate('/', { replace: true }); };
  if (!token && location.pathname.startsWith('/app')) return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  return <Routes>
    <Route path="/" element={token ? <Navigate to="/app" replace /> : <LandingAuth onEnterApp={signIn} />} />
    <Route path="/app" element={token ? <ProtectedWorkspace onSignOut={signOut} user={sessionUserFromToken(token)} /> : <Navigate to="/" replace />}>
      <Route index element={<AppOverview />} /><Route path="triage" element={<TriagePage />} /><Route path="triage/:cveId" element={<TriageDetailPage />} />
      <Route path="compare" element={<ComparePage />} /><Route path="negative-test" element={<NegativeTestPage />} /><Route path="gold-set" element={<GoldSetPage />} />
      <Route path="inventory" element={<InventoryPage />} /><Route path="inventory/:cveId" element={<TriageDetailPage />} />
      <Route path="profiles" element={<ProfilesPage />} /><Route path="profiles/custom" element={<ProfileCustomPage />} />
    </Route>
    <Route path="*" element={<Navigate to={token ? '/app' : '/'} replace />} />
  </Routes>;
}

export default function App() { return <BrowserRouter><AuthenticatedRoutes /></BrowserRouter>; }
