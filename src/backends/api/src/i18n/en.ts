import type { Messages } from '@base/server-kit';
import type { vi } from './vi';

/** Cấu trúc giống hệt bản tiếng Việt (TypeScript báo lỗi nếu thiếu key) */
type Catalog<T> = { [K in keyof T]: T[K] extends string ? string : Catalog<T[K]> };

export const en: Catalog<typeof vi> & Messages = {
  errors: {
    badRequest: 'Invalid request',
    validation: 'Invalid data',
    invalidJson: 'Body must be valid JSON',
    unauthorized: 'You are not signed in or your session has expired',
    forbidden: 'You do not have permission to perform this action',
    notFound: 'Not found',
    conflict: 'Already exists',
    payloadTooLarge: 'Payload too large',
    tooManyRequests: 'Too many attempts, please try again in {{seconds}} seconds',
    internal: 'Something went wrong, please try again later',
  },
  validation: {
    password: { needDigit: 'Password must contain at least one digit' },
    notification: { targetRequired: 'Choose a recipient or send to everyone' },
    permission: { apiPathFormat: 'URL must start with /' },
  },
  auth: {
    invalidCredentials: 'Incorrect email or password',
    accountLocked: 'Your account has been locked, please contact an administrator',
    adminAccessDenied: 'This account cannot access the admin panel',
    sessionExpired: 'Your session has expired, please sign in again',
    emailExists: 'Email is already in use',
    registrationDisabled: 'Registration is currently disabled',
    captchaRequired: 'Please complete the captcha',
    captchaInvalid: 'Captcha verification failed, please try again',
    resetTokenInvalid: 'The reset link is invalid or has expired',
    forgotPasswordSent: 'If the email exists, you will receive a password reset link',
    passwordResetSuccess: 'Your password has been reset',
    googleDisabled: 'Google sign-in is not configured',
    googleCancelled: 'Google sign-in was cancelled',
    googleFailed: 'Google sign-in failed, please try again',
    googleStateInvalid: 'The Google sign-in session expired, please try again',
    googleEmailUnverified: 'The email of this Google account is not verified',
  },
  twoFactor: {
    tokenInvalid: 'Two-factor session expired, please sign in again',
    codeInvalid: 'Invalid verification code',
    alreadyEnabled: 'Two-factor authentication is already enabled',
    notEnabled: 'Two-factor authentication is not enabled',
    notSetup: 'Generate a QR code before enabling two-factor authentication',
    methodNotEnabled: 'This verification method is not enabled',
    methodNotAllowed: 'This verification method is not allowed',
    lastStrongMethod: 'Admin accounts must keep at least one authenticator app or passkey',
    emailNotVerified: 'Verify your email before using it for two-factor authentication',
    emailCooldown: 'Please wait {{seconds}} seconds before requesting a new code',
    emailSendFailed: 'Could not send the verification email, please try again later',
    passkeyInvalid: 'Passkey verification failed',
    passkeyChallengeExpired: 'Passkey registration expired, please try again',
    passkeyExists: 'This passkey is already registered',
    passkeyLimit: 'You can register up to {{max}} passkeys',
    passkeyNotFound: 'Passkey not found',
    reauthRequired: 'Please verify your identity to continue',
    requiredForAdmin: 'Admin accounts must keep two-factor authentication enabled',
  },
  twoFactorMethods: {
    totp: 'Authenticator app',
    email: 'Email',
    passkey: 'Passkey',
  },
  account: {
    currentPasswordIncorrect: 'Current password is incorrect',
    passwordIncorrect: 'Incorrect password',
    samePassword: 'New password must be different from the current one',
    avatarRequired: 'Please choose an image',
    avatarInvalidType: 'Only PNG, JPEG, WEBP or GIF images are allowed',
    avatarTooLarge: 'Image must not exceed {{size}}',
  },
  users: {
    notFound: 'User not found',
    cannotModifySuperAdmin: 'Only super admins can modify super admin accounts',
    cannotModifySelf: 'You cannot lock, delete or demote your own account',
    roleNotFound: 'Role does not exist',
  },
  roles: {
    notFound: 'Role not found',
    nameExists: 'Role name already exists',
    inUse: 'Role is assigned to {{count}} user(s) and cannot be deleted',
    systemRole: 'System roles cannot be deleted, renamed or deactivated',
  },
  settings: {
    invalidValue: 'Invalid value for "{{name}}"',
    unknownKey: '"{{name}}" is not a system setting key',
  },
  permissions: {
    notFound: 'Permission not found',
  },
  emailVerification: {
    required: 'Please verify your email before continuing',
    alreadyVerified: 'Your email is already verified',
    cooldown: 'Please wait {{seconds}} seconds before requesting a new code',
    codeInvalid: 'The verification code is invalid or has expired',
    sendFailed: 'Could not send the verification email, please try again later',
  },
  notifications: {
    welcome: {
      title: 'Welcome to {{appName}}',
      message: 'Your account has been created successfully.',
    },
    passwordChanged: {
      title: 'Your password was changed',
      message: 'If this was not you, reset your password immediately.',
    },
    twoFactorEnabled: {
      title: 'Two-factor authentication enabled',
      message: 'Your account is now protected by two-factor authentication.',
    },
    twoFactorDisabled: {
      title: 'Two-factor authentication disabled',
      message: 'If this was not you, change your password immediately.',
    },
    twoFactorMethodAdded: {
      title: 'Two-factor method added',
      message:
        '"{{method}}" was added to your account. If this was not you, change your password immediately.',
    },
    twoFactorMethodRemoved: {
      title: 'Two-factor method removed',
      message:
        '"{{method}}" was removed from your account. If this was not you, change your password immediately.',
    },
  },
  mail: {
    greeting: 'Hello {{name}},',
    verifyEmail: {
      subject: '[{{appName}}] Your email verification code',
      intro: 'Your email verification code is:',
      expiry: 'This code is valid for {{minutes}} minutes.',
      ignore: 'If you did not request this, you can ignore this email.',
    },
    twoFactorCode: {
      subject: '[{{appName}}] Your sign-in verification code',
      intro: 'Your two-factor verification code is:',
      expiry: 'The code is valid for {{minutes}} minutes and can only be used once.',
      context: 'Requested from IP {{ip}} - device {{device}}.',
      warning:
        'If you are not signing in, your password may be compromised: change it now and never share this code.',
    },
    footer: 'This email was sent automatically by {{appName}}, please do not reply.',
    resetPassword: {
      subject: '[{{appName}}] Reset your password',
      intro: 'We received a request to reset the password for your account.',
      action: 'Reset password',
      expiry: 'This link is valid for {{minutes}} minutes.',
      ignore: 'If you did not request this, you can ignore this email.',
    },
  },
};
