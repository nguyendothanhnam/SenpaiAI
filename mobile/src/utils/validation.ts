// Same rules as frontend/src/utils/helpers.ts; checked against the source in tests.
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export const isValidPassword = (password: string) => password.length >= 6
export const isValidUsername = (username: string) => username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username)
