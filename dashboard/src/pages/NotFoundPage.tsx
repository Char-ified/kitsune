import { Link } from 'react-router';
import { Panel } from '../components/Panel';

export const NotFoundPage = () => {
  return (
    <div>
      <Panel title="Page not found">
        <p>This page wandered off into the night.</p>
        <Link to="/">Back to my repos</Link>
      </Panel>
    </div>
  );
};
