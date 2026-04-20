export const validateEmail = (email: string): string | null => {
  if (!email.trim()) return "Email is required.";
  if (!email.includes("@") || !/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
};

export const validateRecipeTitle = (title: string): string | null => {
  if (!title.trim()) return "Title is required.";
  if (title.length > 80) return "Keep titles under 80 characters.";
  return null;
};
