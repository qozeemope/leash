import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

export type ButtonVariant = "default" | "primary" | "quiet" | "approve" | "danger" | "play";
export type ButtonSize = "normal" | "small";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "btn",
  primary: "btn btn-primary",
  quiet: "btn btn-quiet",
  approve: "btn btn-approve",
  danger: "btn btn-danger",
  play: "btn btn-play",
};

function classFor(variant: ButtonVariant, size: ButtonSize): string {
  return size === "small" ? `${VARIANT_CLASS[variant]} btn-small` : VARIANT_CLASS[variant];
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({ variant = "default", size = "normal", type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={classFor(variant, size)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({ variant = "default", size = "normal", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classFor(variant, size)} {...rest}>
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
