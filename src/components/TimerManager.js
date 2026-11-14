import { useEffect, useState } from 'react';
import { useVault } from '../context/VaultContext';

export default function TimerManager() {
  const { studyState, saveStudyState } = useVault();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const active = studyState.activeTimer;
  useEffect(() => {
    if (!active || active.paused || active.endAt > now) return;
    saveStudyState(current => {
      if (current.activeTimer?.id !== active.id) return current;
      const sessions = active.phase === 'focus' && !current.sessions.some(session => session.id === active.id)
        ? [...current.sessions, { id: active.id, module: active.module || '', seconds: active.duration, finished_at: new Date(active.endAt).toISOString() }]
        : current.sessions;
      return { ...current, sessions, activeTimer: null, timerNotice: active.phase === 'focus' ? 'Focus session complete. Take a break!' : 'Break complete. Ready for another session?' };
    }).catch(error => console.error('Unable to save completed timer', error));
  }, [active?.id, active?.endAt, active?.paused, now]);
  return null;
}
