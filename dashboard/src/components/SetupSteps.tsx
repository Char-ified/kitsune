import '../styles/SetupSteps.css';

const STEPS = ['Connect a repo', 'Pick a character', 'Set up webhook'];

type SetupStepsProps = {
  /** Which step the user is on: 1, 2, or 3. */
  current: 1 | 2 | 3;
};

// The "01 / 02 / 03" trail at the top of the three setup pages.
export const SetupSteps = ({ current }: SetupStepsProps) => {
  return (
    <ol className="setup-steps">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'upcoming';

        return (
          <li
            key={label}
            className={`setup-step setup-step-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="setup-step-number">{state === 'done' ? '✓' : `0${number}`}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
};
