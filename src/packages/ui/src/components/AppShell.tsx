import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Tooltip, Typography, type MenuProps } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { useIsMobile } from '../hooks';
import { cx, displayName } from '../utils';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserAvatar } from './UserAvatar';

export type NavItem = {
  /** Đường dẫn, cũng là key của menu */
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  hidden?: boolean;
};

export type NavGroup = { key: string; label?: ReactNode; items: NavItem[] };

export interface AppShellProps {
  brand: ReactNode;
  brandCollapsed?: ReactNode;
  nav: NavGroup[];
  /**
   * Kiểu sidebar theo hệ thống gốc:
   * - admin: tiêu đề nhóm in hoa, mục đang chọn màu primary
   * - user: nhãn nhóm nhỏ, mục đang chọn nền xám đậm chữ
   */
  variant?: 'admin' | 'user';
  /** Nút bổ sung trên header (ví dụ chuông thông báo) */
  headerExtra?: ReactNode;
  profilePath?: string;
}

const COLLAPSED_KEY = 'base.sidebar.collapsed';

function isActive(pathname: string, key: string) {
  return key === '/' ? pathname === '/' : pathname === key || pathname.startsWith(`${key}/`);
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function Sidebar({
  brand,
  brandCollapsed,
  groups,
  variant,
  collapsed,
  showBrand,
  onNavigate,
}: {
  brand: ReactNode;
  brandCollapsed?: ReactNode;
  groups: NavGroup[];
  variant: 'admin' | 'user';
  collapsed: boolean;
  showBrand: boolean;
  onNavigate: (path: string) => void;
}) {
  const { pathname } = useLocation();
  // Mục khớp dài nhất được coi là đang chọn (tránh '/' khớp mọi trang)
  const activeKey = groups
    .flatMap((g) => g.items.map((i) => i.key))
    .filter((k) => isActive(pathname, k))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className={cx('b-sider', `b-sider--${variant}`, collapsed && 'b-sider--collapsed')}>
      {showBrand && (
        <div className="b-sider__brand">{collapsed ? (brandCollapsed ?? brand) : brand}</div>
      )}
      <nav className="b-sider__nav">
        {groups.map((group, index) => (
          <div key={group.key} className={cx('b-nav-group', index > 0 && 'b-nav-group--next')}>
            {group.label && !collapsed && <div className="b-nav-group__title">{group.label}</div>}
            <div className="b-nav-group__items">
              {group.items.map((item) => {
                const button = (
                  <button
                    key={item.key}
                    type="button"
                    className={cx('b-nav-item', item.key === activeKey && 'b-nav-item--active')}
                    onClick={() => onNavigate(item.key)}
                    aria-current={item.key === activeKey ? 'page' : undefined}
                  >
                    {item.icon && <span className="b-nav-item__icon">{item.icon}</span>}
                    {!collapsed && <span className="b-nav-item__label">{item.label}</span>}
                  </button>
                );
                return collapsed ? (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AppShell({
  brand,
  brandCollapsed,
  nav,
  variant = 'admin',
  headerExtra,
  profilePath = '/profile',
}: AppShellProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1');
      } catch {
        // Bỏ qua: chỉ là ghi nhớ giao diện
      }
      return !value;
    });

  const groups = nav
    .map((group) => ({ ...group, items: group.items.filter((i) => !i.hidden) }))
    .filter((group) => group.items.length);

  const userMenu: MenuProps = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: t('common:profile') },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: t('common:logout'), danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'profile') navigate(profilePath);
      if (key === 'logout') void logout().then(() => navigate('/login'));
    },
  };

  const sidebarProps = {
    brand,
    brandCollapsed,
    groups,
    variant,
    onNavigate: (path: string) => {
      navigate(path);
      // Trên mobile: chọn mục menu thì đóng drawer
      setMobileOpen(false);
    },
  };

  return (
    <div className="b-shell">
      {isMobile ? (
        <>
          <div
            className={cx('b-shell__overlay', mobileOpen && 'b-shell__overlay--open')}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className={cx('b-shell__drawer', mobileOpen && 'b-shell__drawer--open')}>
            <Sidebar {...sidebarProps} collapsed={false} showBrand />
          </div>
        </>
      ) : (
        <div className={cx('b-shell__sider-wrap', collapsed && 'b-shell__sider-wrap--collapsed')}>
          <Sidebar {...sidebarProps} collapsed={collapsed} showBrand />
        </div>
      )}

      <div className="b-shell__body">
        <header className="b-shell__header">
          <Button
            type="text"
            aria-label="menu"
            icon={
              isMobile ? <MenuOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
            }
            onClick={() => (isMobile ? setMobileOpen(true) : toggleCollapsed())}
          />
          <div className="b-shell__header-right">
            {headerExtra}
            <LanguageSwitcher />
            {user && (
              <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
                <button type="button" className="b-shell__user">
                  <UserAvatar user={user} size={30} />
                  {!isMobile && (
                    <Typography.Text strong ellipsis className="b-shell__user-name">
                      {displayName(user)}
                    </Typography.Text>
                  )}
                </button>
              </Dropdown>
            )}
          </div>
        </header>
        <main className="b-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
