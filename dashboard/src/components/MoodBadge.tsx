import type { Mood } from '@kitsune/shared';
import '../styles/MoodBadge.css';

type MoodBadgeProps = {
  mood: Mood;
};

export const MoodBadge = ({ mood }: MoodBadgeProps) => {
  return (
    <span className={`mood-badge mood-badge-${mood}`}>
      <span className="mood-dot"></span>
      {mood}
    </span>
  );
};
