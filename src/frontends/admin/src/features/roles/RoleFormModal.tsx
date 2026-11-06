import type { CreateRoleInput, RoleDto } from '@base/shared';
import { getErrorMessage, useApi } from '@base/ui';
import { App, Form, Input, Modal, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Values {
  name: string;
  description?: string;
  isActive: boolean;
}

export function RoleFormModal({
  open,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  role?: RoleDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(['roles', 'common']);
  const api = useApi();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      role
        ? { name: role.name, description: role.description ?? '', isActive: role.isActive }
        : { isActive: true },
    );
  }, [open, role, form]);

  async function submit(values: Values) {
    setSaving(true);
    const input: CreateRoleInput = {
      name: values.name,
      description: values.description?.trim() || null,
      isActive: values.isActive,
    };
    try {
      if (role) await api.roles.update(role.id, input);
      else await api.roles.create(input);
      void message.success(t(role ? 'messages.updated' : 'messages.created'));
      onSaved();
      onClose();
    } catch (err) {
      void message.error(getErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={role ? t('edit') : t('add')}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t('common:save')}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item
          name="name"
          label={t('fields.name')}
          rules={[{ required: true, whitespace: true, max: 100 }]}
        >
          <Input disabled={role?.isSystem} autoFocus />
        </Form.Item>
        <Form.Item name="description" label={t('fields.description')} rules={[{ max: 1000 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="isActive"
          label={t('fields.isActive')}
          valuePropName="checked"
          extra={t('inactiveHint')}
        >
          <Switch disabled={role?.isSystem} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
