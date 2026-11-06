import { BellOutlined } from '@ant-design/icons';
import type { NotificationDto } from '@base/shared';
import { App, Badge, Button, Empty, Popover, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NotificationItem } from './NotificationItem';
import { useMarkNotifications, useNotificationList, useUnreadCount } from './useNotifications';

/** Chuông thông báo trên header: badge số chưa đọc + popover 10 thông báo mới nhất */
export function NotificationBell() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotificationList({ page: 1, pageSize: 10 }, open);
  const { markRead, markAllRead } = useMarkNotifications();
  const count = unread.data ?? 0;

  // Có thông báo mới trong lúc đang dùng app → hiện toast
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (unread.data === undefined) return;
    if (previous.current !== null && unread.data > previous.current) {
      notification.info({
        key: 'new-notifications',
        title: t('newTitle'),
        description: t('newDescription', { count: unread.data }),
        icon: <BellOutlined />,
        placement: 'bottomRight',
        onClick: () => navigate('/notifications'),
      });
    }
    previous.current = unread.data;
  }, [unread.data, notification, navigate, t]);

  const handleClick = (n: NotificationDto) => {
    if (!n.read) markRead.mutate([n.id]);
    if (n.link) {
      setOpen(false);
      if (/^https?:\/\//.test(n.link)) window.open(n.link, '_blank', 'noopener');
      else navigate(n.link);
    }
  };

  const content = (
    <div className="noti-panel">
      <div className="noti-panel__header">
        <Typography.Text strong>{t('title')}</Typography.Text>
        {count > 0 && (
          <Button type="link" size="small" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            {t('markAllRead')}
          </Button>
        )}
      </div>
      <div className="noti-panel__list">
        {list.isPending ? (
          <div className="noti-panel__state">
            <Spin />
          </div>
        ) : list.data?.items.length ? (
          list.data.items.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} compact />
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="noti-panel__state" />
        )}
      </div>
      <div className="noti-panel__footer">
        <Typography.Text type="secondary">
          {count > 0 ? t('unreadCount', { count }) : t('allRead')}
        </Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={() => {
            setOpen(false);
            navigate('/notifications');
          }}
        >
          {t('viewAll')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      arrow={false}
      classNames={{ root: 'noti-popover' }}
    >
      <Button type="text" aria-label={t('title')}>
        <Badge count={count} size="small" overflowCount={99}>
          <BellOutlined className="noti-bell-icon" />
        </Badge>
      </Button>
    </Popover>
  );
}
