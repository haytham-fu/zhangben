import type { ReactNode, SVGProps } from 'react';
import type { PaymentMethod } from '../types';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, className = '', ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`cute-icon ${className}`.trim()}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Soft blob background for nav / empty icons */
export function IconHome({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#BFDBFE" />
      <path
        d="M12 24.5L24 14l12 10.5V36a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V24.5z"
        fill="#3B82F6"
      />
      <rect x="20" y="28" width="8" height="10" rx="1.5" fill="#DBEAFE" />
      <circle cx="18" cy="20" r="1.6" fill="#93C5FD" />
      <circle cx="30" cy="20" r="1.6" fill="#93C5FD" />
    </Svg>
  );
}

export function IconCalendar({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#C7D2FE" />
      <rect x="12" y="14" width="24" height="22" rx="4" fill="#6366F1" />
      <rect x="12" y="14" width="24" height="7" rx="4" fill="#818CF8" />
      <rect x="16" y="11" width="3.5" height="6" rx="1.5" fill="#A5B4FC" />
      <rect x="28.5" y="11" width="3.5" height="6" rx="1.5" fill="#A5B4FC" />
      <circle cx="18" cy="27" r="2" fill="#EEF2FF" />
      <circle cx="24" cy="27" r="2" fill="#EEF2FF" />
      <circle cx="30" cy="27" r="2" fill="#FBBF24" />
      <circle cx="18" cy="33" r="2" fill="#EEF2FF" />
      <circle cx="24" cy="33" r="2" fill="#34D399" />
    </Svg>
  );
}

export function IconAdd({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#93C5FD" />
      <circle cx="24" cy="24" r="14" fill="#3B82F6" />
      <rect x="21" y="14" width="6" height="20" rx="3" fill="#EFF6FF" />
      <rect x="14" y="21" width="20" height="6" rx="3" fill="#EFF6FF" />
      <circle cx="33" cy="15" r="3" fill="#FBBF24" />
    </Svg>
  );
}

export function IconList({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#A5F3FC" />
      <rect x="13" y="12" width="22" height="26" rx="4" fill="#06B6D4" />
      <rect x="17" y="18" width="14" height="2.5" rx="1.25" fill="#ECFEFF" />
      <rect x="17" y="24" width="11" height="2.5" rx="1.25" fill="#CFFAFE" />
      <rect x="17" y="30" width="13" height="2.5" rx="1.25" fill="#ECFEFF" />
      <circle cx="34" cy="34" r="5" fill="#FBBF24" />
      <path d="M34 31.5v5M31.5 34h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSettings({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#E9D5FF" />
      <circle cx="24" cy="24" r="9" fill="#A855F7" />
      <circle cx="24" cy="24" r="4" fill="#F3E8FF" />
      <g fill="#C084FC">
        <rect x="22" y="8" width="4" height="6" rx="2" />
        <rect x="22" y="34" width="4" height="6" rx="2" />
        <rect x="8" y="22" width="6" height="4" rx="2" />
        <rect x="34" y="22" width="6" height="4" rx="2" />
      </g>
    </Svg>
  );
}

export function IconEmptyLedger({ size = 56 }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="24" cy="40" rx="14" ry="3" fill="#BFDBFE" opacity="0.7" />
      <rect x="11" y="10" width="26" height="28" rx="5" fill="#60A5FA" />
      <rect x="15" y="16" width="18" height="3" rx="1.5" fill="#DBEAFE" />
      <rect x="15" y="22" width="14" height="3" rx="1.5" fill="#BFDBFE" />
      <rect x="15" y="28" width="16" height="3" rx="1.5" fill="#DBEAFE" />
      <circle cx="34" cy="12" r="7" fill="#FBBF24" />
      <path
        d="M34 9v6M31 12h6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="34" r="2.2" fill="#93C5FD" />
      <circle cx="32" cy="34" r="2.2" fill="#93C5FD" />
    </Svg>
  );
}

export function IconEmptySpend({ size = 56 }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="24" cy="40" rx="12" ry="2.5" fill="#BBF7D0" opacity="0.8" />
      <circle cx="24" cy="22" r="14" fill="#34D399" />
      <path
        d="M24 14c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"
        fill="#ECFDF5"
      />
      <circle cx="19" cy="20" r="1.5" fill="#065F46" />
      <circle cx="29" cy="20" r="1.5" fill="#065F46" />
      <path d="M20 26c1.5 2 6.5 2 8 0" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconEmptyDay({ size = 56 }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="24" cy="40" rx="13" ry="2.5" fill="#C7D2FE" opacity="0.75" />
      <rect x="12" y="12" width="24" height="24" rx="5" fill="#818CF8" />
      <rect x="12" y="12" width="24" height="7" rx="5" fill="#A5B4FC" />
      <circle cx="24" cy="28" r="5" fill="#EEF2FF" />
      <path d="M24 25.5v5M21.5 28h5" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="36" cy="14" r="4" fill="#FBBF24" />
    </Svg>
  );
}


export function IconWallet({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#FBCFE8" />
      <rect x="11" y="16" width="26" height="18" rx="5" fill="#EC4899" />
      <rect x="11" y="16" width="26" height="7" rx="5" fill="#F472B6" />
      <circle cx="31" cy="28" r="3.5" fill="#FDE68A" />
      <path d="M14 22h8" stroke="#FCE7F3" strokeWidth="2" strokeLinecap="round" />
      <circle cx="36" cy="14" r="4" fill="#60A5FA" />
    </Svg>
  );
}

export function IconEmptyWallet({ size = 56 }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="24" cy="40" rx="13" ry="2.5" fill="#FBCFE8" opacity="0.75" />
      <rect x="10" y="14" width="28" height="20" rx="5" fill="#F472B6" />
      <rect x="10" y="14" width="28" height="8" rx="5" fill="#EC4899" />
      <circle cx="32" cy="28" r="4" fill="#FDE68A" />
      <circle cx="36" cy="12" r="5" fill="#93C5FD" />
      <path d="M36 9.5v5M33.5 12h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconEdit({ size = 22 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="24" cy="24" r="20" fill="#BFDBFE" />
      <path
        d="M28.5 12.5l7 7-14 14H14.5v-7l14-14z"
        fill="#3B82F6"
      />
      <path d="M26 15l7 7" stroke="#DBEAFE" strokeWidth="2" strokeLinecap="round" />
      <rect x="14" y="34" width="12" height="3" rx="1.5" fill="#93C5FD" />
    </Svg>
  );
}

const PAY_COLORS: Record<Exclude<PaymentMethod, 'none'>, { bg: string; fg: string }> = {
  octopus: { bg: '#DBEAFE', fg: '#2563EB' },
  wechat: { bg: '#DCFCE7', fg: '#16A34A' },
  alipay: { bg: '#DBEAFE', fg: '#1677FF' },
  bank: { bg: '#E0E7FF', fg: '#4F46E5' },
  credit: { bg: '#FEF3C7', fg: '#D97706' },
  other: { bg: '#F1F5F9', fg: '#64748B' },
};

export function IconPayment({ method, size = 18 }: { method: PaymentMethod; size?: number }) {
  if (method === 'none') return null;
  const c = PAY_COLORS[method];
  return (
    <Svg size={size} className="pay-cute-icon">
      <circle cx="24" cy="24" r="20" fill={c.bg} />
      {method === 'octopus' && (
        <>
          <rect x="12" y="16" width="24" height="16" rx="4" fill={c.fg} />
          <circle cx="24" cy="24" r="4" fill="#FBBF24" />
        </>
      )}
      {method === 'wechat' && (
        <>
          <ellipse cx="20" cy="22" rx="9" ry="7" fill={c.fg} />
          <ellipse cx="29" cy="26" rx="8" ry="6" fill="#22C55E" />
          <circle cx="17" cy="21" r="1.4" fill="#fff" />
          <circle cx="23" cy="21" r="1.4" fill="#fff" />
          <circle cx="27" cy="25" r="1.2" fill="#fff" />
          <circle cx="32" cy="25" r="1.2" fill="#fff" />
        </>
      )}
      {method === 'alipay' && (
        <>
          <rect x="13" y="14" width="22" height="20" rx="5" fill={c.fg} />
          <path d="M18 28c4-8 12-10 14-10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 22h16" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {method === 'bank' && (
        <>
          <path d="M24 12l12 8H12l12-8z" fill={c.fg} />
          <rect x="14" y="20" width="4" height="10" rx="1" fill="#818CF8" />
          <rect x="22" y="20" width="4" height="10" rx="1" fill="#818CF8" />
          <rect x="30" y="20" width="4" height="10" rx="1" fill="#818CF8" />
          <rect x="12" y="31" width="24" height="3" rx="1.5" fill={c.fg} />
        </>
      )}
      {method === 'credit' && (
        <>
          <rect x="10" y="15" width="28" height="18" rx="4" fill={c.fg} />
          <rect x="10" y="20" width="28" height="5" fill="#92400E" opacity="0.35" />
          <rect x="14" y="28" width="10" height="2.5" rx="1" fill="#FEF3C7" />
          <circle cx="32" cy="29" r="2.2" fill="#FBBF24" />
        </>
      )}
      {method === 'other' && (
        <>
          <circle cx="24" cy="24" r="10" fill={c.fg} />
          <circle cx="18" cy="24" r="2" fill="#fff" />
          <circle cx="24" cy="24" r="2" fill="#fff" />
          <circle cx="30" cy="24" r="2" fill="#fff" />
        </>
      )}
    </Svg>
  );
}

export type NavIconId = 'home' | 'calendar' | 'add' | 'wallets' | 'list' | 'settings';

export function NavCuteIcon({ id, size = 26 }: { id: NavIconId; size?: number }) {
  switch (id) {
    case 'home':
      return <IconHome size={size} />;
    case 'calendar':
      return <IconCalendar size={size} />;
    case 'add':
      return <IconAdd size={size} />;
    case 'wallets':
      return <IconWallet size={size} />;
    case 'list':
      return <IconList size={size} />;
    case 'settings':
      return <IconSettings size={size} />;
  }
}
