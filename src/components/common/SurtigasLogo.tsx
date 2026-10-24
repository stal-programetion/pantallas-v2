import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** 'full' = llama + "Surtigas" + "Una empresa Promigas"; 'icon' = solo la llama */
  variant?: 'full' | 'icon';
  /** Se mantiene por compatibilidad: el logo oficial es a todo color y se muestra sobre fondo claro. */
  whiteText?: boolean;
}

const HEIGHTS = {
  full: { sm: 'h-10', md: 'h-14', lg: 'h-20' },
  icon: { sm: 'h-7', md: 'h-10', lg: 'h-14' },
} as const;

/** Logo oficial de Surtigas (archivos en /public). */
export const SurtigasLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'icon',
}) => (
  <img
    src={variant === 'full' ? '/logo-surtigas.png' : '/logo-icono.png'}
    alt="Surtigas, una empresa Promigas"
    draggable={false}
    className={`${HEIGHTS[variant][size]} w-auto select-none ${className}`}
  />
);
