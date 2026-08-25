import { z } from "zod";
import { symbolSchema, timeframeSchema } from "@/services/market/schemas";
import {
  BACKTEST_MAX_RANGE_DAYS,
  BACKTEST_MAX_STARTING_CAPITAL,
  BACKTEST_MIN_STARTING_CAPITAL,
} from "./constants";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");

export const backtestRequestSchema = z
  .object({
    symbol: symbolSchema,
    timeframe: timeframeSchema,
    from: isoDateSchema,
    to: isoDateSchema,
    startingCapital: z.coerce
      .number()
      .refine((value) => Number.isFinite(value), "Starting capital must be finite.")
      .gte(
        BACKTEST_MIN_STARTING_CAPITAL,
        `Starting capital must be at least ${BACKTEST_MIN_STARTING_CAPITAL}.`,
      )
      .lte(
        BACKTEST_MAX_STARTING_CAPITAL,
        `Starting capital cannot exceed ${BACKTEST_MAX_STARTING_CAPITAL}.`,
      ),
  })
  .superRefine((value, ctx) => {
    const fromDate = parseUtcDate(value.from);
    const toDate = parseUtcDate(value.to);
    if (!fromDate || !toDate) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "Invalid date.",
      });
      return;
    }
    if (fromDate.getTime() >= toDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be after start date.",
      });
    }
    const spanDays =
      (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
    if (spanDays > BACKTEST_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Date range cannot exceed ${BACKTEST_MAX_RANGE_DAYS} days.`,
      });
    }
  });

export type BacktestRequestInput = z.infer<typeof backtestRequestSchema>;

export function parseUtcDate(value: string): Date | null {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed);
}

export function backtestConfigFromRequest(
  input: BacktestRequestInput,
): {
  symbol: string;
  timeframe: BacktestRequestInput["timeframe"];
  from: Date;
  to: Date;
  startingCapital: number;
} {
  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    from: parseUtcDate(input.from)!,
    to: endOfUtcDay(parseUtcDate(input.to)!),
    startingCapital: input.startingCapital,
  };
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}
