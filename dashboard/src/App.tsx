import { Button } from './components/Button';
import { TextInput } from './components/TextInput';
import { Panel } from './components/Panel';
import { MoodBadge } from './components/MoodBadge';

export const App = () => {
  return (
    <div>
      <h1>Kitsune Repo Pet</h1>
      <p>Its only the begining!</p>
      <Button variant="primary">Connect repository</Button>
      <Button variant="secondary">View repository</Button>
      <Button variant="primary" disabled>
        Disable
      </Button>
      <Panel title="Log in">
        <TextInput label="Repository" placeholder="owner/repository" />
        <TextInput label="Email" error="Enter a valid email address." />
      </Panel>
      <MoodBadge mood="happy" />
      <MoodBadge mood="normal" />
      <MoodBadge mood="sick" />
    </div>
  );
};
