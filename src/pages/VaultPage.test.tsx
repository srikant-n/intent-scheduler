// Tests for VaultPage: renders all vault cards and wires their notify callback
// into the shared toast, including auto-dismissal.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultPage } from './VaultPage';

vi.mock('@/components/vault/ExportVaultCard', () => ({
  ExportVaultCard: ({ onNotify }: { onNotify: (message: string, kind?: 'success' | 'error') => void }) => (
    <button onClick={() => onNotify('JSON exported')}>mock-export</button>
  ),
}));

vi.mock('@/components/vault/RestoreVaultCard', () => ({
  RestoreVaultCard: ({ onNotify }: { onNotify: (message: string, kind?: 'success' | 'error') => void }) => (
    <button onClick={() => onNotify('Restore failed', 'error')}>mock-restore</button>
  ),
}));

vi.mock('@/components/vault/ClearVaultCard', () => ({
  ClearVaultCard: ({ onNotify }: { onNotify: (message: string, kind?: 'success' | 'error') => void }) => (
    <button onClick={() => onNotify('Vault cleared')}>mock-clear</button>
  ),
}));

vi.mock('@/components/vault/VaultHealthCard', () => ({
  VaultHealthCard: ({ onNotify }: { onNotify: (message: string, kind?: 'success' | 'error') => void }) => (
    <button onClick={() => onNotify('Health checked')}>mock-health</button>
  ),
}));

describe('VaultPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the vault heading and all management cards', () => {
    render(<VaultPage />);

    expect(screen.getByRole('heading', { name: /Data Vault & Storage Health/ })).toBeInTheDocument();
    expect(screen.getByText('mock-export')).toBeInTheDocument();
    expect(screen.getByText('mock-restore')).toBeInTheDocument();
    expect(screen.getByText('mock-clear')).toBeInTheDocument();
    expect(screen.getByText('mock-health')).toBeInTheDocument();
  });

  it('shows a success toast from a vault card and auto-dismisses it', () => {
    render(<VaultPage />);

    fireEvent.click(screen.getByText('mock-export'));
    expect(screen.getByText('JSON exported')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3600));
    expect(screen.queryByText('JSON exported')).not.toBeInTheDocument();
  });

  it('shows error toasts with the danger styling', () => {
    render(<VaultPage />);

    fireEvent.click(screen.getByText('mock-restore'));

    const toast = screen.getByText('Restore failed').parentElement;
    expect(toast).toHaveClass('bg-danger');
  });
});
