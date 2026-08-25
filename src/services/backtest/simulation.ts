import { buildTechnicalSnapshot } from "@/engine/technical/technical-analysis";
import { buildTradingSetup } from "@/engine/trading/setup";
import type { TradingRiskSettings } from "@/engine/trading/types";
import type { OhlcvBar } from "@/engine/utils/validation";
import type { DataStatus } from "@/services/market/provider";
import type { PositionSide, Timeframe } from "@/types/enums";
import { BACKTEST_WARMUP_BARS } from "./constants";
import {
  cashAfterClose,
  cashAfterOpen,
  evaluateBarExit,
  markToMarket,
  realizedPnL,
  realizedPnLPercent,
  unrealizedPnL,
} from "./calculations";
import { engineDataStatus } from "./historical-data-provider";
import type {
  BacktestConfig,
  BacktestTrade,
  EquityPoint,
} from "./types";

type PendingEntry = {
  side: PositionSide;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  setupScore: number | null;
  technicalCondition: string;
  decisionTime: Date;
  positionValue: number;
};

type OpenPosition = PendingEntry & {
  entryPrice: number;
  entryTime: Date;
};

export type SimulationInput = {
  config: BacktestConfig;
  candles: readonly OhlcvBar[];
  providerDataStatus: DataStatus;
  baseRiskSettings: Omit<TradingRiskSettings, "accountCapital">;
};

export type SimulationOutput = {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  endingCapital: number;
  providerDataStatus: DataStatus;
};

/**
 * Execution convention (documented):
 * 1. At candle T close, build snapshot using candles <= T and evaluate setup.
 * 2. If VALID, a market order becomes eligible for the next candle T+1.
 * 3. Entry fills at T+1 open (never T close or future prices).
 * 4. Stop/target evaluated on each subsequent bar using high/low.
 * 5. Same-bar stop+target → STOP LOSS wins.
 */
export function runBacktestSimulation(input: SimulationInput): SimulationOutput {
  const dataStatus = engineDataStatus(input.providerDataStatus);
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  let cash = input.config.startingCapital;
  let open: OpenPosition | null = null;
  let pending: PendingEntry | null = null;
  let peakEquity = cash;
  let tradeCounter = 0;

  const recordEquity = (bar: OhlcvBar) => {
    const invested = open
      ? markToMarket({
          quantity: open.quantity,
          markPrice: bar.close,
        })
      : 0;
    const unrealized = open
      ? unrealizedPnL({
          side: open.side,
          entryPrice: open.entryPrice,
          quantity: open.quantity,
          markPrice: bar.close,
        })
      : 0;
    const equity = cash + invested;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown =
      peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
    equityCurve.push({
      timestamp: bar.timestamp.toISOString(),
      cash,
      invested,
      equity,
      unrealizedPnL: unrealized,
      drawdown,
    });
  };

  const closePosition = (
    bar: OhlcvBar,
    exitPrice: number,
    exitReason: BacktestTrade["exitReason"],
  ) => {
    if (!open) {
      return;
    }
    tradeCounter += 1;
    const pnl = realizedPnL({
      side: open.side,
      entryPrice: open.entryPrice,
      exitPrice,
      quantity: open.quantity,
    });
    trades.push({
      id: `bt-${tradeCounter}`,
      side: open.side,
      entryTime: open.entryTime.toISOString(),
      exitTime: bar.timestamp.toISOString(),
      entryPrice: open.entryPrice,
      exitPrice,
      quantity: open.quantity,
      stopLoss: open.stopLoss,
      takeProfit: open.takeProfit,
      riskAmount: open.riskAmount,
      realizedPnL: pnl,
      realizedPnLPercent: realizedPnLPercent({
        side: open.side,
        entryPrice: open.entryPrice,
        exitPrice,
      }),
      exitReason,
      setupScore: open.setupScore,
      technicalCondition: open.technicalCondition,
      dataStatus: input.providerDataStatus,
      decisionTime: open.decisionTime.toISOString(),
    });
    cash = cashAfterClose({
      cashBalance: cash,
      entryPrice: open.entryPrice,
      quantity: open.quantity,
      exitPrice,
      side: open.side,
    });
    open = null;
  };

  for (let i = BACKTEST_WARMUP_BARS; i < input.candles.length; i += 1) {
    const bar = input.candles[i]!;

    if (pending && !open) {
      if (cash < pending.positionValue) {
        pending = null;
      } else {
        open = {
          ...pending,
          entryPrice: bar.open,
          entryTime: bar.timestamp,
        };
        cash = cashAfterOpen({
          cashBalance: cash,
          entryPrice: open.entryPrice,
          quantity: open.quantity,
        });
        pending = null;

        const exitOnEntryBar = evaluateBarExit({
          side: open.side,
          stopLoss: open.stopLoss,
          takeProfit: open.takeProfit,
          high: bar.high,
          low: bar.low,
        });
        if (exitOnEntryBar) {
          closePosition(bar, exitOnEntryBar.exitPrice, exitOnEntryBar.exitReason);
        }
      }
    } else if (open) {
      const exit = evaluateBarExit({
        side: open.side,
        stopLoss: open.stopLoss,
        takeProfit: open.takeProfit,
        high: bar.high,
        low: bar.low,
      });
      if (exit) {
        closePosition(bar, exit.exitPrice, exit.exitReason);
      }
    }

    recordEquity(bar);

    if (open || pending || i >= input.candles.length - 2) {
      continue;
    }

    const decisionBar = bar;
    const history = input.candles.slice(0, i + 1);
    const snapshot = buildTechnicalSnapshot({
      symbol: input.config.symbol,
      timeframe: input.config.timeframe as Timeframe,
      candles: history,
      dataStatus,
      asOf: decisionBar.timestamp,
    });
    const settings: TradingRiskSettings = {
      ...input.baseRiskSettings,
      accountCapital: cash,
    };
    const setup = buildTradingSetup({
      snapshot,
      settings,
      now: decisionBar.timestamp,
    });

    if (
      setup.status !== "VALID" ||
      setup.direction === "NO_TRADE" ||
      setup.entry === null ||
      setup.stopLoss === null ||
      setup.takeProfit === null ||
      setup.positionSize === null ||
      setup.positionValue === null ||
      setup.riskAmount === null
    ) {
      continue;
    }

    const side: PositionSide =
      setup.direction === "SHORT" ? "SHORT" : "LONG";

    pending = {
      side,
      quantity: setup.positionSize,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      riskAmount: setup.riskAmount,
      setupScore: setup.score,
      technicalCondition: snapshot.technicalCondition,
      decisionTime: decisionBar.timestamp,
      positionValue: setup.positionValue,
    };
  }

  const lastBar = input.candles[input.candles.length - 1];
  if (open && lastBar) {
    closePosition(lastBar, lastBar.close, "END_OF_DATA");
    const lastPoint = equityCurve[equityCurve.length - 1];
    if (lastPoint) {
      lastPoint.cash = cash;
      lastPoint.invested = 0;
      lastPoint.equity = cash;
      lastPoint.unrealizedPnL = 0;
    }
  }

  return {
    trades,
    equityCurve,
    endingCapital: cash,
    providerDataStatus: input.providerDataStatus,
  };
}
