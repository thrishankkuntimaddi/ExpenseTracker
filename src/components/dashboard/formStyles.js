// ─── Desktop dashboard: shared form-input styling ───
export const inputStyle = {
  width: '100%', padding: '9px 12px 9px 34px',
  borderRadius: 9, fontSize: 13,
  border: '1.5px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

export const focusHandlers = (color) => ({
  onFocus: e => (e.target.style.borderColor = color),
  onBlur: e => (e.target.style.borderColor = 'var(--input-border)'),
});
