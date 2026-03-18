import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { ThemeProvider } from './app/theme';

function App() {
  return (
    <ThemeProvider>
      <div className="app-root">
        <RouterProvider router={router} />
      </div>
    </ThemeProvider>
  );
}

export default App;
