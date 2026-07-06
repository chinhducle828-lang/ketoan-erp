import { useEffect } from 'react';

/**
 * Keyboard shortcuts hook for ERP Sovereign Mode
 * Provides zero-mouse navigation for power users
 */
export function useKeyboardShortcuts({
  onSearch = null,
  onCreate = null,
  onPost = null,
  onCancel = null,
  enabled = true
} = {}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input fields
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
      
      // F2: Focus search input
      if (e.key === 'F2' && onSearch) {
        e.preventDefault();
        onSearch();
        return;
      }

      // Alt+N: Create new voucher
      if (e.altKey && e.key === 'n' && onCreate) {
        e.preventDefault();
        onCreate();
        return;
      }

      // Ctrl+S: Post/Save document
      if (e.ctrlKey && e.key === 's' && onPost) {
        e.preventDefault();
        onPost();
        return;
      }

      // Esc: Cancel/Close
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSearch, onCreate, onPost, onCancel]);
}

export default useKeyboardShortcuts;