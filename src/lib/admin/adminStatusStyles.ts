export const JOB_STATUS_BADGE_CLASS = {
    pending: "cw-status-pending-badge",
    running: "cw-status-running-badge",
    success: "cw-status-success-badge",
    failed: "cw-status-failed-badge",
} as const;

export const ORDER_STATUS_BADGE_CLASS: Record<string, string> = {
    paid: "cw-status-success-badge",
    created: "cw-status-pending-badge",
    pending: "cw-status-pending-badge",
    refunded: "cw-status-failed-badge",
};

