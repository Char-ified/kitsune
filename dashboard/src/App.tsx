import { Button } from './components/Button';

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
    </div>
  );
};
