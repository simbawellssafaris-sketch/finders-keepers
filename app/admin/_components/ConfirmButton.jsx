'use client';

// A submit button that asks "are you sure?" first (used for permanent deletes).
export default function ConfirmButton({ children, message, className }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
