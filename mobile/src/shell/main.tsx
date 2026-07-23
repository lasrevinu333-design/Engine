import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { definition, runtime } from '@memphis-zoo/edition-entry';
import { ShellApp } from './AppShell';
import './shell.css';

document.documentElement.style.setProperty('--mz-edition-color', definition.themeColor);
document.title = definition.title;

const root = document.getElementById('root');
if (!root) throw new Error('The Memphis Zoo shell root is missing.');

createRoot(root).render(
  <StrictMode>
    <ShellApp definition={definition} runtime={runtime} />
  </StrictMode>,
);
