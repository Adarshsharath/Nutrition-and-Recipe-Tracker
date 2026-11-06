'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType }

const ToastCtx = createContext<{ toast: (msg: string, type?: ToastType) => void }>({
  toast: () => {},
});

export function useToast() { return useContext(ToastCtx); }

let _toast: (msg: string, type?: ToastType) => void = () => {};
export const toast = (msg: string, type: ToastType = 'info') => _toast(msg, type);

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => { _toast = addToast; }, [addToast]);

  const colors: Record<ToastType, string> = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-blue-600',
  };

  return (
    <ToastCtx.Provider value={{ toast: addToast }}>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[9999]">
        {toasts.map((t) => (
          <div key={t.id}
            className={`${colors[t.type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm max-w-xs animate-fade-in`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
