export type Lang = "ru" | "en";

export const translations = {
    ru: {
        // Layout
        sidebar_title: "CenterWay",
        sidebar_subtitle: "Control Panel",
        nav_dashboard: "Дашборд",
        nav_audit: "Аудит (L0)",
        nav_customers: "Клиенты (L1)",
        nav_orders: "Заказы/Доступ (L2-L3)",
        nav_analytics: "Аналитика (L6)",
        nav_jobs: "Мониторинг задач (L7)",
        topbar_title: "Control Panel v0.1",
        topbar_role: "Админ",

        // Auth / Dashboard
        login_title: "Control Panel",
        login_subtitle: "Модуль ограниченного доступа",
        login_card_title: "Вход в систему",
        login_card_subtitle: "Введите учётные данные для входа в L0.",
        login_btn: "Войти",
        dashboard_title: "Дашборд",
        dashboard_subtitle: "Добро пожаловать в CenterWay Control Panel.",
        dashboard_role_label: "Ваша роль",
        dashboard_email_label: "Email",
        dashboard_audit_label: "Статус Audit Log",
        dashboard_audit_status: "Активен",
        dashboard_signout: "Выйти",
        loading: "Загрузка...",

        // Audit Log
        audit_title: "Аудит (L0)",
        audit_subtitle: "События безопасности и ручные действия администраторов.",
        audit_col_time: "Время (UTC)",
        audit_col_actor: "Пользователь",
        audit_col_action: "Действие",
        audit_col_entity: "Объект",
        audit_col_details: "Детали",
        audit_loading: "Загрузка логов...",
        audit_empty: "Записи не найдены.",
    },
    en: {
        // Layout
        sidebar_title: "CenterWay",
        sidebar_subtitle: "Control Panel",
        nav_dashboard: "Dashboard",
        nav_audit: "Audit Log (L0)",
        nav_customers: "Customers (L1)",
        nav_orders: "Orders/Access (L2-L3)",
        nav_analytics: "Analytics (L6)",
        nav_jobs: "Job Monitor (L7)",
        topbar_title: "Control Panel v0.1",
        topbar_role: "Admin",

        // Auth / Dashboard
        login_title: "Control Panel",
        login_subtitle: "Restricted Access Module",
        login_card_title: "System Login",
        login_card_subtitle: "Provide credentials to enter L0.",
        login_btn: "Sign In",
        dashboard_title: "Dashboard",
        dashboard_subtitle: "Welcome back to the CenterWay Control Panel.",
        dashboard_role_label: "Your Role",
        dashboard_email_label: "Email",
        dashboard_audit_label: "Audit Log Status",
        dashboard_audit_status: "Active",
        dashboard_signout: "Sign Out",
        loading: "Loading...",

        // Audit Log
        audit_title: "Audit Log (L0)",
        audit_subtitle: "Security events and manual actions performed by admins.",
        audit_col_time: "Time (UTC)",
        audit_col_actor: "Actor",
        audit_col_action: "Action",
        audit_col_entity: "Entity",
        audit_col_details: "Details",
        audit_loading: "Loading logs...",
        audit_empty: "No audit logs found.",
    },
} as const;

export type TranslationKey = keyof typeof translations.en;
