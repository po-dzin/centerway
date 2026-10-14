import { BuilderLedger } from "@/components/builder/BuilderLedger";

/**
 * The author's ledger: their share, which post sold, what is already theirs.
 *
 * `oblik` is a reserved slug (`BUILDER_RESERVED_SLUGS`) because this static
 * segment wins over `/build/[course]`.
 */
export default function BuilderLedgerPage() {
  return <BuilderLedger />;
}
