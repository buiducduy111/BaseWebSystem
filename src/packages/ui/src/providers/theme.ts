import type { ThemeConfig } from 'antd';

/** Theme antd dùng chung (màu primary theo hệ thống gốc) */
export const baseTheme: ThemeConfig = {
  token: {
    colorPrimary: '#4459C1',
    colorInfo: '#4459C1',
    colorLink: '#4459C1',
    borderRadius: 8,
    fontFamily:
      "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Button: { fontWeight: 500 },
    Card: { borderRadiusLG: 12 },
    Modal: { borderRadiusLG: 12 },
  },
};
