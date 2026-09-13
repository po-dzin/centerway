/* The job monitor.
 *
 * Both languages of a string live on the same line, which is the whole point
 * of the shape: a key cannot exist in one locale and not the other. */
export const jobs = {
  jobs_title: { uk: "Фонові задачі", en: "Background Jobs" },
  jobs_subtitle: {
    uk: "Моніторинг розсилок, інтеграцій і відкладених процесів",
    en: "Monitoring of deliveries, integrations, and deferred flows",
  },
  jobs_tab_all: { uk: "Усі", en: "All" },
  jobs_tab_pending: { uk: "Очікують", en: "Pending" },
  jobs_tab_running: { uk: "У роботі", en: "Running" },
  jobs_tab_success: { uk: "Успішні", en: "Successful" },
  jobs_tab_failed: { uk: "Помилки", en: "Failed" },
  jobs_search_placeholder: { uk: "Пошук за payload або помилкою...", en: "Search by payload or error..." },
  jobs_loading: { uk: "Завантаження задач...", en: "Loading jobs..." },
  jobs_not_found: { uk: "Задач не знайдено", en: "No jobs found" },
  jobs_try_filters: {
    uk: "Спробуйте змінити параметри пошуку або фільтри.",
    en: "Try adjusting search parameters or filters.",
  },
  jobs_queue_empty: { uk: "Черга задач порожня.", en: "Job queue is empty." },
  jobs_status_pending: { uk: "Очікує", en: "Pending" },
  jobs_status_running: { uk: "Виконується", en: "Running" },
  jobs_status_success: { uk: "Успішно", en: "Success" },
  jobs_status_failed: { uk: "Помилка", en: "Failed" },
  jobs_retry_error: { uk: "Помилка повторного запуску задачі", en: "Failed to retry job" },
  jobs_retry_success: { uk: "Задачу поставлено в чергу повторно", en: "Job was queued again" },
  jobs_details: { uk: "Деталі задачі", en: "Job Details" },
  jobs_type: { uk: "Тип", en: "Type" },
  jobs_status: { uk: "Статус", en: "Status" },
  jobs_attempts: { uk: "Спроб", en: "Attempts" },
  jobs_payload: { uk: "Payload", en: "Payload" },
  jobs_error: { uk: "Помилка", en: "Error" },
  jobs_retry: { uk: "Повторити задачу", en: "Retry Job" },
} as const;
