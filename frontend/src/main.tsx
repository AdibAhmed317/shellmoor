import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource-variable/inter/opsz.css'; // optical sizes: display cut at large sizes, like SF Pro
import '@fontsource-variable/jetbrains-mono'; // bundled so mono text looks the same on every OS
import './style.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
