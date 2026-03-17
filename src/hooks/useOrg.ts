import { useContext } from 'react';
import { OrgContext, type OrgContextValue } from '../contexts/OrgContext.tsx';

/**
 * Hook to access organization state and actions.
 * Must be used within an OrgProvider.
 */
export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
