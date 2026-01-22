/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line import/no-internal-modules -- React 19 client API
import ReactDOM from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);
root.render(<App />);
