// Server entry point: starts the Express app on a port. (CHA-7)

import app from './app.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
