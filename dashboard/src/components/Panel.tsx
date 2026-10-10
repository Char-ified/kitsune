import type { ReactNode } from 'react';
import '../styles/Panel.css';

type PanelProps = {
  title?: string;
  children: ReactNode;
};

export const Panel = ({ title, children }: PanelProps) => {
  return (
    <section className="panel">
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  );
};
