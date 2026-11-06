import { DeleteOutlined } from '@ant-design/icons';
import type { SettingItemDto } from '@base/shared';
import { getErrorMessage, useApi, useAuth } from '@base/ui';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Form, Input, InputNumber, Select, Switch, Tag, Typography } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type FormValue = string | number | boolean | null | undefined;

/** Giá trị từ server (chuỗi) → giá trị cho ô nhập */
function toFormValue(item: SettingItemDto): FormValue {
  if (item.isSecret) return '';
  const value = item.value ?? '';
  if (item.type === 'boolean') return value === 'true';
  if (item.type === 'number') return value === '' ? null : Number(value);
  return value;
}

/** Giá trị ô nhập → chuỗi lưu DB */
function toSettingValue(item: SettingItemDto, value: FormValue): string {
  if (item.type === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Form 1 nhóm cài đặt; chỉ gửi lên các key có thay đổi */
export function SettingsGroupForm({
  items,
  readOnly,
  hint,
  onSaved,
}: {
  items: SettingItemDto[];
  readOnly: boolean;
  hint?: ReactNode;
  onSaved: (items: SettingItemDto[]) => void;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const api = useApi();
  const { can } = useAuth();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<Record<string, FormValue>>();
  const [saving, setSaving] = useState(false);
  const needsRoles = items.some((i) => i.name === 'default_role');
  const roles = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () => api.roles.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: needsRoles && (can('roles.list') || can('users.list')),
  });

  useEffect(() => {
    form.setFieldsValue(Object.fromEntries(items.map((i) => [i.name, toFormValue(i)])));
  }, [items, form]);

  async function save(values: Record<string, FormValue>) {
    const changed: Record<string, string | null> = {};
    for (const item of items) {
      if (item.isSecret) {
        // Key bí mật: để trống = giữ nguyên giá trị cũ
        const typed = String(values[item.name] ?? '');
        if (typed) changed[item.name] = typed;
      } else {
        const next = toSettingValue(item, values[item.name]);
        if (next !== (item.value ?? '')) changed[item.name] = next;
      }
    }
    if (!Object.keys(changed).length) {
      void message.info(t('saved'));
      return;
    }
    setSaving(true);
    try {
      onSaved(await api.settings.update(changed));
      void message.success(t('saved'));
    } catch (err) {
      void message.error(getErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  const clearSecret = (item: SettingItemDto) =>
    modal.confirm({
      title: t('common:confirm'),
      content: t('clearSecretConfirm', { name: t(`keys.${item.name}.label`) }),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          onSaved(await api.settings.update({ [item.name]: '' }));
          void message.success(t('saved'));
        } catch (err) {
          void message.error(getErrorMessage(err, t));
        }
      },
    });

  function renderInput(item: SettingItemDto) {
    if (item.type === 'boolean') return <Switch disabled={readOnly} />;
    if (item.type === 'number') return <InputNumber disabled={readOnly} style={{ width: '100%' }} />;
    if (item.isSecret) {
      return (
        <Input.Password
          disabled={readOnly}
          autoComplete="new-password"
          placeholder={item.configured ? t('secretPlaceholder') : t('secretEmptyPlaceholder')}
        />
      );
    }
    if (item.name === 'default_role' && roles.data) {
      return (
        <Select
          disabled={readOnly}
          showSearch={{ optionFilterProp: 'label' }}
          options={roles.data.items.map((r) => ({ value: r.name, label: r.name }))}
        />
      );
    }
    if (item.type === 'text') return <Input.TextArea rows={3} disabled={readOnly} />;
    return <Input disabled={readOnly} placeholder={item.example} />;
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={save} className="settings-form">
      {hint}
      {items.map((item) => (
        <Form.Item
          key={item.name}
          name={item.name}
          valuePropName={item.type === 'boolean' ? 'checked' : 'value'}
          label={
            <span className="settings-label">
              <span>{t(`keys.${item.name}.label`)}</span>
              <Typography.Text type="secondary" code className="settings-label__key">
                {item.name}
              </Typography.Text>
              {item.isSecret && <Tag color="purple">{t('secret')}</Tag>}
              {item.isSecret && item.configured && <Tag color="success">{t('configured')}</Tag>}
            </span>
          }
          extra={
            <span className="settings-extra">
              {t(`keys.${item.name}.description`)}
              {item.isSecret && item.configured && !readOnly && (
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => clearSecret(item)}
                  className="b-px-0"
                >
                  {t('clearSecret')}
                </Button>
              )}
            </span>
          }
        >
          {renderInput(item)}
        </Form.Item>
      ))}
      {!readOnly && (
        <div className="b-form-actions">
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('save')}
          </Button>
        </div>
      )}
    </Form>
  );
}
