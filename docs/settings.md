# Cài đặt hệ thống (Settings)

Tài liệu này mô tả cách trang **Admin → Cài đặt** được thiết kế, dữ liệu đi từ đâu tới đâu, và các bước khi thêm một cài đặt mới.

Liên quan: [Phân quyền](permissions.md) · [Kiến trúc chung](architecture.md)

## 1. Nguyên tắc thiết kế

- **Khai báo trong code, giá trị trong DB.** Danh sách key, nhóm, kiểu, giá trị mặc định… nằm trong code; DB chỉ lưu cặp `name → value`.
- **Không có key tự do.** Trang admin chỉ hiển thị và chỉ cho lưu các key đã khai báo; API từ chối key lạ, import bỏ qua key lạ.
- **Giao diện sinh tự động** từ khai báo: thêm 1 dòng khai báo + bản dịch là có ô nhập đúng kiểu, đúng nhóm, không phải viết form mới.
- **Mỗi nhóm lưu riêng**, chỉ gửi các key có thay đổi.
- **Key bí mật không bao giờ quay về client.**

```
SETTING_DEFINITIONS (shared)          bảng settings (DB)
  name / group / type / default  ┐      name / value
  isSecret / isPublic / example  │        │
                                 ▼        ▼
                      SettingsService.list()  ── GET /settings ──►  SettingsPage
                      (ghép khai báo + giá trị,                     ├─ SettingsSection (mỗi nhóm)
                       ẩn giá trị bí mật)                           │   └─ SettingsGroupForm
                                                                    │       └─ ô nhập theo type
                      SettingsService.update() ◄── PUT /settings ── └─ chỉ gửi key thay đổi
                      (kiểm tra & chuẩn hoá theo type)
```

## 2. Khai báo

File: [`src/packages/shared/src/constants/settings.ts`](../src/packages/shared/src/constants/settings.ts)

```ts
export const SETTING_GROUPS = ['general', 'security', 'mail', 'sendify', 'google', 'captcha'] as const;

export const SETTING_DEFINITIONS = [
  { name: 'site_name', group: 'general', type: 'string', defaultValue: 'Base Web', isPublic: true },
  { name: 'smtp_port', group: 'mail', type: 'number', defaultValue: '587' },
  { name: 'smtp_password', group: 'mail', type: 'string', defaultValue: '', isSecret: true },
  // ...
] as const satisfies readonly SettingDefinition[];
```

| Trường | Ý nghĩa |
| ------ | ------- |
| `name` | Key, dạng `snake_case`. Sinh ra type `SettingName` → gọi `getString('sai_ten')` là TypeScript báo lỗi. |
| `group` | Nhóm hiển thị, phải thuộc `SETTING_GROUPS`. Thứ tự nhóm trên trang = thứ tự trong `SETTING_GROUPS`; thứ tự key trong nhóm = thứ tự khai báo. |
| `type` | `string` · `text` · `number` · `boolean` · `email` · `url` — quyết định ô nhập và cách kiểm tra (mục 4). |
| `defaultValue` | Luôn là **chuỗi** (`'true'`, `'587'`…). Dùng khi DB chưa có dòng cho key này. |
| `isSecret` | Không trả giá trị về client, không export trừ khi chọn "kèm bí mật". |
| `isPublic` | Được phép đưa vào `GET /settings/public` (không cần đăng nhập). Xem lưu ý ở mục 6. |
| `example` | Hiện làm placeholder của ô nhập. |

Bảng DB: `settings (id, name unique, value text, createdAt, updatedAt)` — [`src/packages/db/src/schema/settings.ts`](../src/packages/db/src/schema/settings.ts). Mọi giá trị lưu dạng chuỗi; giá trị rỗng `''` nghĩa là "chưa cấu hình".

## 3. Giao diện

Thư mục: [`src/frontends/admin/src/features/settings/`](../src/frontends/admin/src/features/settings/)

| File | Vai trò |
| ---- | ------- |
| `SettingsPage.tsx` | Gọi `GET /settings`, lặp qua `SETTING_GROUPS`, mỗi nhóm render 1 `SettingsSection` (tiêu đề + mô tả bên trái, form bên phải) chứa 1 `SettingsGroupForm`. Header có nút **Export JSON** và **Import JSON**. |
| `SettingsGroupForm.tsx` | Form của 1 nhóm: sinh ô nhập theo `type`, so sánh với giá trị cũ, chỉ gửi key thay đổi qua `PUT /settings`, rồi ghi kết quả trả về vào cache react-query. |
| `ImportSettingsModal.tsx` | Đọc file JSON, chuẩn hoá về mảng `[{ name, value }]`, hiển thị xem trước (gắn nhãn "Bỏ qua" cho key lạ), tuỳ chọn ghi đè. |

`SettingsSection` là component dùng chung trong `@base/ui` (`packages/ui/src/components/PageHeader.tsx`).

### 3.1 Ô nhập theo kiểu

| `type` / điều kiện | Ô nhập | Giá trị form ↔ chuỗi DB |
| ------------------ | ------ | ------------------------ |
| `boolean` | `Switch` | `true/false` ↔ `'true'/'false'` |
| `number` | `InputNumber` | số ↔ chuỗi số, rỗng ↔ `null` |
| `isSecret` | `Input.Password`, placeholder "Đã cấu hình — để trống nếu không đổi" | luôn bắt đầu rỗng |
| `text` | `Input.TextArea` (3 dòng) | giữ nguyên |
| `string`, `email`, `url` | `Input`, placeholder = `example` | giữ nguyên |
| riêng `default_role` | `Select` danh sách role (cần `roles.list` hoặc `users.list`) | tên role |

Mỗi ô có: nhãn đã dịch, key gốc dạng `code`, tag **Bí mật** / **Đã cấu hình**, và dòng mô tả. Key bí mật đã cấu hình có thêm nút **Xóa giá trị** (gửi `''`).

Các thành phần được dịch theo quy ước (namespace `settings` trong `src/frontends/admin/src/locales/{vi,en}.ts`):

| Bản dịch | Dùng cho |
| -------- | -------- |
| `settings.groups.<group>.title` / `.description` | Tiêu đề và mô tả nhóm |
| `settings.keys.<name>.label` / `.description` | Nhãn và mô tả ô nhập |

### 3.2 Quyền

| Hành động | Quyền | Ghi chú |
| --------- | ----- | ------- |
| Vào trang, xem | `settings.list` | Không có `settings.update` → form chỉ đọc, ẩn nút Lưu. |
| Lưu | `settings.update` | |
| Export | `settings.export` | Mục "Kèm giá trị bí mật" chỉ hiện (và backend chỉ chấp nhận) khi có thêm `settings.update`. |
| Import | `settings.import` | |

## 4. Backend

Files: [`settings.controller.ts`](../src/backends/api/src/settings/settings.controller.ts), [`settings.service.ts`](../src/backends/api/src/settings/settings.service.ts)

| API | Mô tả |
| --- | ----- |
| `GET /settings/public` (`@Public`) | Object `PublicSettings` đã ép kiểu, cho frontend trước khi đăng nhập. |
| `GET /settings` | Mọi key đã khai báo: khai báo + `value` (bí mật → `null`) + `configured` (DB có giá trị khác rỗng) + `updatedAt`. Key chưa có dòng trong DB trả `defaultValue`. |
| `PUT /settings` | Body `{ values: { name: value } }`. Key lạ → `400 settings.unknownKey`. Trả lại danh sách đầy đủ. |
| `GET /settings/export?includeSecrets=` | File `{ version: 1, exportedAt, includeSecrets, settings: [{ name, value }] }`. |
| `POST /settings/import` | Body `{ settings: [{ name, value }], overwrite }`. Trả `{ created, updated, skipped, unknown }`. |

**Kiểm tra & chuẩn hoá** (`normalizeValue`): giá trị được `trim`; rỗng luôn hợp lệ. `boolean` chỉ nhận `true`/`false`; `number` phải là số hữu hạn (lưu `String(Number(v))`); `email`, `url` kiểm tra định dạng; `string`/`text` giữ nguyên. Sai → `400 settings.invalidValue` (import: cả file bị từ chối).

**Import**: key trùng trong file lấy giá trị cuối; key chưa có giá trị (hoặc rỗng) → đặt mới; key đã có giá trị → chỉ ghi khi `overwrite = true` và giá trị khác; còn lại tính là bỏ qua.

**Đọc giá trị trong code** — luôn đi qua `SettingsService`, không query bảng trực tiếp:

```ts
constructor(private readonly settings: SettingsService) {}

await this.settings.getString('site_name');
await this.settings.getBoolean('require_2fa_admin');   // 'true' (không phân biệt hoa thường) → true
await this.settings.getNumber('smtp_port');            // không phải số → defaultValue
```

Chưa có trong DB → `defaultValue`. Giá trị được **cache trong bộ nhớ 30 giây**, xoá cache ngay khi lưu / import ở chính instance đó. Chạy nhiều instance thì instance khác có thể thấy giá trị cũ tối đa 30 giây.

## 5. Thêm một cài đặt mới

Ví dụ thêm `max_login_attempts` (số, nhóm Bảo mật).

1. **Khai báo** trong `src/packages/shared/src/constants/settings.ts`, đặt đúng vị trí muốn hiển thị trong nhóm:

   ```ts
   { name: 'max_login_attempts', group: 'security', type: 'number', defaultValue: '5' },
   ```

2. **Bản dịch** trong `src/frontends/admin/src/locales/vi.ts` và `en.ts`, mục `settings.keys`:

   ```ts
   max_login_attempts: {
     label: 'Số lần đăng nhập sai tối đa',
     description: 'Vượt quá thì tạm khoá đăng nhập.',
   },
   ```

   Phải có cả `label` và `description` (để `''` nếu không cần mô tả). `en.ts` có kiểu bắt buộc giống `vi.ts` → thiếu là TypeScript báo lỗi.

3. **Dùng giá trị** ở backend:

   ```ts
   const max = await this.settings.getNumber('max_login_attempts');
   ```

4. **(Tuỳ chọn) Tạo dòng mặc định trong DB**:

   ```bash
   pnpm db:seed
   ```

   Không bắt buộc — khi chưa có dòng, cả API lẫn `getString/getBoolean/getNumber` đều trả `defaultValue`. Seed chỉ thêm key còn thiếu, không ghi đè giá trị đã có.

Xong — ô nhập tự xuất hiện trong nhóm Bảo mật; lưu, export, import đều hoạt động mà không phải sửa frontend.

### 5.1 Thêm nhóm mới

1. Thêm tên nhóm vào `SETTING_GROUPS` (vị trí = thứ tự hiển thị).
2. Thêm `settings.groups.<group>.title` và `.description` vào `vi.ts` / `en.ts`.
3. Khai báo các key với `group: '<group>'`.

### 5.2 Cài đặt bí mật

Thêm `isSecret: true` (vd. API key, mật khẩu). Hệ quả tự động: ô `Input.Password`, `GET /settings` trả `value: null`, để trống khi lưu = giữ nguyên, có nút **Xóa giá trị**, export mặc định loại bỏ. Code backend vẫn đọc giá trị thật bằng `getString(...)`.

### 5.3 Cài đặt công khai cho frontend

`isPublic` chỉ là **nhãn khai báo**; `GET /settings/public` trả object được viết tay trong `SettingsService.getPublic()` với kiểu `PublicSettings`. Để frontend đọc được một key mới khi chưa đăng nhập:

1. Đặt `isPublic: true` trong khai báo (để người đọc biết key này lộ ra ngoài).
2. Thêm trường vào interface `PublicSettings` (`constants/settings.ts`) với kiểu đã ép (`boolean`, `number`…).
3. Thêm trường vào `getPublic()` trong `settings.service.ts`.
4. Frontend user đọc qua hook `usePublicSettings()` (`src/frontends/user/src/lib/usePublicSettings.ts`).

Không bao giờ đưa key `isSecret` vào `getPublic()`. Có thể trả giá trị dẫn xuất thay vì giá trị gốc (như `google_login_enabled` chỉ cho biết đã cấu hình Google hay chưa).

### 5.4 Ô nhập hoặc gợi ý đặc biệt

Phần lớn key không cần. Khi cần:

- **Ô nhập riêng**: thêm nhánh trong `renderInput()` của `SettingsGroupForm.tsx`, giống cách `default_role` dùng `Select` danh sách role.
- **Kiểu dữ liệu mới** (vd. `json`): thêm vào `SettingValueType`, thêm nhánh kiểm tra trong `normalizeValue()` (backend) và nhánh ô nhập + chuyển đổi `toFormValue` / `toSettingValue` (frontend).
- **Gợi ý cho cả nhóm**: truyền `hint` cho `SettingsGroupForm` trong `SettingsPage.tsx`, như `GoogleRedirectHint` của nhóm `google`.

### 5.5 Xoá một cài đặt

Xoá khai báo và bản dịch, sửa các chỗ gọi `get*('...')` (TypeScript chỉ ra). Dòng cũ trong DB không còn hiển thị và bị bỏ qua khi import; có thể xoá tay bằng SQL nếu muốn dọn.
