# Kiến trúc

## Luồng request

```
Trình duyệt (user / admin)
   │  fetch /api/v1/...  + header x-app (admin|user), x-lang (vi|en)   ← @base/api-client
   ▼
Vite dev proxy (dev) / reverse proxy (prod) — cùng origin nên không cần CORS
   ▼
NestJS (Express) main.ts                         body-parser, prefix /api + version v1
   ▼
AuthGuard (APP_GUARD, toàn cục)                   đăng nhập trừ @Public(), quyền theo @RequirePermission()
   ▼
<domain>/<domain>.controller.ts                  @Controller, validate zod (@ZodBody / @ZodQuery / @ZodParams)
   ▼
<domain>/<domain>.service.ts (@Injectable)       nghiệp vụ, ném AppError có key i18n
   ▼
@base/db (Drizzle, inject qua @InjectDb())  →  PostgreSQL
```

Response luôn có dạng `{ data, error, meta? }`: `TransformInterceptor` bọc dữ liệu controller trả về (trả `paginated({ items, meta })` để có `meta`), `AllExceptionsFilter` chuyển mọi lỗi (AppError, lỗi Nest, lỗi body-parser/multer) về cùng định dạng. Lỗi: `error = { code, key, message, details? }`, trong đó `message` đã được dịch theo `x-lang` / `Accept-Language`, còn `key` (ví dụ `twoFactor.tokenInvalid`) để frontend xử lý riêng khi cần.

## Xác thực

- **Access token**: JWT 15 phút, gửi qua header `Authorization: Bearer`, frontend chỉ giữ trong bộ nhớ.
- **Refresh token**: chuỗi ngẫu nhiên trong cookie httpOnly `rt_admin` / `rt_user` (path `/api/v1`), DB chỉ lưu SHA-256. Mỗi lần refresh sẽ xoay vòng token; token vừa bị thay vẫn dùng được 60 giây để nhiều tab refresh cùng lúc không bị đăng xuất.
- **Mỗi request** nạp lại user + quyền từ DB, nên khoá tài khoản / đổi role / đổi quyền có hiệu lực ngay.
- **2FA đa phương thức** (chi tiết: [two-factor.md](two-factor.md)): passkey (WebAuthn), ứng dụng xác thực (TOTP, secret mã hoá AES-256-GCM bằng `ENCRYPTION_KEY`), mã 6 số qua email. Đăng nhập trả `requires2fa` (kèm `methods`, `defaultMethod`) hoặc `requiresSetup` (tài khoản admin khi setting `require_2fa_admin = true`, kèm `allowedMethods`) cùng token tạm 10 phút. 8 mã dự phòng dùng chung cho mọi phương thức, mỗi mã dùng 1 lần, chỉ lưu hash. Thêm/xoá phương thức khi 2FA đang bật cần xác minh lại (header `x-reauth-token`, 5 phút).
- **Quên mật khẩu**: token ngẫu nhiên 1 giờ (lưu hash). Luôn trả thành công để không lộ email nào tồn tại. Đặt lại mật khẩu sẽ thu hồi mọi phiên.
- **Đổi mật khẩu** thu hồi mọi phiên khác, giữ phiên hiện tại.
- **Rate limit** cho đăng nhập, 2FA, quên mật khẩu, đăng ký (`RateLimitService`, fixed window). Có `REDIS_URL` thì bộ đếm lưu trên Redis (`core/redis-rate-limit.store.ts`, 1 transaction `SET NX PX` + `INCR` + `PTTL`), dùng chung giữa nhiều instance; không có thì lưu trong bộ nhớ. Redis lỗi thì tạm đếm trong bộ nhớ của instance (không chặn đăng nhập, không bỏ giới hạn). `hit()` trả Promise: luôn `await` (ESLint `no-floating-promises` bắt chỗ quên).
- **Chạy nhiều instance**: cần `REDIS_URL`. Trạng thái còn lại trong bộ nhớ đều chấp nhận được: cache cài đặt (30 giây, instance khác thấy thay đổi chậm tối đa 30 giây), cache tra vị trí IP.

## Lịch sử đăng nhập

- Mỗi lần tạo phiên mới (`createSession`: mật khẩu, 2FA, Google, đăng ký) ghi 1 dòng vào bảng `login_histories`: app, IP, User-Agent, vị trí. Refresh token **không** tính là đăng nhập. Giữ 180 ngày, tự dọn (tối đa 1 lần/giờ).
- **Thiết bị**: phân tích User-Agent lúc đọc (`parseUserAgent` trong `server-kit/src/user-agent.ts`), nên sửa parser là áp dụng cho cả dữ liệu cũ.
- **Vị trí**: lấy từ header Cloudflare (`cf-ipcountry`, `cf-ipcity`, `cf-region`; hỗ trợ cả Vercel `x-vercel-ip-*`). Header thiếu thành phố thì tra IP qua ipwho.is **chạy nền** (không chờ, không làm chậm đăng nhập), có cache trong bộ nhớ; tắt bằng setting `login_geoip_enabled`. IP nội bộ/localhost hiển thị "Mạng nội bộ", mạng Tor hiển thị "Tor".
- **IP**: `getClientIp` chỉ tin header IP khi request đến từ proxy tin cậy (`TRUSTED_PROXIES`, mặc định loopback); khi đó ưu tiên `CF-Connecting-IP`, không có mới dùng `X-Forwarded-For` (dev qua proxy Vite đã bật `xfwd`). Xem mục [Triển khai sau Cloudflare](#triển-khai-sau-cloudflare).
- API: `GET /me/login-history` (của mình), `GET /users/:id/login-history` (quyền `users.loginHistory`). UI: tab **Lịch sử đăng nhập** ở trang tài khoản (cả 2 app, component `LoginHistoryTable` trong `@base/ui`) và mục cuối modal thông tin người dùng ở Admin → Người dùng.

## Triển khai sau Cloudflare

Hướng dẫn setup từng bước (build, systemd, nginx, Cloudflare Tunnel, SSL, Managed Transform, kiểm tra) nằm ở [README → Triển khai production (Cloudflare)](../README.md#triển-khai-production-cloudflare). Phần dưới chỉ ghi những chỗ code phụ thuộc vào Cloudflare:

- **IP client** (`getClientIp` trong `server-kit/src/request.ts`). Rate limit, phiên đăng nhập, lịch sử đăng nhập và Turnstile đều dùng hàm này.
  1. Kết nối TCP (`req.socket.remoteAddress`) không thuộc `TRUSTED_PROXIES` (mặc định `127.0.0.1,::1`) → dùng IP kết nối, bỏ qua mọi header IP. Gọi thẳng vào API kèm header giả không lách được rate limit.
  2. Kết nối từ proxy tin cậy (nginx cùng máy) → `CF-Connecting-IP` (Cloudflare tự đặt, ghi đè giá trị client gửi).
  3. Không có `CF-Connecting-IP` → `X-Forwarded-For` đọc từ **phải sang trái**, bỏ qua proxy tin cậy (proxy chỉ nối thêm vào cuối, phần tử bên trái do client tự gửi) → `X-Real-IP` → IP kết nối.

  Điều kiện còn lại nằm ở hạ tầng: nginx chỉ nhận traffic từ Cloudflare (Tunnel + nginx nghe `127.0.0.1`, hoặc firewall theo dải IP Cloudflare), vì API không phân biệt được request do nginx chuyển từ Cloudflare hay từ người gọi thẳng vào nginx. Production cảnh báo lúc khởi động nếu `HOST` không phải loopback.
- **Vị trí** (`getLocationFromHeaders` trong `server-kit/src/geo.ts`): đọc `cf-ipcountry`, `cf-ipcity`, `cf-region`. Cloudflare gửi UTF-8 thô còn Node đọc header theo latin1, nên giá trị được giải mã lại; `T1` = mạng Tor. Thiếu thành phố thì ghi cảnh báo 1 lần vào log và tra ipwho.is (nếu bật `login_geoip_enabled`).
- **Không có Cloudflare** (dev): dùng `X-Forwarded-For` do proxy Vite gửi (`xfwd: true`; proxy Vite gọi API từ loopback nên được tin).
- Muốn log nginx ghi IP thật: `real_ip_header CF-Connecting-IP;` kèm `set_real_ip_from <dải IP Cloudflare>;` (không ảnh hưởng API).

## Phân quyền (RBAC)

> Chi tiết: [permissions.md](permissions.md) (thiết kế, thêm quyền) và [permission-sync.md](permission-sync.md) (nút Đồng bộ).

- Giống hệ thống gốc, **mỗi permission ứng với 1 API** (method + URL), ví dụ `users.list` = `GET /api/v1/users`; riêng loại `CLIENT` (`admin.access`) là quyền giao diện. Danh sách được định nghĩa **trong code** tại `src/packages/shared/src/constants/permissions.ts`.
- **Key** (`users.list`) là định danh cố định mà code dùng để kiểm tra quyền, không sửa được. Module / loại / method / URL / mô tả **sửa được** ở trang Admin → Quyền; trang này đánh dấu quyền nào đang khác với code.
- DB được đồng bộ bằng `pnpm db:seed` hoặc nút **Đồng bộ** ở trang Admin → Quyền: xem trước quyền mới, quyền khác với code (sẽ được đưa về như code) và quyền thừa (tuỳ chọn xoá).
- Mỗi user có tối đa 1 **role**; role là tập permission. Role bị vô hiệu → user mất toàn bộ quyền của role đó.
- `isSuperAdmin` = có mọi quyền. Chỉ super admin mới cấp/sửa được super admin.
- Vào trang admin cần quyền `admin.access`.
- Backend: `@RequirePermission('users.update')` trên handler (nhiều key = cần 1 trong các quyền). Frontend: `useAuth().can('users.update')`, `<Can permission>`, `<RequirePermission>`.

### Thêm permission mới

1. Thêm 1 dòng vào `PERMISSION_DEFINITIONS` trong `permissions.ts`: `{ key, module, ...api('GET', '/duong-dan') }`.
2. Thêm tên hiển thị vào `permissions.items` trong `src/frontends/admin/src/locales/{vi,en}.ts`.
3. Dùng ở controller: `@RequirePermission('x.y')`.
4. Chạy `pnpm db:seed` (hoặc bấm Đồng bộ ở trang admin), rồi gán quyền cho role.

## Cài đặt hệ thống

> Chi tiết: [settings.md](settings.md) (thiết kế giao diện, thêm setting mới).

Chỉ các **key hệ thống** khai báo ở `src/packages/shared/src/constants/settings.ts` (nhóm, kiểu, `isSecret`, `isPublic`, giá trị mặc định) được hiển thị và cấu hình; trang admin chia theo nhóm, ô nhập theo kiểu dữ liệu, server kiểm tra kiểu khi lưu.

- `isPublic`: frontend đọc được không cần đăng nhập qua `GET /settings/public`.
- `isSecret`: không bao giờ trả giá trị về client; để trống khi lưu = giữ nguyên; chỉ export khi chọn "kèm giá trị bí mật".
- Import JSON nhận file export, mảng `[{ name, value }]` hoặc object `{ key: value }`; key không thuộc hệ thống bị bỏ qua.
- Thêm key mới: thêm vào `SETTING_DEFINITIONS`, thêm nhãn/mô tả vào `settings.keys` trong `src/frontends/admin/src/locales/{vi,en}.ts`, chạy `pnpm db:seed` để tạo giá trị mặc định.

## Email, Google, xác minh email

- **Email** (`mail/mail.service.ts`): xác minh email và đặt lại mật khẩu gửi qua **Sendify** theo template (`sendify_template_*`) nếu đã cấu hình, nếu không thì SMTP; chưa cấu hình gì thì ghi log.
- **Xác minh email**: mã 6 số (lưu hash), hiệu lực 10 phút, gửi lại sau 60 giây. Setting `require_email_verification` bật thì gửi mã ngay khi đăng ký; tài khoản chưa xác minh bị chặn ở mọi API trừ các API tài khoản (`@AllowUnverifiedEmail()`) và frontend chỉ hiện màn hình nhập mã. Tài khoản do admin tạo, tạo qua Google và super admin coi như đã xác minh.
- **Đăng nhập Google** (`auth/google.service.ts`): OAuth phía server. `GET /auth/google?app=user` → Google → `GET /auth/google/callback` (kiểm tra `state` + cookie chống CSRF) → tạo phiên (cookie refresh) rồi chuyển về app; tài khoản bật 2FA thì quay về `/login?twoFactorToken=...` để nhập mã. Liên kết theo Google ID, sau đó theo email (email Google đã xác minh); chưa có thì tạo tài khoản mới (nếu cho phép đăng ký), không có mật khẩu — người dùng có thể đặt mật khẩu ở trang tài khoản.

## Đa ngôn ngữ

- Ngôn ngữ: `vi` (mặc định), `en` — `src/packages/shared/src/constants/locales.ts`.
- **Backend**: bản dịch ở `src/backends/api/src/i18n/{vi,en}.ts` (thông báo lỗi, email, thông báo hệ thống). Bản `en` có kiểu bắt buộc giống `vi`, nên thiếu key là TypeScript báo lỗi.
- **Frontend**: i18next. Bản dịch dùng chung (`common`, `auth`, `account`) nằm ở `src/packages/ui/src/i18n/locales`, bản dịch riêng của từng app ở `src/frontends/<app>/src/locales`. antd và dayjs đổi locale theo ngôn ngữ đang chọn.
- Ngôn ngữ người dùng chọn được lưu vào tài khoản (`users.lang`) để email và thông báo hệ thống gửi đúng ngôn ngữ.

## Quy ước backend

- Cấu trúc giống `crm_backend` (gpm_crm_2025): mỗi domain 1 thư mục `src/<domain>/` gồm `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`. Phần dùng chung: `core/` (DB, rate limit, filter, interceptor, pipe zod), `decorators/customize.ts`, `config/env.ts`.
- Decorator: `@Public()`, `@RequirePermission(...)`, `@AllowUnverifiedEmail()`, `@CurrentPrincipal()` (user + quyền), `@ReqCtx()` (header, app `x-app`, ngôn ngữ), `@ZodBody/@ZodQuery/@ZodParams(schema)` dùng schema zod của `@base/shared` (frontend dùng chung).
- Status: POST mặc định 201 (tạo mới); API hành động dùng `@HttpCode(HttpStatus.OK)`, không có body dùng `@HttpCode(HttpStatus.NO_CONTENT)`.
- Lỗi nghiệp vụ: `throw notFound('users.notFound')`, `conflict('roles.nameExists', { ... })`... rồi thêm key vào `i18n/vi.ts` và `i18n/en.ts`.
- Biến môi trường: `src/backends/api/.env` (mẫu đầy đủ kèm chú thích: `.env.example`), đọc qua `getEnv()` (validate bằng zod, sai cấu hình thì dừng khởi động). Script DB (`@base/db`) và test e2e cũng đọc file này, nên `DATABASE_URL` chỉ khai báo 1 chỗ.
- Build: Nest CLI + webpack (`webpack.config.js`) gộp các package `@base/*` (mã nguồn TypeScript) vào `dist/main.js`; thư viện khai báo trong `package.json` của api để ngoài bundle.

### Thêm một module mới (ví dụ `products`)

1. Schema bảng: `src/packages/db/src/schema/products.ts`, export trong `schema/index.ts`, chạy `pnpm db:generate` rồi `pnpm db:migrate`.
2. Schema zod + DTO: `src/packages/shared/src/schemas/product.ts`, export trong `index.ts`.
3. Permission: thêm các quyền `products.*` vào `PERMISSION_DEFINITIONS` (`PERMISSION_MODULES` tự sinh từ đó), thêm bản dịch `permissions.modules.products` và `permissions.items.products.*` — xem [permissions.md § 9](permissions.md#9-thêm-quyền-mới).
4. Backend: `src/backends/api/src/products/` gồm `products.module.ts`, `products.controller.ts` (`@Controller('products')`), `products.service.ts`; thêm `ProductsModule` vào `imports` của `app.module.ts`.
5. SDK: thêm `src/packages/api-client/src/endpoints/products.ts`, đăng ký trong `createApi`.
6. Admin: `src/frontends/admin/src/features/products/`, thêm route + menu + bản dịch.

## Quy ước frontend

- Tổ chức theo feature: `src/features/<feature>/` gồm page, component, hook react-query.
- Gọi API qua `useApi()` (SDK) + `@tanstack/react-query`.
- Phần dùng chung giữa 2 app (layout, đăng nhập, trang tài khoản, i18n chung) đặt ở `@base/ui`.
- Sidebar theo giao diện hệ thống gốc: `<AppShell variant="admin" | "user">` (rộng 260px, thu gọn 55px, mobile trượt từ trái).
- Lint: `pnpm lint` (cấu hình ở `eslint.config.mjs`), bao gồm các rule React Compiler của `eslint-plugin-react-hooks` v7 — tránh gọi setState đồng bộ trong effect và đọc/ghi ref trong lúc render.

## Thêm backend mới

Copy `src/backends/api` thành thư mục mới, đổi `name` trong `package.json` và `PORT` trong `.env`. Các package `db`, `server-kit`, `shared` dùng lại nguyên vẹn.
