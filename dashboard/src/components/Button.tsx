import type { ButtonHTMLAttributes } from 'react';
import '../styles/Button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export const Button = ({ variant = 'primary', ...rest }: ButtonProps) => {
  return <button className={`btn btn-${variant}`} {...rest} />;
};
