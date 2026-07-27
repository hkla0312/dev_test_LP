import { useEffect, useState } from 'react';
export const useClock = () => { const [now, setNow] = useState(Date.now()); useEffect(() => { const tick = () => setNow(Date.now()); const id = window.setInterval(tick, 1000); document.addEventListener('visibilitychange', tick); return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); }; }, []); return now; };
