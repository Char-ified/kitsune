import type { Mood } from '@kitsune/shared';
import '../styles/MoodMeter.css';

const FILLED_SEGMENTS: Record<Mood, number> = {
  happy: 20,
  normal: 10,
  sick: 4,
};

const TOTAL_SEGMENTS = 20;

type MoodMeterProps = {
  mood: Mood;
};

export const MoodMeter = ({ mood }: MoodMeterProps) => {
  const filled = FILLED_SEGMENTS[mood];

  return (
    <div className={`mood-meter mood-meter-${mood}`} role="img" aria-label={`Mood: ${mood}`}>
      {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
        <span key={i} className={i < filled ? 'segment segment-filled' : 'segment'} />
      ))}
    </div>
  );
};
