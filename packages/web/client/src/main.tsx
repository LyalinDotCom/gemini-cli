/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
// Use ReconcilerApp for WebSocket reconciler mode
// Switch back to App for the original chat mode
import ReconcilerApp from './ReconcilerApp';
import './styles/terminal.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReconcilerApp />
  </React.StrictMode>,
);
