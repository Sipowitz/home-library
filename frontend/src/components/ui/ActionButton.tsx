import { forwardRef, type ButtonHTMLAttributes } from "react";
import {
  actionButtonClasses,
  type ActionButtonSize,
  type ActionButtonVariant,
} from "./actionButtonStyles";

export type { ActionButtonSize, ActionButtonVariant } from "./actionButtonStyles";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
};

export const ActionButton = forwardRef<HTMLButtonElement, Props>(
  function ActionButton(
    { variant = "tertiary", size = "md", className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={actionButtonClasses({ variant, size, className })}
        {...props}
      />
    );
  },
);
