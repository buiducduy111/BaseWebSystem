import { HomeOutlined, UserOutlined } from '@ant-design/icons';
import { AppShell, type NavGroup } from '@base/ui';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { usePublicSettings } from '@/lib/usePublicSettings';

export function UserLayout() {
  const { t } = useTranslation('menu');
  const settings = usePublicSettings();
  const siteName = settings.data?.site_name || t('common:appName');

  const nav: NavGroup[] = [
    {
      key: 'main',
      items: [
        { key: '/', icon: <HomeOutlined />, label: t('home') },
        { key: '/profile', icon: <UserOutlined />, label: t('profile') },
      ],
    },
  ];

  return (
    <AppShell
      brand={siteName}
      brandCollapsed={siteName.charAt(0)}
      nav={nav}
      variant="user"
      headerExtra={<NotificationBell />}
    />
  );
}
