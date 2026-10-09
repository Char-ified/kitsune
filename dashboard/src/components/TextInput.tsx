import { useId, type InputHTMLAttributes } from 'react';
import '../styles/TextInput.css';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const TextInput = ({ label, error, ...rest }: TextInputProps) => {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={error ? 'input input-error' : 'input'} {...rest} />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};
