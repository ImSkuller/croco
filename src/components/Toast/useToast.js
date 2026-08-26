// Split out of ToastProvider.jsx: a file that default-exports a component
// must not also export a hook/context, or Vite Fast Refresh can't preserve
// that component's state across edits (react-refresh/only-export-components).
import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}
