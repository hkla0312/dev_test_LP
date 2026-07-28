import { Link, Navigate, useSearchParams } from 'react-router-dom'; import { AppHeader } from '../components/AppHeader'; import { AppNavigation } from '../components/AppNavigation';
export function Home() { const [params] = useSearchParams(); if (params.get('next') === 'watch') return <Navigate to="/watch" replace/>; return <main><AppHeader/><section className="landing panel"><p className="eyebrow">AUDIO ONLY LIVE SYSTEM</p><h1>CONNECT TO THE<br/>ON-BOX</h1><p>映像は配信しません。アーティストの音声、ビジュアル、弾幕を接続します。</p><Link className="button" to="/watch">MEMBERとして配信を見る</Link><Link className="button ghost" to="/broadcast">BROADCASTERとして配信する</Link></section><AppNavigation/></main>; }
export const UserLogin = () => <Navigate to="/" replace/>;
export const BroadcasterLogin = () => <Navigate to="/" replace/>;
