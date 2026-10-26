import type { Minor } from "@/domain/money";
import { formatKc } from "@/domain/money";

/**
 * Every price on the site renders through here, so the formatting rule lives in one
 * place and a raw number can never reach the page by accident.
 */
export function Price({ amount, className }: { amount: Minor; className?: string }) {
  return <span className={className}>{formatKc(amount)}</span>;
}
