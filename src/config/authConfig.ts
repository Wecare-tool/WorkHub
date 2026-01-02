// MSAL Configuration for Dataverse
// Biến môi trường được cấu hình trong file .env

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_CLIENT_ID || "",
        authority: import.meta.env.VITE_AUTHORITY || "https://login.microsoftonline.com/common"
        //redirectUri: window.location.origin + window.location.pathname,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
};

export const dataverseConfig = {
    baseUrl: "https://wecare-ii.crm5.dynamics.com/api/data/v9.2",
    scopes: ["https://wecare-ii.crm5.dynamics.com/.default"],
};

// Tên nhân viên để filter
export const EMPLOYEE_NAME = "Lê Hoàng Hiếu";
// TODO: Thay bằng GUID của nhân viên trong Dataverse (lookup field)
// Lấy từ table systemuser hoặc contact
export const EMPLOYEE_ID = import.meta.env.VITE_EMPLOYEE_ID || "";
