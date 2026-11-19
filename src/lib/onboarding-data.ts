import { cache } from "react";
import { getCurrentBudget } from "@/lib/current-budget";
import { describeIncome, expectedForSlot } from "@/lib/income";
import { periodTag } from "@/lib/onboarding";
import { describeSchedule, formatShortDate, getPeriod, paydayLabel, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { createClient } from "@/lib/supabase/server";

// What step 3 and the Done screen show about the first period, read on the
// server. All the math is in the pure functions it calls.
export const getFirstPeriodInfo = cache(async () => {
  const budget = await getCurrentBudget();
  if (!budget) return null;

  const supabase = await createClient();
  const { data: sources, error } = await supabase
    .from("income_sources")
    .select("amount, pay_slot")
    .eq("budget_id", budget.id);
  if (error) throw new Error(`Couldn't load income sources: ${error.message}`, { cause: error });

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const period = getPeriod(today, schedule);

  return {
    budget,
    incomeCount: sources.length,
    period,
    tag: periodTag(period.start, today),
    paydayDate: formatShortDate(period.start),
    paydayLabel: paydayLabel(schedule, period.paySlot),
    expectedIncome: expectedForSlot(sources, schedule, period.paySlot),
    // The desktop rail's detail lines for finished steps 1 and 2.
    doneDetails: [describeSchedule(schedule), describeIncome(sources, schedule)],
  };
});
