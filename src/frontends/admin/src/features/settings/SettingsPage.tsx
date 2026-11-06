import { DownloadOutlined, DownOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons';
import { SETTING_GROUPS, type SettingGroup, type SettingItemDto } from '@base/shared';
import { downloadFile, getErrorMessage, PageHeader, SettingsSection, useApi, useAuth } from '@base/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Dropdown, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportSettingsModal } from './ImportSettingsModal';
import { SettingsGroupForm } from './SettingsGroupForm';

const SETTINGS_QUERY_KEY = ['settings', 'items'] as const;

/** Cấu hình hệ thống: chỉ hiển thị các key hệ thống, chia theo nhóm, mỗi nhóm lưu riêng */
export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { message } = App.useApp();
  const [importOpen, setImportOpen] = useState(false);
  const canEdit = can('settings.update');

  const settings = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: () => api.settings.list() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['settings'] });

  async function exportJson(includeSecrets: boolean) {
    try {
      const file = await api.settings.export(includeSecrets);
      downloadFile(
        JSON.stringify(file, null, 2),
        `settings-${dayjs().format('YYYYMMDD-HHmmss')}.json`,
        'application/json',
      );
      void message.success(t('exported', { count: file.settings.length }));
    } catch (err) {
      void message.error(getErrorMessage(err, t));
    }
  }

  const byGroup = (group: SettingGroup): SettingItemDto[] =>
    settings.data?.filter((s) => s.group === group) ?? [];

  return (
    <div className="b-page">
      <PageHeader
        icon={<SettingOutlined />}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {can('settings.export') && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'public', label: t('exportPublic') },
                    ...(canEdit ? [{ key: 'secrets', label: t('exportWithSecrets') }] : []),
                  ],
                  onClick: ({ key }) => void exportJson(key === 'secrets'),
                }}
              >
                <Button icon={<DownloadOutlined />}>
                  {t('export')} <DownOutlined />
                </Button>
              </Dropdown>
            )}
            {can('settings.import') && (
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                {t('import')}
              </Button>
            )}
          </>
        }
      />

      <Card>
        {settings.isPending ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          SETTING_GROUPS.map((group) => (
            <SettingsSection
              key={group}
              title={t(`groups.${group}.title`)}
              description={t(`groups.${group}.description`)}
            >
              <SettingsGroupForm
                items={byGroup(group)}
                readOnly={!canEdit}
                hint={group === 'google' ? <GoogleRedirectHint /> : undefined}
                onSaved={(items) => queryClient.setQueryData(SETTINGS_QUERY_KEY, items)}
              />
            </SettingsSection>
          ))
        )}
      </Card>

      <ImportSettingsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void refresh()} />
    </div>
  );
}

/** Redirect URI cần khai báo trên Google Cloud Console (callback đi qua domain của từng app) */
function GoogleRedirectHint() {
  const { t } = useTranslation('settings');
  return (
    <div className="settings-hint">
      <div>{t('googleRedirectHint')}</div>
      <code>https://&lt;domain-trang-user&gt;/api/v1/auth/google/callback</code>
      <code>{window.location.origin}/api/v1/auth/google/callback</code>
    </div>
  );
}
