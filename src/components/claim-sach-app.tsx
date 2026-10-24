"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { compareScenarios } from "@/engine/compare";
import { evaluate } from "@/engine/evaluate";
import type { Money } from "@/engine/money";
import type { Trace } from "@/engine/types";
import { type Side, buildInputs, groupUncertainties, headlineFor, initialState, reduce, scenarioFor } from "@/model";
import { buildLadder } from "@/model/ladder";
import { evidencePackJson, evidencePackMarkdown } from "@/model/report";
import { downloadText } from "./download";
import { QuestionSheetDialog } from "./question-sheet";
import { CoverageTwinScreen } from "./screens/coverage-twin";
import { InputReviewScreen } from "./screens/input-review";
import { OverviewScreen } from "./screens/overview";
import { UncertaintyScreen } from "./screens/uncertainty";
import { WhyThisChangedScreen } from "./screens/why-this-changed";
import { Shell } from "./shell";
import { TraceDrawer } from "./trace-drawer";

export function ClaimSachApp() {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState());
  const inputs = useMemo(() => buildInputs(state), [state]);
  const planned = useMemo(() => evaluate(inputs, scenarioFor(state, "planned")), [inputs, state]);
  const comparison = useMemo(() => evaluate(inputs, scenarioFor(state, "comparison")), [inputs, state]);
  const cmp = useMemo(() => compareScenarios(comparison, planned), [comparison, planned]);
  const headline = headlineFor(planned);
  const groups = groupUncertainties(planned);
  const ladder = useMemo(() => buildLadder(inputs), [inputs]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const downloadPack = useCallback(
    (kind: "md" | "json") => {
      const stamp = planned.scenario.roomId;
      if (kind === "md") downloadText(`claim-sach-evidence-pack-${stamp}.md`, evidencePackMarkdown(planned, inputs), "text/markdown;charset=utf-8");
      else downloadText(`claim-sach-evidence-pack-${stamp}.json`, evidencePackJson(planned, inputs), "application/json");
    },
    [planned, inputs],
  );

  const openTrace = useCallback((title: string, trace: Trace) => dispatch({ type: "openTrace", title, trace }), []);
  const closeTrace = useCallback(() => dispatch({ type: "closeTrace" }), []);
  const selectRoom = useCallback((side: Side, roomId: string) => dispatch({ type: "selectRoom", side, roomId }), []);
  const setRate = useCallback((side: Side, ratePerDay: Money) => dispatch({ type: "setRate", side, ratePerDay }), []);

  let screen: React.ReactNode;
  switch (state.screen) {
    case "overview":
      screen = (
        <OverviewScreen
          inputs={inputs}
          result={planned}
          headline={headline}
          planned={state.plannedRoom}
          policy={state.policy}
          ladder={ladder}
          onSetPolicy={(p) => dispatch({ type: "setPolicy", policy: p })}
          onDownloadPack={downloadPack}
          onSelectRoom={selectRoom}
          onSetRate={setRate}
          onOpenTwin={() => dispatch({ type: "setScreen", screen: "twin" })}
          onOpenUncertainty={() => dispatch({ type: "setScreen", screen: "uncertainty" })}
        />
      );
      break;
    case "twin":
      screen = (
        <CoverageTwinScreen
          inputs={inputs}
          a={comparison}
          b={planned}
          cmp={cmp}
          choices={{ comparison: state.comparisonRoom, planned: state.plannedRoom }}
          onSelectRoom={selectRoom}
          onSetRate={setRate}
          onOpenTrace={openTrace}
          onOpenWhy={() => dispatch({ type: "setScreen", screen: "why" })}
        />
      );
      break;
    case "why":
      screen = <WhyThisChangedScreen a={comparison} b={planned} cmp={cmp} onOpenTrace={openTrace} onOpenTwin={() => dispatch({ type: "setScreen", screen: "twin" })} />;
      break;
    case "uncertainty":
      screen = <UncertaintyScreen result={planned} groups={groups} onGoToReview={() => dispatch({ type: "setScreen", screen: "review" })} onOpenSheet={() => setSheetOpen(true)} />;
      break;
    case "review":
      screen = <InputReviewScreen state={state} inputs={inputs} result={planned} dispatch={dispatch} />;
      break;
  }

  return (
    <>
      <Shell
        screen={state.screen}
        issuer={planned.policy.issuer}
        uncertaintyCount={planned.uncertainties.length}
        onScreen={(s) => dispatch({ type: "setScreen", screen: s })}
        onReset={() => dispatch({ type: "reset" })}
      >
        {screen}
      </Shell>
      {state.openTrace ? <TraceDrawer title={state.openTrace.title} trace={state.openTrace.trace} onClose={closeTrace} /> : null}
      {sheetOpen ? <QuestionSheetDialog result={planned} onClose={() => setSheetOpen(false)} /> : null}
    </>
  );
}
