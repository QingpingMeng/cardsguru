import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from './App';
import { ThemeProvider } from './components/ThemeProvider';

describe('App', () => {
  it('boots and renders the app shell', async () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    // After init() resolves (disconnected, local-only), the shell renders with the brand + nav.
    expect(await screen.findAllByText(/cardsguru/i)).not.toHaveLength(0);
    expect(await screen.findAllByText('Benefits')).not.toHaveLength(0);
  });
});
