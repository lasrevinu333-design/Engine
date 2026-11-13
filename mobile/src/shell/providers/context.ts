import { createContext, useContext } from 'react';

export function createRequiredContext<T>(name: string) {
  const context = createContext<T | null>(null);
  const useRequired = (): T => {
    const value = useContext(context);
    if (value == null) throw new Error(`${name} must be used inside its provider.`);
    return value;
  };
  return [context, useRequired] as const;
}
