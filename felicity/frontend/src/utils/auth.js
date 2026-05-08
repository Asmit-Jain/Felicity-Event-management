export const saveToken = (token) => {
  localStorage.setItem("token", token);
};

export const removeToken = () => {
  localStorage.removeItem("token");
};

export const getToken = () => {
  return localStorage.getItem("token");
};

export const isLoggedIn = () => {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const getUserRole = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role;
  } catch {
    return null;
  }
};

export const getUserInitials = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "ME";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (
      payload.firstName[0] + payload.lastName[0]
    ).toUpperCase();
  } catch {
    return "ME";
  }
};
