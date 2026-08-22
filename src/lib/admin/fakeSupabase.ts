/**
 * A tiny in-memory stand-in for the Supabase client, for unit tests only.
 *
 * The access module is mostly query-shaping and bookkeeping — which row it
 * writes, what it puts in `audit_log`, how it folds an event log into a status.
 * None of that is testable against the real client without a database, and all
 * of it is exactly what breaks silently. So the tests run against a fake that
 * implements the handful of PostgREST verbs this module actually uses.
 *
 * It is deliberately NOT a Postgres emulator: no joins, no RLS, no type
 * coercion. If a test needs behaviour this fake does not have, the honest fix
 * is to add it here rather than to loosen the assertion.
 *
 * Lives in src/ (not tests/) because vitest only collects `src/**\/*.test.ts`
 * and the module is imported by those tests alone.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

function ilikeToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
}

class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; error: { message: string } | null; count?: number }> {
    private filters: Filter[] = [];
    private orders: { column: string; ascending: boolean }[] = [];
    private rangeBounds: { from: number; to: number } | null = null;
    private limitCount: number | null = null;
    private mode: "select" | "insert" | "update" | "delete" = "select";
    private payload: Row[] = [];
    private countExact = false;
    private headOnly = false;
    private singleMode: "one" | "maybe" | null = null;

    constructor(
        private readonly db: FakeSupabase,
        private readonly table: string
    ) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
        if (options?.count === "exact") this.countExact = true;
        if (options?.head) this.headOnly = true;
        return this;
    }

    insert(values: Row | Row[]) {
        this.mode = "insert";
        this.payload = Array.isArray(values) ? values : [values];
        return this;
    }

    update(patch: Row) {
        this.mode = "update";
        this.payload = [patch];
        return this;
    }

    upsert(values: Row, options?: { onConflict?: string }) {
        this.mode = "insert";
        this.payload = [values];
        this.db.conflictKey = options?.onConflict ?? null;
        return this;
    }

    delete() {
        this.mode = "delete";
        return this;
    }

    eq(column: string, value: unknown) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    in(column: string, values: unknown[]) {
        const set = new Set(values);
        this.filters.push((row) => set.has(row[column]));
        return this;
    }

    ilike(column: string, pattern: string) {
        const re = ilikeToRegExp(pattern);
        this.filters.push((row) => typeof row[column] === "string" && re.test(row[column] as string));
        return this;
    }

    not(column: string, operator: string, value: unknown) {
        if (operator !== "is" || value !== null) throw new Error(`fake: unsupported not(${operator})`);
        this.filters.push((row) => row[column] !== null && row[column] !== undefined);
        return this;
    }

    /** `or("email.ilike.%x%,full_name.ilike.%x%")` — only the ilike form is used. */
    or(expression: string) {
        const clauses = expression.split(",").map((clause) => {
            const [column, operator, ...rest] = clause.split(".");
            if (operator !== "ilike") throw new Error(`fake: unsupported or(${operator})`);
            const re = ilikeToRegExp(rest.join("."));
            return (row: Row) => typeof row[column] === "string" && re.test(row[column] as string);
        });
        this.filters.push((row) => clauses.some((clause) => clause(row)));
        return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
        this.orders.push({ column, ascending: options?.ascending !== false });
        return this;
    }

    range(from: number, to: number) {
        this.rangeBounds = { from, to };
        return this;
    }

    limit(count: number) {
        this.limitCount = count;
        return this;
    }

    maybeSingle() {
        this.singleMode = "maybe";
        return this;
    }

    single() {
        this.singleMode = "one";
        return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: { data: never; error: { message: string } | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.run()).then(onfulfilled as never, onrejected);
    }

    private rows(): Row[] {
        return (this.db.tables[this.table] ??= []);
    }

    private matching(): Row[] {
        return this.rows().filter((row) => this.filters.every((filter) => filter(row)));
    }

    private run() {
        const failure = this.db.failures[`${this.table}:${this.mode}`];
        if (failure) return { data: null, error: { message: failure } };

        if (this.mode === "insert") {
            const inserted = this.payload.map((row) => {
                const key = this.db.conflictKey;
                const existing = key ? this.rows().find((candidate) => candidate[key] === row[key]) : undefined;
                if (existing) {
                    Object.assign(existing, row);
                    return existing;
                }
                const created = { id: this.db.nextId(this.table), ...row };
                this.rows().push(created);
                return created;
            });
            this.db.conflictKey = null;
            return this.shape(inserted);
        }

        if (this.mode === "update") {
            const touched = this.matching();
            for (const row of touched) Object.assign(row, this.payload[0]);
            return this.shape(touched);
        }

        if (this.mode === "delete") {
            const doomed = new Set(this.matching());
            this.db.tables[this.table] = this.rows().filter((row) => !doomed.has(row));
            return this.shape([...doomed]);
        }

        let result = this.matching();
        for (const { column, ascending } of [...this.orders].reverse()) {
            result = [...result].sort((a, b) => {
                const left = String(a[column] ?? "");
                const right = String(b[column] ?? "");
                return ascending ? left.localeCompare(right) : right.localeCompare(left);
            });
        }

        const total = result.length;
        if (this.rangeBounds) result = result.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
        if (this.limitCount !== null) result = result.slice(0, this.limitCount);

        if (this.headOnly) return { data: null, error: null, count: total };
        return this.shape(result, total);
    }

    private shape(stored: Row[], total?: number) {
        // Copies, not references: the real client returns decoded JSON, so a
        // later write must not retroactively change a row a caller already
        // read. Handing out live objects would hide exactly that class of bug.
        const rows = stored.map((row) => ({ ...row }));
        const count = this.countExact ? (total ?? rows.length) : undefined;
        if (this.singleMode) {
            if (this.singleMode === "one" && rows.length !== 1) {
                return { data: null, error: { message: "expected exactly one row" }, count };
            }
            return { data: rows[0] ?? null, error: null, count };
        }
        return { data: rows, error: null, count };
    }
}

export class FakeSupabase {
    conflictKey: string | null = null;
    /** `${table}:${mode}` → error message, for the error branches. */
    failures: Record<string, string> = {};
    private counters: Record<string, number> = {};

    constructor(public tables: Tables = {}) {}

    from(table: string) {
        return new FakeQuery(this, table);
    }

    nextId(table: string) {
        this.counters[table] = (this.counters[table] ?? 0) + 1;
        return `${table}-${this.counters[table]}`;
    }

    rows(table: string): Row[] {
        return this.tables[table] ?? [];
    }
}
