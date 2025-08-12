import React, { Suspense, useCallback, useMemo, useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useGlobalState } from './contexts/GlobalStateContext.tsx';
import { logEvent, logError } from './services/telemetryService.ts';
import { ALL_FEATURES, FEATURES_MAP } from './components/features/index.ts';
import type { ViewType, FeatureId, SidebarItem } from './types.ts';
import { ActionManager } from './components/ActionManager.tsx';
import { LeftSidebar } from './components/LeftSidebar.tsx';
import { StatusBar } from './components/StatusBar.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { Cog6ToothIcon, HomeIcon, FolderIcon, LinkIcon } from './components/icons/InterfaceIcons.tsx';
import { AiCommandCenter } from './components/features/AiCommandCenter.tsx';
import { LoginView } from './components/LoginView.tsx';
import { ProjectExplorer } from './components/features/ProjectExplorer.tsx';
import { Connections } from './components/features/Connections.tsx';
import { handleGitHubCallback, checkSession } from './services/authService.ts';


export const LoadingIndicator: React.FC<{text?: string}> = ({ text = "Loading..."}) => (
    <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0s' }}></div>
            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-text-secondary ml-2">{text}</span>
        </div>
    </div>
);

interface LocalStorageConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

const LocalStorageConsentModal: React.FC<LocalStorageConsentModalProps> = ({ onAccept, onDecline }) => {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center fade-in">
      <div 
        className="bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md m-4 p-8 text-center animate-pop-in"
      >
        <h2 className="text-2xl mb-4">Store Data Locally?</h2>
        <p className="text-text-secondary mb-6">
          To remember your session and preferences, this app needs to store small amounts of data in your browser's local storage. Is that okay?
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={onDecline} className="px-8 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">
            Decline
          </button>
          <button onClick={onAccept} className="btn-primary px-8 py-2">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const { state, dispatch } = useGlobalState();
  const { activeView, viewProps, isAuthenticated, hiddenFeatures } = state;
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [consentStatus, setConsentStatus] = useState<'pending' | 'granted' | 'declined'>(() => {
    try {
      return (localStorage.getItem('devcore_ls_consent') as 'granted' | 'declined' | null) || 'pending';
    } catch {
      return 'declined';
    }
  });

  const handleNavigation = useCallback((view: ViewType, props: any = {}) => {
    dispatch({ type: 'SET_VIEW', payload: { view, props } });
    logEvent('navigate', { view, props: Object.keys(props) });
  }, [dispatch]);

  const handleAcceptConsent = () => {
    try {
      localStorage.setItem('devcore_ls_consent', 'granted');
    } catch (e) {
      console.error("Could not set localStorage consent", e);
    }
    setConsentStatus('granted');
    window.location.reload(); // Reload to re-initialize state with persistence enabled
  };

  const handleDeclineConsent = () => {
    try {
      localStorage.setItem('devcore_ls_consent', 'declined');
    } catch (e) {
      console.error("Could not set localStorage consent", e);
    }
    setConsentStatus('declined');
  };

  useEffect(() => {
    const processAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      try {
        if (code) {
          logEvent('auth_callback_received');
          const { user, token } = await handleGitHubCallback(code);
          dispatch({ type: 'LOGIN', payload: { user, token } });
          // Clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // Check for existing session
          const session = await checkSession(state.token);
          if (session) {
            dispatch({ type: 'LOGIN', payload: session });
          }
        }
      } catch (error) {
        logError(error as Error, { context: 'processAuth' });
        // Clear invalid token if session check fails
        if (state.token && !code) dispatch({ type: 'LOGOUT' });
      } finally {
        setIsAuthenticating(false);
      }
    };

    if (consentStatus !== 'pending') {
      processAuth();
    } else {
        setIsAuthenticating(false);
    }
  }, [dispatch, state.token, consentStatus]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const ActiveFeatureComponent = useMemo(() => {
    return FEATURES_MAP.get(activeView as FeatureId)?.component;
  }, [activeView]);

  const sidebarItems: SidebarItem[] = useMemo(() => [
    { id: 'home', label: 'Home', icon: <HomeIcon />, view: 'ai-command-center' },
    { id: 'connections', label: 'Connections', icon: <LinkIcon />, view: 'connections' },
    { id: 'explorer', label: 'Project Explorer', icon: <FolderIcon />, view: 'project-explorer' },
    ...ALL_FEATURES
      .filter(f => !['ai-command-center', 'connections', 'project-explorer'].includes(f.id) && !hiddenFeatures.includes(f.id))
      .map(f => ({ id: f.id, label: f.name, icon: f.icon, view: f.id })),
    { id: 'settings', label: 'Settings', icon: <Cog6ToothIcon />, view: 'settings' },
  ], [hiddenFeatures]);

  if (consentStatus === 'pending') {
    return <LocalStorageConsentModal onAccept={handleAcceptConsent} onDecline={handleDeclineConsent} />;
  }

  if (isAuthenticating) {
    return <LoadingIndicator text="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-background text-text-primary flex flex-col font-sans">
        <div className="flex flex-grow min-h-0">
          <LeftSidebar items={sidebarItems} activeView={activeView} onNavigate={handleNavigation} />
          <main className="flex-1 flex flex-col min-h-0 relative">
            <Suspense fallback={<LoadingIndicator />}>
              {ActiveFeatureComponent && <ActiveFeatureComponent {...viewProps} />}
              {activeView === 'settings' && <SettingsView />}
              {activeView === 'project-explorer' && <ProjectExplorer />}
              {activeView === 'connections' && <Connections />}
            </Suspense>
             <ActionManager />
          </main>
        </div>
        <StatusBar bgImageStatus={'loaded'} />
      </div>
       <CommandPalette 
          isOpen={isPaletteOpen} 
          onClose={() => setPaletteOpen(false)} 
          onSelect={(view) => {
            handleNavigation(view);
            setPaletteOpen(false);
          }}
      />
    </ErrorBoundary>
  );
};

export default App;
