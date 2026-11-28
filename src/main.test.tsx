// Tests for the application entrypoint: mounts App inside StrictMode and the
// shared React Query provider with the app's query defaults.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: { createRoot: mocks.createRoot },
  createRoot: mocks.createRoot,
}));

vi.mock('./App', () => ({
  default: () => <div data-testid="mock-app" />,
}));

vi.mock('@fontsource-variable/plus-jakarta-sans', () => ({}));
vi.mock('./index.css', () => ({}));

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRoot.mockReturnValue({ render: mocks.render });
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('creates the root and renders App with the shared query client', async () => {
    await import('./main');

    const root = document.getElementById('root');
    expect(mocks.createRoot).toHaveBeenCalledWith(root);
    expect(mocks.render).toHaveBeenCalledOnce();

    const strictTree = mocks.render.mock.calls[0][0] as ReactElement<{ children: ReactNode }>;
    const provider = strictTree.props.children as ReactElement<{
      client: QueryClient;
      children: ReactNode;
    }>;
    expect(provider.type).toBe(QueryClientProvider);
    expect(provider.props.client).toBeInstanceOf(QueryClient);
    expect(provider.props.client.getDefaultOptions().queries).toMatchObject({
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    });

    const appElement = provider.props.children as ReactElement;
    expect(appElement.type).toBe(App);
  });
});
