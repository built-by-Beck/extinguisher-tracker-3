import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface AiAssistantContextValue {
  open: boolean;
  draftMessage: string;
  openAssistant: (draftMessage?: string) => void;
  closeAssistant: () => void;
  setDraftMessage: (message: string) => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function AiAssistantProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');

  const openAssistant = useCallback((message = '') => {
    setDraftMessage(message);
    setOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      open,
      draftMessage,
      openAssistant,
      closeAssistant,
      setDraftMessage,
    }),
    [open, draftMessage, openAssistant, closeAssistant],
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  const context = useContext(AiAssistantContext);
  if (!context) {
    throw new Error('useAiAssistant must be used within AiAssistantProvider');
  }
  return context;
}
