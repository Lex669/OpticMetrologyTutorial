import { useEffect, useState } from 'react';
import TimeDomainLab from './TimeDomainLab';
import SpectralLab from './SpectralLab';
import EllipsometryLab from './EllipsometryLab';
import type { Technique } from './LabShell';

const ROUTES: Record<Technique, string> = { td: '#td-oct', sd: '#sd-oct', ellipsometry: '#ellipsometry' };
function readRoute(): Technique {
  return (Object.keys(ROUTES) as Technique[]).find(key => ROUTES[key] === window.location.hash) ?? 'td';
}

export default function App() {
  const [technique, setTechnique] = useState<Technique>(readRoute);
  useEffect(() => {
    const update = () => setTechnique(readRoute());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); };
  }, []);
  const navigate = (next: Technique) => {
    if (next === technique) return;
    window.history.pushState(null, '', ROUTES[next]);
    setTechnique(next);
  };
  if (technique === 'sd') return <SpectralLab onNavigate={navigate} />;
  if (technique === 'ellipsometry') return <EllipsometryLab onNavigate={navigate} />;
  return <TimeDomainLab onNavigate={navigate} />;
}
