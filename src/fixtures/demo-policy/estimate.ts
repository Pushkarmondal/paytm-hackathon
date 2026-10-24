import { rupees } from "@/engine/money";
import type { HospitalEstimate, Scenario } from "@/engine/types";

export const ROOM_TWIN = "twin-sharing";
export const ROOM_SINGLE = "single-private";
export const ROOM_DELUXE = "deluxe";

export const DEMO_ESTIMATE: HospitalEstimate = {
  estimateId: "DEMO-EST-0001",
  hospitalLabel: "Demo Hospital (synthetic)",
  procedureLabel: "Total knee replacement, one knee",
  roomDays: 4,
  roomOptions: [
    { roomId: ROOM_TWIN, label: "Twin-sharing room", ratePerDay: rupees(4_500) },
    { roomId: ROOM_SINGLE, label: "Single private room", ratePerDay: rupees(7_500) },
    { roomId: ROOM_DELUXE, label: "Deluxe room", ratePerDay: rupees(12_000) },
  ],
  items: [
    {
      itemId: "icu",
      label: "ICU, 1 day",
      category: "icu",
      amount: rupees(15_000),
      perDay: { days: 1, ratePerDay: rupees(15_000) },
    },
    { itemId: "nursing", label: "Nursing charges, 4 days", category: "nursing", amount: rupees(4_000) },
    { itemId: "surgeon", label: "Surgeon fees", category: "surgeonFees", amount: rupees(60_000) },
    { itemId: "anaesthetist", label: "Anaesthetist fees", category: "anaesthetistFees", amount: rupees(15_000) },
    { itemId: "ot", label: "Operation theatre charges", category: "operationTheatre", amount: rupees(35_000) },
    { itemId: "implant", label: "Implant (knee prosthesis)", category: "implant", amount: rupees(120_000) },
    { itemId: "pharmacy", label: "Pharmacy and consumables", category: "pharmacyConsumables", amount: rupees(25_000) },
    { itemId: "diagnostics", label: "Diagnostics", category: "diagnostics", amount: rupees(12_000) },
    { itemId: "physio", label: "Physiotherapy", category: "physiotherapy", amount: rupees(6_000) },
    { itemId: "admin", label: "Hospital admin charges", category: "hospitalAdmin", amount: rupees(1_500) },
  ],
  differentialBilling: "notStated",
  provenance: "fixture",
};

export const SCENARIO_TWIN: Scenario = {
  scenarioId: "A",
  label: "Twin-sharing room",
  roomId: ROOM_TWIN,
};

export const SCENARIO_SINGLE: Scenario = {
  scenarioId: "B",
  label: "Single private room",
  roomId: ROOM_SINGLE,
};

export const SCENARIO_DELUXE: Scenario = {
  scenarioId: "B2",
  label: "Deluxe room",
  roomId: ROOM_DELUXE,
};
