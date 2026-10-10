import type { ReactNode } from 'react';
import '../styles/AuthPages.css';

type AuthShellProps = {
  scene: 'full' | 'crescent';
  children: ReactNode;
};

// The two-column layout shared by the log in and sign up pages:
// the hero on the left, the form (children) on the right.
export const AuthShell = ({ scene, children }: AuthShellProps) => {
  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <h1 className="auth-headline">
          Your repo.
          <br />
          Your spirit.
        </h1>
        <p className="auth-tagline">
          Merge a PR. Pass your tests. Watch your fox thrive. A small guardian for the code you
          ship.
        </p>
        <img
          className="auth-art"
          src={`/night-scene-${scene}.png`}
          alt="A pixel-art kitsune sitting in front of a city skyline at night"
        />
        <ol className="auth-steps">
          <li>
            <span>01</span> Connect a repo
          </li>
          <li>
            <span>02</span> Name your fox
          </li>
          <li>
            <span>03</span> Keep shipping
          </li>
        </ol>
      </section>
      <div className="auth-form">{children}</div>
    </div>
  );
};
