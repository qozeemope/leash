import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

export type ButtonVariant = "default" | "primary" | "gold" | "approve" | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "btn",
  primary: "btn btn-primary",
  gold: "btn btn-gold",
  approve: "btn btn-approve",
  danger: "btn btn-danger",
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: "normal" | "small";
  children: ReactNode;
}

export function Button({ variant = "default", size = "normal", type = "button", children, ...rest }: ButtonProps) {
  const className = size === "small" ? `${VARIANT_CLASS[variant]} btn-small` : VARIANT_CLASS[variant];
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function ButtonLink({ variant = "default", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={VARIANT_CLASS[variant]} {...rest}>
      {children}
    </Link>
  );
}

interface ButtonAnchorProps {
  href: string;
  variant?: ButtonVariant;
  onClick?: () => void;
  children: ReactNode;
}

export function ButtonAnchor({ href, variant = "default", onClick, children }: ButtonAnchorProps) {
  return (
    <a className={VARIANT_CLASS[variant]} href={href} rel="noopener noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}
