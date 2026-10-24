"use client";

import type { Money } from "@/engine/money";
import type { CaseInputs, SimulationResult } from "@/engine/types";
import { type Headline, POLICY_OPTIONS, type PolicyId, type RoomChoice, type Side } from "@/model";
import { Amount, RangeAmount } from "../amounts";
import { IssuerBadge, ProvenanceBadge, StateBadge } from "../badges";
import { issuerLabel, money } from "../format";
import { RoomPicker } from "../room-picker";

interface Props {
  inputs: CaseInputs;
  result: SimulationResult;
  headline: Headline;
  planned: RoomChoice;
  policy: PolicyId;
  onSetPolicy: (policy: PolicyId) => void;
  onSelectRoom: (side: Side, roomId: string) => void;
  onSetRate: (side: Side, rate: Money) => void;
  onOpenTwin: () => void;
  onOpenUncertainty: () => void;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-stone-100 py-2 text-sm first:border-t-0">
      <dt className="text-stone-600">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{children}</dd>
    </div>
  );
}

export function OverviewScreen({ inputs, result, headline, planned, policy, onSetPolicy, onSelectRoom, onSetRate, onOpenTwin, onOpenUncertainty }: Props) {
  const { ruleset, schedule, estimate } = inputs;
  const overallBadge =
    headline.state === "cannotDetermine" ? "unknown" : headline.state === "reviewRequired" ? "reviewRequired" : headline.state;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-stone-500">Scenario overview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Know what your policy might leave you paying before admission.</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
          One policy, one hospital estimate, one planned room. The simulator applies the policy&apos;s own clauses to the estimate and shows the potential deductions it can establish, with the clause beside every number.
        </p>
      </div>

      <section className="rounded-2xl border border-stone-900 bg-stone-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-stone-300">Potential deductions covered by this simulation</h2>
          <StateBadge state={overallBadge} className="ring-0 !bg-white/15 !text-white" />
        </div>
        <p className="mt-3 text-2xl font-semibold leading-snug sm:text-3xl">{headline.summary}</p>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white/10 p-4">
            <dt className="text-xs uppercase tracking-wider text-stone-300">Calculated</dt>
            <dd className="mt-1 text-xl font-semibold">
              {headline.state === "cannotDetermine" || headline.state === "reviewRequired" ? "—" : <Amount paise={headline.calculated} />}
            </dd>
          </div>
          <div className="rounded-lg bg-white/10 p-4">
            <dt className="text-xs uppercase tracking-wider text-stone-300">Conditional</dt>
            <dd className="mt-1 text-xl font-semibold">{headline.conditional ? <RangeAmount range={headline.conditional} /> : "None"}</dd>
          </div>
          <div className="rounded-lg bg-white/10 p-4">
            <dt className="text-xs uppercase tracking-wider text-stone-300">Not classified</dt>
            <dd className="mt-1 text-xl font-semibold">
              {headline.unclassifiedCount > 0 ? (
                <>
                  <Amount paise={headline.unclassified} /> <span className="text-sm font-normal text-stone-300">({headline.unclassifiedCount} items)</span>
                </>
              ) : (
                "None"
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-stone-300">Not your total out-of-pocket cost. Policy terms this version does not model are listed under What remains uncertain.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenTwin}
            className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
          >
            Open Coverage Twin
          </button>
          <button
            type="button"
            onClick={onOpenUncertainty}
            className="inline-flex h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            What remains uncertain ({result.uncertainties.length})
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Policy">
          <label htmlFor="policy-select" className="sr-only">Policy wording</label>
          <select
            id="policy-select"
            value={policy}
            onChange={(e) => onSetPolicy(e.target.value as PolicyId)}
            className="mb-3 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          >
            {POLICY_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <p className="text-base font-semibold text-stone-900">{ruleset.metadata.name}</p>
          <p className="mt-1 text-sm text-stone-600">{issuerLabel(ruleset.metadata.issuer)}</p>
          <div className="mt-3">
            <IssuerBadge issuer={ruleset.metadata.issuer} />
          </div>
          <dl className="mt-4">
            <Row label="Wording version">{ruleset.metadata.wordingVersion}</Row>
            <Row label="Schedule">{schedule ? schedule.scheduleId : <span className="text-rose-700">Missing</span>}</Row>
            <Row label="Sum insured">
              {schedule ? (
                <span className="inline-flex items-center gap-2">
                  <Amount paise={schedule.sumInsured} /> <ProvenanceBadge provenance={schedule.provenance} />
                </span>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Room rent limit">
              {result.roomLimit.eligiblePerDay !== null ? `${money(result.roomLimit.eligiblePerDay)} per day` : <StateBadge state={result.roomLimit.state} />}
            </Row>
            <Row label="ICU limit">
              {result.icuLimit.eligiblePerDay !== null ? `${money(result.icuLimit.eligiblePerDay)} per day` : <StateBadge state={result.icuLimit.state} />}
            </Row>
            <Row label="Co-payment">
              {ruleset.rules.copay ? `${ruleset.rules.copay.percent}% of the admissible amount` : "None in this wording"}
            </Row>
            <Row label="Fixture version">
              <span className="font-mono text-xs">{ruleset.fixtureVersion}</span>
            </Row>
          </dl>
        </Card>

        <Card title="Planned room">
          <RoomPicker
            label="Room category"
            options={estimate.roomOptions}
            choice={planned}
            onSelectRoom={(id) => onSelectRoom("planned", id)}
            onSetRate={(rate) => onSetRate("planned", rate)}
          />
          <dl className="mt-4">
            <Row label="Room days">{result.scenario.roomDays}</Row>
            <Row label="Room rent">
              <Amount paise={result.totals.roomRent} />
            </Row>
            <Row label="Above the limit">
              {result.roomExcess.value !== null ? <Amount paise={result.roomExcess.value} /> : <StateBadge state={result.roomExcess.state} />}
            </Row>
          </dl>
        </Card>

        <Card title="Hospital estimate">
          <p className="text-base font-semibold text-stone-900">{estimate.procedureLabel}</p>
          <p className="mt-1 text-sm text-stone-600">{estimate.hospitalLabel}</p>
          <dl className="mt-4">
            <Row label="Line items">{estimate.items.length + 1}</Row>
            <Row label="Non-room items">
              <Amount paise={result.totals.nonRoomItems} />
            </Row>
            <Row label="Scenario total">
              <Amount paise={result.totals.scenarioTotal} />
            </Row>
            <Row label="Differential billing">
              {inputs.confirmations.hospitalFollowsDifferentialBilling !== undefined
                ? inputs.confirmations.hospitalFollowsDifferentialBilling
                  ? "Yes, confirmed"
                  : "No, confirmed"
                : estimate.differentialBilling === "notStated"
                  ? "Not stated"
                  : estimate.differentialBilling === "yes"
                    ? "Yes"
                    : "No"}
            </Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}
