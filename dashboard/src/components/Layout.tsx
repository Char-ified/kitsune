// components/Layout.tsx
import { Outlet } from 'react-router';
import { Button } from './Button';
import '../styles/Layout.css';

export const Layout = () => {
  return (
    <>
      <header>
        <span className="header-title">Kitsune Repo Pet</span>
        <Button variant="secondary">Log out</Button>
      </header>
      <main>
        <Outlet /> {/* ← the current page appears here */}
      </main>
    </>
  );
};
