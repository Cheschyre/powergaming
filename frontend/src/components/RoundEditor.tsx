import { newOncePerTurn, roundProblem, type Round } from "../attacks";
import AttackListEditor from "./AttackListEditor";
import CheckboxField from "./CheckboxField";
import OncePerTurnEditor from "./OncePerTurnEditor";

interface RoundEditorProps {
  round: Round;
  onChange: (round: Round) => void;
}

/**
 * A whole round: the attack rows plus optional once-per-turn damage (Sneak
 * Attack and similar), added to the first eligible attack that hits.
 */
export default function RoundEditor({ round, onChange }: RoundEditorProps) {
  const { attacks, once_per_turn } = round;
  const problem = roundProblem(round);

  function toggleOncePerTurn(on: boolean) {
    if (!on) {
      onChange({ attacks, once_per_turn: null });
      return;
    }
    // Start with every attack eligible if none is yet -- the common case
    // (all finesse/ranged); untick the ones that don't qualify.
    const anyEligible = attacks.some((a) => a.once_per_turn_eligible);
    onChange({
      attacks: anyEligible ? attacks : attacks.map((a) => ({ ...a, once_per_turn_eligible: true })),
      once_per_turn: newOncePerTurn(),
    });
  }

  return (
    <>
      <AttackListEditor
        attacks={attacks}
        onChange={(next) => onChange({ attacks: next, once_per_turn })}
        oncePerTurnName={once_per_turn?.name}
      />
      <fieldset className="once-per-turn" aria-label="Once-per-turn damage">
        <CheckboxField
          label="Once-per-turn extra damage (Sneak Attack and similar)"
          checked={once_per_turn !== null}
          onChange={toggleOncePerTurn}
        />
        {once_per_turn && (
          <>
            <p className="hint">
              Added once, to the first eligible attack that hits (its dice double on a crit).
            </p>
            <OncePerTurnEditor
              value={once_per_turn}
              onChange={(next) => onChange({ attacks, once_per_turn: next })}
            />
          </>
        )}
        {problem && <p className="error">{problem}</p>}
      </fieldset>
    </>
  );
}
