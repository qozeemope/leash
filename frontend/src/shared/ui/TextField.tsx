import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
}

type InputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & { multiline?: false };
type AreaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> & { multiline: true };

export function TextField(props: InputProps | AreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const { label, hint, error } = props;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    className: "field-input",
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div className={error ? "field field-invalid" : "field"}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {props.multiline ? (
        <textarea
          {...common}
          {...omit(props)}
        />
      ) : (
        <input
          {...common}
          {...omit(props)}
        />
      )}
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function omit<T extends BaseProps & { multiline?: boolean }>(props: T) {
  const { label: _label, hint: _hint, error: _error, multiline: _multiline, ...rest } = props;
  void _label;
  void _hint;
  void _error;
  void _multiline;
  return rest;
}
