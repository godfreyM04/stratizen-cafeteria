import { createContext, useContext, useState, useCallback, useMemo } from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);

    // Auto-dismiss after 2.5 seconds (within 2-3 seconds requirement)
    setTimeout(() => {
      removeToast(id);
    }, 2500);
  }, [removeToast]);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" id="toast-root">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type || "success"}`}>
            <span className="material-symbols-outlined toast-icon">
              {toast.type === "error" ? "error" : "check_circle"}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
