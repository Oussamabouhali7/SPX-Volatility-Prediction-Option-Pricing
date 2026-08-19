// Suppress MetaMask noise
const _ce = console.error; console.error = (...a) => { if (String(a[0]||'').includes('MetaMask')) return; _ce(...a); };
const _cw = console.warn; console.warn = (...a) => { if (String(a[0]||'').includes('MetaMask')) return; _cw(...a); };

// index.js — Point d'entrée React
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import pwcTheme from './theme/pwcTheme';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={pwcTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
