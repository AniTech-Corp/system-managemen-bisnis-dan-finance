'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ className, children, open, onOpenChange, defaultOpen, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen || false);
    const controlled = open !== undefined;
    const currentOpen = controlled ? open : isOpen;

    const handleOpenChange = (newOpen: boolean) => {
      if (!controlled) setIsOpen(newOpen);
      onOpenChange?.(newOpen);
    };

    if (!currentOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => handleOpenChange(false)} />
        <div
          ref={ref}
          className={cn(
            'relative z-50 w-full max-w-lg rounded-lg bg-background p-6 shadow-lg',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);
Dialog.displayName = 'Dialog';

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      return <React.Fragment>{children}</React.Fragment>;
    }
    return (
      <button ref={ref} className={cn('', className)} {...props}>
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('bg-background rounded-lg shadow-lg', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
        {children}
      </div>
    );
  }
);
DialogHeader.displayName = 'DialogHeader';

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props}>
        {children}
      </h2>
    );
  }
);
DialogTitle.displayName = 'DialogTitle';

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props}>
        {children}
      </p>
    );
  }
);
DialogDescription.displayName = 'DialogDescription';

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };