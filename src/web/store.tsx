import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AttemptSummary,
  Lang,
  Scenario,
  Session,
  TeacherState,
  Turn,
} from '../core/types.js';
import { emptyTeacherState } from '../core/progression.js';
import { selectNextScenario } from '../core/selection.js';
import { getContentPack } from '../content/index.js';
import type { LoadedPack } from '../content/schema.js';
import type { ProfileRequest, ScoreResponse } from '../shared/api.js';
import type { HealthPayload } from '../shared/api.js';
import * as api from './api.js';
import { translate, type MessageKey, type UiLang } from './i18n.js';
import { pendingCount, syncPending } from './offline.js';

export interface PracticeDraft {
  scenario: Scenario;
  mode: 'online' | 'offline';
  session: Session | null;
  turns: Turn[];
  done: boolean;
  startedAt: string;
}

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface AppContextValue {
  ready: boolean;
  contentError: string | null;
  content: LoadedPack;
  health: HealthPayload | null;
  teacherId: string;
  teacherState: TeacherState | null;
  profile: TeacherState['profile'] | null;
  attempts: AttemptSummary[];
  nextScenario: Scenario | null;
  practiceLang: Lang;
  uiLang: UiLang;
  setUiLang(lang: UiLang): void;
  voiceEnabled: boolean;
  setVoiceEnabled(value: boolean): void;
  online: boolean;
  pending: number;
  refreshPending(): void;
  draft: PracticeDraft | null;
  setDraft(draft: PracticeDraft | null): void;
  result: ScoreResponse | null;
  setResult(result: ScoreResponse | null): void;
  startScenario: Scenario | null;
  startPractice(scenario: Scenario): void;
  consumeStartScenario(): void;
  saveProfile(profile: ProfileRequest): Promise<void>;
  refreshState(): Promise<void>;
  syncNow(manual?: boolean): Promise<void>;
  toast(message: string, tone?: Toast['tone']): void;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
  navigate(path: string): void;
  clearLocal(): void;
  installAvailable: boolean;
  install(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const K = {
  state: 'abhyas:teacher-state',
  attempts: 'abhyas:attempts',
  uiLang: 'abhyas:ui-lang',
  voice: 'abhyas:voice',
  cohort: 'abhyas:cohort-cache',
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [content, setContent] = useState<LoadedPack | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [teacherId] = useState<string>(() => api.getTeacherId());
  const [teacherState, setTeacherState] = useState<TeacherState | null>(() => readJson<TeacherState>(K.state));
  const [attempts, setAttempts] = useState<AttemptSummary[]>(() => readJson<AttemptSummary[]>(K.attempts) ?? []);
  const [uiLang, setUiLangState] = useState<UiLang>(() => {
    const saved = localStorage.getItem(K.uiLang);
    if (saved === 'hi' || saved === 'en') return saved;
    const state = readJson<TeacherState>(K.state);
    return state?.profile.language === 'hi' ? 'hi' : 'en';
  });
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(
    () => localStorage.getItem(K.voice) !== 'false',
  );
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [pending, setPending] = useState<number>(() => pendingCount());
  const [draft, setDraft] = useState<PracticeDraft | null>(null);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [startScenario, setStartScenario] = useState<Scenario | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const toastSeq = useRef(0);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(uiLang, key, vars),
    [uiLang],
  );

  const toast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastSeq.current;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4600);
  }, []);

  const setUiLang = useCallback((lang: UiLang) => {
    setUiLangState(lang);
    localStorage.setItem(K.uiLang, lang);
    document.documentElement.lang = lang;
  }, []);

  const setVoiceEnabled = useCallback((value: boolean) => {
    setVoiceEnabledState(value);
    localStorage.setItem(K.voice, String(value));
  }, []);

  const persistState = useCallback((state: TeacherState | null) => {
    setTeacherState(state);
    if (state) localStorage.setItem(K.state, JSON.stringify(state));
    else localStorage.removeItem(K.state);
  }, []);

  const persistAttempts = useCallback((list: AttemptSummary[]) => {
    setAttempts(list);
    localStorage.setItem(K.attempts, JSON.stringify(list));
  }, []);

  const refreshPending = useCallback(() => setPending(pendingCount()), []);

  const refreshState = useCallback(async () => {
    const cached = readJson<TeacherState>(K.state);
    if (cached) setTeacherState(cached);
    try {
      const state = await api.fetchState(teacherId);
      persistState(state.state);
      persistAttempts(state.attempts);
      setStartScenario(state.nextScenario ?? null);
    } catch (err) {
      if (api.isOfflineError(err)) {
        setOnline(false);
        return;
      }
      if (err instanceof api.ApiError && err.status === 404 && cached) {
        try {
          const created = await api.saveProfile(teacherId, {
            curriculum: cached.profile.curriculum,
            language: cached.profile.language,
          });
          persistState(created.state);
        } catch {
          // stays local
        }
      }
    }
  }, [teacherId, persistState, persistAttempts]);

  const syncNow = useCallback(
    async (manual = false) => {
      if (!navigator.onLine) {
        setOnline(false);
        if (manual) toast(t('error.offline'), 'error');
        return;
      }
      setOnline(true);
      try {
        const { verified, response } = await syncPending(teacherId);
        if (response) {
          persistState(response.state);
          if (verified > 0) toast(t('toast.synced', { n: verified }), 'success');
        }
        await refreshState();
        refreshPending();
      } catch (err) {
        if (api.isOfflineError(err)) setOnline(false);
        else if (manual) toast(t('error.generic'), 'error');
      }
    },
    [teacherId, persistState, refreshState, refreshPending, toast, t],
  );

  /* Bootstrap: content + cached state + background verification. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await api.content();
        if (!cancelled) {
          setContent({ rubric: payload.rubric, scenarios: payload.scenarios, packVersion: payload.packVersion });
        }
      } catch {
        try {
          const local = await getContentPack();
          if (!cancelled) setContent(local);
        } catch {
          if (!cancelled) setContentError('The content pack could not be loaded.');
        }
      }
      try {
        const h = await api.health();
        if (!cancelled) setHealth(h);
      } catch {
        // offline: health is optional
      }
      const cached = readJson<TeacherState>(K.state);
      if (cached && !cancelled) {
        setTeacherState(cached);
        setAttempts(readJson<AttemptSummary[]>(K.attempts) ?? []);
      }
      if (!cancelled) setReady(true);
      if (cached) {
        if (navigator.onLine) await syncNow(false);
        else setOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once; syncNow is stable enough for bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow(false);
    };
    const goOffline = () => {
      setOnline(false);
      refreshPending();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncNow, refreshPending]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const saveProfile = useCallback(
    async (profile: ProfileRequest) => {
      const local = teacherState ?? emptyTeacherState({
        id: teacherId,
        createdAt: new Date().toISOString(),
        curriculum: profile.curriculum,
        language: profile.language,
        currentLevel: 1,
      });
      local.profile.curriculum = profile.curriculum;
      local.profile.language = profile.language;
      local.levelHistory[1] ??= new Date().toISOString();
      persistState(local);
      setUiLang(profile.language === 'hi' ? 'hi' : 'en');
      try {
        const created = await api.saveProfile(teacherId, profile);
        persistState(created.state);
      } catch (err) {
        if (!api.isOfflineError(err)) throw err;
        setOnline(false);
      }
      toast(t('toast.profileSaved'), 'success');
      setStartScenario(null);
      apiSaveHash('/home');
    },
    [teacherId, teacherState, persistState, setUiLang, toast, t],
  );

  const clearLocal = useCallback(() => {
    for (const key of [K.state, K.attempts, K.cohort, 'abhyas:pending-attempts']) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem('abhyas:teacher-id');
    setTeacherState(null);
    setAttempts([]);
    setDraft(null);
    setResult(null);
    setStartScenario(null);
    setPending(0);
    apiSaveHash('/onboarding');
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) {
      toast(t('toast.install'), 'info');
      return;
    }
    await installEvent.prompt();
    setInstallEvent(null);
  }, [installEvent, toast, t]);

  const startPractice = useCallback((scenario: Scenario) => {
    setDraft(null);
    setResult(null);
    setStartScenario(scenario);
    apiSaveHash('/practice');
  }, []);

  const consumeStartScenario = useCallback(() => setStartScenario(null), []);

  const practiceLang: Lang =
    teacherState?.profile.language === 'hi' ? 'hi' : teacherState?.profile.language === 'en' ? 'en' : 'en';

  const nextScenario = useMemo(
    () => teacherState && content ? selectNextScenario(content.scenarios, teacherState, teacherState.profile.currentLevel) : null,
    [teacherState, content],
  );

  const value: AppContextValue | null = content
    ? {
        ready,
        contentError,
        content,
        health,
        teacherId,
        teacherState,
        profile: teacherState?.profile ?? null,
        attempts,
        nextScenario: nextScenario ?? startScenario,
        practiceLang,
        uiLang,
        setUiLang,
        voiceEnabled,
        setVoiceEnabled,
        online,
        pending,
        refreshPending,
        draft,
        setDraft,
        result,
        setResult,
        startScenario,
        startPractice,
        consumeStartScenario,
        saveProfile,
        refreshState,
        syncNow,
        toast,
        t,
        navigate: apiSaveHash,
        clearLocal,
        installAvailable: Boolean(installEvent),
        install,
      }
    : null;

  if (!value) {
    return (
      <div className="boot">
        <div className="boot-mark">अ</div>
        <p>{contentError ?? 'Loading Abhyas…'}</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`}>
            {item.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

function apiSaveHash(path: string): void {
  const clean = path.startsWith('/') ? path : `/${path}`;
  window.location.hash = `#${clean}`;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
