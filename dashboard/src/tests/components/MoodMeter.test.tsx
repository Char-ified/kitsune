import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoodMeter } from '../../components/MoodMeter';

describe('MoodMeter', () => {
  it('fills every segment when happy', () => {
    const { container } = render(<MoodMeter mood="happy" />);

    expect(container.querySelectorAll('.segment')).toHaveLength(20);
    expect(container.querySelectorAll('.segment-filled')).toHaveLength(20);
  });

  it('fills fewer segments when sick', () => {
    const { container } = render(<MoodMeter mood="sick" />);

    expect(container.querySelectorAll('.segment-filled')).toHaveLength(4);
  });

  it('has a label screen readers can announce', () => {
    render(<MoodMeter mood="normal" />);

    expect(screen.getByRole('img', { name: 'Mood: normal' })).toBeInTheDocument();
  });
});
