import {
  CheckCircleOutlined,
  EditOutlined,
  GoogleOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ListUsersQuery, UserDto } from '@base/shared';
import {
  formatDateTime,
  getErrorMessage,
  PageHeader,
  useApi,
  useAuth,
  useDebouncedValue,
  UserCell,
} from '@base/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Dropdown,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type MenuProps,
  type TableProps,
} from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserFormDrawer } from './UserFormDrawer';
import { UserInfoModal } from './UserInfoModal';

export function UsersPage() {
  const { t } = useTranslation(['users', 'common']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { user: me, can } = useAuth();
  const { message, modal } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'locked' | undefined>();
  const [emailVerification, setEmailVerification] = useState<ListUsersQuery['emailVerification']>();
  const [roleId, setRoleId] = useState<string | undefined>();
  const [drawer, setDrawer] = useState<{ open: boolean; user?: UserDto }>({ open: false });
  const [viewing, setViewing] = useState<UserDto | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const query: ListUsersQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status,
    emailVerification,
    roleId,
  };
  const users = useQuery({
    queryKey: ['users', query],
    queryFn: () => api.users.list(query),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () => api.roles.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const onError = (err: unknown) => void message.error(getErrorMessage(err, t));

  const toggleActive = useMutation({
    mutationFn: (u: UserDto) => api.users.update(u.id, { isActive: !u.isActive }),
    onSuccess: (u) => {
      void message.success(t(u.isActive ? 'messages.unlocked' : 'messages.locked'));
      void invalidate();
    },
    onError,
  });
  const disable2fa = useMutation({
    mutationFn: (u: UserDto) => api.users.disableTwoFactor(u.id),
    onSuccess: () => {
      void message.success(t('messages.twoFactorDisabled'));
      void invalidate();
    },
    onError,
  });

  const confirm = (content: string, onOk: () => unknown, danger = false) =>
    modal.confirm({ title: t('common:confirm'), content, okButtonProps: { danger }, onOk });

  const filtersActive = [search, status, emailVerification, roleId].filter(Boolean).length;
  const canEditTarget = (u: UserDto) => !u.isSuperAdmin || Boolean(me?.isSuperAdmin);
  const viewingEditable = viewing ? canEditTarget(viewing) : false;

  // Đặt lại mật khẩu nằm trong modal thông tin người dùng; không cho xóa user ở giao diện
  const rowMenu = (u: UserDto): MenuProps => ({
    items: [
      can('users.disableTwoFactor') &&
        u.twoFactorEnabled && { key: '2fa', icon: <SafetyOutlined />, label: t('actions.disable2fa') },
    ].filter(Boolean) as MenuProps['items'],
    onClick: ({ key }) => {
      if (key === '2fa') confirm(t('confirm.disable2fa', { email: u.email }), () => disable2fa.mutateAsync(u), true);
    },
  });

  const columns: TableProps<UserDto>['columns'] = [
    {
      key: 'user',
      title: t('columns.user'),
      // Chấm trạng thái nằm cùng cột người dùng: xanh = hoạt động, đỏ = bị khoá
      render: (_, u) => {
        const label = u.isActive ? t('status.active') : t('status.locked');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Tooltip title={label}>
              <span
                role="img"
                aria-label={label}
                style={{
                  flex: 'none',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: u.isActive ? 'var(--ant-color-success)' : 'var(--ant-color-error)',
                }}
              />
            </Tooltip>
            <UserCell user={u} />
          </div>
        );
      },
      width: 300,
    },
    {
      key: 'role',
      title: t('columns.role'),
      render: (_, u) => (
        <Space size={4} wrap>
          {u.isSuperAdmin && <Tag color="volcano">{t('superAdmin')}</Tag>}
          {u.role ? <Tag color="geekblue">{u.role.name}</Tag> : !u.isSuperAdmin && (
            <Typography.Text type="secondary">{t('noRole')}</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      key: 'emailVerified',
      title: t('columns.emailVerified'),
      render: (_, u) => (
        <Space size={4} wrap>
          {u.emailVerified ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              {t('emailVerified')}
            </Tag>
          ) : (
            <Tag color="warning">{t('emailUnverified')}</Tag>
          )}
          {u.googleLinked && <Tag icon={<GoogleOutlined />}>{t('google')}</Tag>}
        </Space>
      ),
    },
    {
      key: 'lastLoginAt',
      title: t('columns.lastLogin'),
      render: (_, u) => formatDateTime(u.lastLoginAt),
    },
    {
      key: 'createdAt',
      title: t('columns.createdAt'),
      render: (_, u) => formatDateTime(u.createdAt),
    },
    {
      key: 'actions',
      title: t('common:actions'),
      fixed: 'right',
      align: 'right',
      width: 180,
      render: (_, u) => {
        const editable = canEditTarget(u);
        const menu = rowMenu(u);
        return (
          <Space size={4}>
            <Tooltip title={t('info.view')}>
              <Button type="text" icon={<EditOutlined />} onClick={() => setViewing(u)} />
            </Tooltip>
            {editable && can('users.update') && (
              <Tooltip title={t('actions.editAccess')}>
                <Button
                  type="text"
                  icon={<UserSwitchOutlined />}
                  onClick={() => setDrawer({ open: true, user: u })}
                />
              </Tooltip>
            )}
            {editable && can('users.update') && u.id !== me?.id && (
              <Tooltip title={u.isActive ? t('actions.lock') : t('actions.unlock')}>
                <Button
                  type="text"
                  danger={u.isActive}
                  icon={u.isActive ? <LockOutlined /> : <UnlockOutlined />}
                  onClick={() =>
                    confirm(
                      t(u.isActive ? 'confirm.lock' : 'confirm.unlock', { email: u.email }),
                      () => toggleActive.mutateAsync(u),
                      u.isActive,
                    )
                  }
                />
              </Tooltip>
            )}
            {editable && Boolean(menu.items?.length) && (
              <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
                <Button type="text" icon={<MoreOutlined />} aria-label={t('actions.more')} />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="b-page">
      <PageHeader
        icon={<TeamOutlined />}
        title={t('title')}
        subtitle={t('subtitle')}
        count={users.data?.meta.total}
        actions={
          can('users.create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ open: true })}>
              {t('add')}
            </Button>
          )
        }
      />
      <Card>
        <div className="b-toolbar">
          <Input.Search
            allowClear
            className="b-toolbar__search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder={t('statusAll')}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'active', label: t('status.active') },
              { value: 'locked', label: t('status.locked') },
            ]}
          />
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder={t('emailVerificationAll')}
            value={emailVerification}
            onChange={(v) => {
              setEmailVerification(v);
              setPage(1);
            }}
            options={[
              { value: 'verified', label: t('emailFilter.verified') },
              { value: 'unverified', label: t('emailFilter.unverified') },
            ]}
          />
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            style={{ width: 200 }}
            placeholder={t('roleAll')}
            value={roleId}
            loading={roles.isPending}
            onChange={(v) => {
              setRoleId(v);
              setPage(1);
            }}
            options={roles.data?.items.map((r) => ({ value: r.id, label: r.name }))}
          />
          {filtersActive > 0 && (
            <Button
              type="link"
              onClick={() => {
                setSearch('');
                setStatus(undefined);
                setEmailVerification(undefined);
                setRoleId(undefined);
                setPage(1);
              }}
            >
              {t('common:clearFilters', { count: filtersActive })}
            </Button>
          )}
        </div>
        <Table<UserDto>
          rowKey="id"
          columns={columns}
          dataSource={users.data?.items}
          loading={users.isFetching}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total: users.data?.meta.total,
            showSizeChanger: true,
            showTotal: (total) => t('common:total', { count: total }),
          }}
          onChange={(pagination) => {
            setPage(pagination.current ?? 1);
            setPageSize(pagination.pageSize ?? 20);
          }}
        />
      </Card>
      <UserFormDrawer
        open={drawer.open}
        user={drawer.user}
        roles={roles.data?.items ?? []}
        // Giữ lại user khi đóng: drawer còn chạy hiệu ứng đóng, xoá user sẽ làm form nháy sang chế độ tạo mới
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSaved={() => void invalidate()}
      />
      <UserInfoModal
        open={Boolean(viewing)}
        user={viewing}
        canEdit={viewingEditable && can('users.update')}
        canResetPassword={viewingEditable && can('users.resetPassword')}
        canViewLoginHistory={can('users.loginHistory')}
        onClose={() => setViewing(null)}
        onUpdated={() => void invalidate()}
      />
    </div>
  );
}
