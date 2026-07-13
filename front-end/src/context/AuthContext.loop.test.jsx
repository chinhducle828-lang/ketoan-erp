import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure the test uses a DOM environment because AuthProvider renders JSX and uses browser APIs.
/** @vitest-environment jsdom */
import { AuthProvider, useAuth } from './AuthContext.jsx';
import api from '../utils/api.js';

vi.mock('../utils/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

function Harness() {
  const { checkOpeningBalanceStatus } = useAuth();
  const initialRef = React.useRef(null);
  const rerenderCountRef = React.useRef(0);

  React.useEffect(() => {
    if (!initialRef.current) {
      initialRef.current = checkOpeningBalanceStatus;
    } else if (initialRef.current !== checkOpeningBalanceStatus) {
      rerenderCountRef.current += 1;
    }

    void checkOpeningBalanceStatus(1);
  }, [checkOpeningBalanceStatus]);

  return <div data-testid="ready">ready</div>;
}

describe('AuthContext loop guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({ data: { user: { id: 1, role: 'admin' }, fiscal_year: 2026 } });
      }
      if (url === '/companies') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/opening-balances') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('keeps opening balance checks stable across provider rerenders', async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/opening-balances', { params: { company_id: 1, year: 2026 } }));

    expect(api.get).toHaveBeenCalledWith('/opening-balances', { params: { company_id: 1, year: 2026 } });
  });
});
