import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import type { NotificationDto } from '@base/shared';
import { PageHeader } from '@base/ui';
import { Button, Card, Empty, Pagination, Segmented, Spin } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NotificationItem } from './NotificationItem';
import { useMarkNotifications, useNotificationList, useUnreadCount } from './useNotifications';

export function NotificationsPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useNotificationList({ page, pageSize, unreadOnly });
  const unread = useUnreadCount();
  const { markRead, markAllRead } = useMarkNotifications();

  const handleClick = (n: NotificationDto) => {
    if (!n.read) markRead.mutate([n.id]);
    if (n.link) {
      if (/^https?:\/\//.test(n.link)) window.open(n.link, '_blank', 'noopener');
      else navigate(n.link);
    }
  };

  return (
    <div className="b-page">
      <PageHeader
        icon={<BellOutlined />}
        title={t('title')}
        subtitle={t('subtitle')}
        count={unread.data || undefined}
        actions={
          <Button
            icon={<CheckOutlined />}
            disabled={!unread.data}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {t('markAllRead')}
          </Button>
        }
      />
      <Card>
        <Segmented
          className="b-mb-16"
          value={unreadOnly ? 'unread' : 'all'}
          onChange={(v) => {
            setUnreadOnly(v === 'unread');
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('common:all') },
            { value: 'unread', label: t('unreadOnly') },
          ]}
        />
        <Spin spinning={list.isFetching}>
          {list.data?.items.length ? (
            <div className="noti-page-list">
              {list.data.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={handleClick} />
              ))}
            </div>
          ) : (
            !list.isPending && <Empty description={t('empty')} />
          )}
        </Spin>
        {(list.data?.meta.total ?? 0) > pageSize && (
          <Pagination
            className="b-mt-16"
            align="end"
            current={page}
            pageSize={pageSize}
            total={list.data?.meta.total}
            showSizeChanger
            onChange={(p, size) => {
              setPage(p);
              setPageSize(size);
            }}
          />
        )}
      </Card>
    </div>
  );
}
