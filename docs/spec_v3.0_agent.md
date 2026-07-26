# Spec v3.0 — Agent Layer over the Analysis Tools

## Summary

Goal: let an LLM drive BioDjango's analysis tools. FASTA in, JSON out, cheap enough
to run on a small model.

The premise is right in spirit but not yet true in the code. Today the input is
*not* uniform (two tools reject FASTA outright) and the output is *not* usefully
JSON (two tools return a text blob wrapped in a JSON key). This spec fixes the
tool boundary first, then adds the agent on top of it. The agent is the easy
part; the tool contract is the work.

Three deliverables, in dependency order:

1. **A uniform tool contract** — one input resolver, one result envelope, one
   error-code enum, structured results for BLAST and peptide-calc.
2. **A machine-readable tool catalog** — `GET /api/agent/tools/` returning JSON
   Schema per tool, so the agent's tool definitions are generated, not hand-copied.
3. **The agent itself** — a new `agent` Django app owning `AgentRun`/`AgentStep`,
   running the loop in Celery, calling tool *functions* through a registry.

---

## 1. What has to change first

### 1.1 Input is not uniform

Every async endpoint takes a field called `sequence`, but the four tools mean four
different things by it:

| Endpoint | What `sequence` actually feeds | FASTA accepted? |
|---|---|---|
| `POST /api/analysis/blast/` | written verbatim to a `.fasta`, passed to `blastp -query` | **required** |
| `POST /api/analysis/msa/` | written verbatim to a `.fasta`, passed to `mafft` | **required**, ≥2 records |
| `POST /api/analysis/primer-design/` | `primer3 SEQUENCE_TEMPLATE` | **no** — bare DNA only |
| `POST /api/analysis/antibody-annotation/` | `abnumber.Chain(sequence)` | **no** — bare AA only |
| `POST /api/analysis/sequence-analysis/` | `fasta_file` (multipart) *or* `fasta_content` | FASTA only, different field names |
| `POST /api/analysis/peptide-calc/` | no sequence at all — mass search | n/a |

An agent that uniformly passes FASTA breaks two of the six. `primer3` receives
`>` and newline characters as template bases; `abnumber.Chain` raises. Neither
returns a diagnosable error — primer-design surfaces as "no suitable primers
found", which reads to a model as a legitimate negative result. This is the
single most important thing to fix: a silently wrong answer is worse than a 400.

### 1.2 Output is JSON only in the transport sense

| Tool | Current `result` | Agent-usable? |
|---|---|---|
| BLAST | `{"output": "<blastp format-0 pairwise text>"}` | **No** — unstructured, unbounded (multi-MB) |
| MSA | `{"output": "<clustal text>"}` | Partly — the alignment text *is* the artifact, but there's no summary to reason over |
| PEPTIDE_CALC | `{"csv_content": "<csv string>"}` | **No** — CSV inside JSON, unbounded |
| PRIMER_DESIGN | `{"primers": [ {...} ]}` | Yes, already good |
| ANTIBODY_ANNOTATION | `{"status", "chain_type", "regions", "numbering", "scheme"}` | Mostly — `numbering` is ~120 keys of noise |
| SEQUENCE_ANALYSIS | `{"sequences": [...], "total_summary": {...}}` | Yes, but returns 200 inline, not a task |

`backend/analysis/tasks.py:63` builds the BLAST command with no `-outfmt`, so
it gets format 0 — the verbose pairwise alignment view. A default SwissProt
search easily produces hundreds of KB. Handing that to a model costs tens of
thousands of tokens and it will still misread the E-values.

`backend/analysis/utils/__init__.py:22` iterates `product(20, repeat=n)` and
`PeptideCalcSerializer` allows `num_amino_acids` up to 20 — that is 20²⁰ ≈ 10²⁶
combinations. Every call above ~5 residues dies on `soft_time_limit`. The function
also builds a perfectly good `results` list (line 27) and then throws it away in
favour of the CSV string.

### 1.3 Structural gaps

- **No unified envelope.** Five tools return 202 + a task row; `sequence-analysis`
  returns 200 + the result. Two calling conventions means two code paths in the
  agent for no reason.
- **No tool catalog.** No OpenAPI schema (`drf-spectacular` is not installed), so
  tool definitions would have to be hand-maintained in two places and drift.
- **`AnalysisTask` has no owner.** `backend/analysis/models.py:4` has no `owner`
  FK, and `AnalysisTaskRetrieveView` uses `AnalysisTask.objects.all()` with only
  `IsAuthenticated`. Any authenticated user can read any task result by UUID, and
  there is no way to list "this run's tasks". The agent will multiply task volume
  by 5–10×, so fix this before, not after.
- **No DNA sequence store.** `validate_fasta` accepts only
  `ACDEFGHIKLMNPQRSTVWY*` and the only model is `ProteinSequence`. Primer design
  needs DNA, so it cannot use stored-sequence references — it must take inline
  text until a `NucleotideSequence` model exists. Scope call for you (see §9).
- **Auth is awkward for a machine caller.** 60-minute access tokens with
  `ROTATE_REFRESH_TOKENS: True`. Note `rest_framework_simplejwt.token_blacklist`
  is not in `INSTALLED_APPS`, so `BLACKLIST_AFTER_ROTATION: True` is currently
  inert — worth knowing either way.

---

## 2. Target contract

### 2.1 One input shape, resolved per tool

New `core/fasta.py` exposing a resolver. Every tool declares its arity and
alphabet; the resolver produces exactly what the underlying library wants.

```python
@dataclass(frozen=True)
class ResolvedInput:
    records: list[SeqRecord]      # parsed, validated
    fasta: str                    # re-serialised FASTA (for blastp / mafft)
    bare: str                     # records[0].seq as a plain string (primer3 / abnumber)
    summary: dict                 # {"n_sequences", "ids", "alphabet", "lengths"}
```

The agent-facing payload accepts three mutually exclusive forms:

```json
{"fasta": ">sp|P69905\nMVLSPADKTN..."}
{"sequence_id": "3f2a...c1"}
{"project_id": "9b7e...44", "sequence_ids": ["3f2a...c1", "8d10...9f"]}
```

`sequence_id` / `project_id` are the preferred form and matter more than they
look: they keep multi-kilobyte sequences out of the model's context entirely.
On a three-tool run over a 500-residue protein this is roughly a 10× reduction
in input tokens.

Per-tool declarations:

| Tool | arity | alphabet | resolver output used |
|---|---|---|---|
| `blast_search` | `single` | protein | `fasta` |
| `align_sequences` | `multi` (≥2, ≤200) | protein | `fasta` |
| `annotate_antibody` | `single` | protein | `bare` |
| `design_primers` | `single` | dna | `bare` |
| `summarize_sequences` | `multi` (≥1) | protein | `records` |
| `find_peptides_by_mass` | — | — | — (mass search, no sequence) |

Arity and alphabet violations become `TOO_MANY_SEQUENCES` / `WRONG_ALPHABET`
*before* dispatch, with a hint naming the fix. That converts today's silent
mis-design into a recoverable error the model can act on.

### 2.2 One result envelope

Every tool, sync or async, resolves to:

```json
{
  "tool": "blast_search",
  "task_id": "0f9c...ab",
  "status": "SUCCESS",
  "input_summary": {"n_sequences": 1, "ids": ["sp|P69905"], "alphabet": "protein"},
  "params": {"database": "swissprot", "evalue": 1e-6, "max_hits": 25},
  "data": { "...tool-specific..." },
  "warnings": [],
  "truncated": false,
  "error": null
}
```

On failure, `data` is `null` and `error` is populated. `params` is echoed back
*normalized* (after server-side defaults) so the model can see what actually ran
rather than what it asked for.

`sequence-analysis` moves onto the task machinery so the calling convention is
uniform. It can complete eagerly and return `status: "SUCCESS"` with `data`
already filled in on the same response — the agent's code path doesn't branch,
it just polls only when `status` is `PENDING`/`STARTED`.

### 2.3 Error codes, not stderr

```
INVALID_FASTA        EMPTY_INPUT          WRONG_ALPHABET
TOO_MANY_SEQUENCES   TOO_FEW_SEQUENCES    SEQUENCE_TOO_LONG
NO_RESULTS           TIMEOUT              QUEUE_UNAVAILABLE
TOOL_ERROR           NOT_FOUND            FORBIDDEN
```

```json
{"error": {
  "code": "TOO_MANY_SEQUENCES",
  "message": "annotate_antibody accepts one chain; received 3.",
  "hint": "Call annotate_antibody once per chain, or pass sequence_id for a single record."
}}
```

The `hint` field is doing real work here. A small model cannot reliably recover
from a raw `blastp` stderr dump; it *can* reliably follow a sentence that names
the next action. Every error path must populate it.

### 2.4 Structured results

**`blast_search`** — switch to tabular output with named columns and a hit cap:

```
blastp -query q.fasta -db <db> -evalue <e> -num_threads N \
       -max_target_seqs <max_hits> \
       -outfmt "6 qseqid sseqid stitle pident length evalue bitscore qstart qend qlen"
```

```json
{"data": {
  "hits": [{
    "query_id": "sp|P69905", "subject_id": "sp|P69905.2",
    "description": "Hemoglobin subunit alpha OS=Homo sapiens",
    "percent_identity": 100.0, "alignment_length": 142,
    "evalue": 3.1e-102, "bit_score": 291.0, "query_coverage": 100.0
  }],
  "hit_count": 25, "database": "swissprot", "evalue_cutoff": 1e-6
}, "truncated": true}
```

`query_coverage` is computed server-side from `qstart`/`qend`/`qlen`. Never make
the model do arithmetic on tool output — it is the cheapest place to lose
accuracy. Keep `output` alongside `hits` for one release so the existing
frontend keeps working, marked deprecated.

**`find_peptides_by_mass`** — return the list the function already builds, capped:

```json
{"data": {
  "peptides": [{"sequence": "GAVLIP", "mass": 555.67, "delta": 0.03}],
  "returned": 500, "total_found": 1841, "search_space": 64000000
}, "truncated": true}
```

Also drop `num_amino_acids` max from 20 to **6** (20⁶ = 64M, already at the edge
of the 120 s limit) and add `max_results` (default 500, hard cap 5000). Keep the
CSV as a derived download from the structured list, not the primary payload.

**`annotate_antibody`** — `numbering` behind `include_numbering` (default
`false`), and add the fields agents actually reason about:

```json
{"data": {
  "chain_type": "H", "scheme": "imgt",
  "regions": {"FR1": "...", "CDR1": "...", "...": "..."},
  "cdr_lengths": {"CDR1": 8, "CDR2": 8, "CDR3": 13}
}}
```

**`align_sequences`** — keep the Clustal text, add a bounded summary so the model
has something cheap to reason over: `n_sequences`, `alignment_length`,
`per_sequence: [{id, gaps, identity_to_consensus}]`.

**`design_primers`** — already well-shaped. Move the `{"error": ...}` return into
the envelope's `error` with code `NO_RESULTS`, carrying `PRIMER_LEFT_EXPLAIN` as
the hint.

---

## 3. The tool catalog

```
GET  /api/agent/tools/            → [{name, description, input_schema, ...}]
POST /api/agent/tools/<name>/     → envelope (202 or 200)
GET  /api/analysis/tasks/<id>/result/   → envelope   (existing endpoint, rewrapped)
```

Single source of truth is a registry in `analysis/tools.py`:

```python
@register_tool
class BlastSearch(Tool):
    name = "blast_search"
    description = (
        "Search a protein sequence against a reference database with BLASTP. "
        "Call this when the user asks what an unknown protein is, what it is "
        "similar to, or to identify a sequence. Returns ranked hits with "
        "percent identity and E-value."
    )
    arity, alphabet = "single", "protein"
    input_schema = {...}          # JSON Schema, flat, enums for fixed sets
    celery_task = run_blast_task
```

The catalog endpoint serialises the registry; the agent's tool definitions are
generated from it. One place to change, no drift between the API and the model's
view of it.

---

## 4. Where the agent lives

Three options; recommending the second.

| | Approach | Verdict |
|---|---|---|
| A | Separate process, calls the REST API as a client | Works, but the agent needs its own credentials and re-authenticates against your own backend for every step |
| B | **New `agent` Django app, loop in Celery, tools called as functions** | **Recommended** |
| C | Loop in the React app | No — puts the LLM key in the browser |

**B** in detail:

```
agent/models.py    AgentRun(user, project, status, prompt, final_answer, usage)
                   AgentStep(run, index, tool_name, params, envelope, tokens)
agent/tools.py     registry → Anthropic tool definitions
agent/runner.py    the loop
agent/tasks.py     run_agent_task  (queue: "agent")
agent/views.py     POST /api/agent/runs/  ·  GET /api/agent/runs/<id>/
```

Why B:

- **Reuses the task infrastructure you just unified in v3 phase C.** No new
  moving parts.
- **Audit comes free.** `_dispatch` already emits a `SUBMIT` row per task
  (`analysis/views.py:75`); add `AuditMixin` to `AgentRunViewSet` and "who ran
  which agent over which project" is answerable from the existing audit log.
- **No credential round-trip.** The runner holds `AgentRun.user` and the resolver
  enforces the same `HasProjectAccess` check the ViewSets use. The model never
  sees a JWT.
- **The frontend needs nothing new.** `useTaskPolling` works unchanged — an
  `AgentRun` polls exactly like an `AnalysisTask`.

**The trade-off, stated plainly:** if the loop calls tool functions synchronously
inside one Celery task, a 5-minute BLAST blocks that worker for 5 minutes. For v1
that is acceptable *provided* the agent gets its own queue (`-Q agent`) so it
cannot starve the interactive one. The clean fix is dispatching sub-tasks and
polling, which is materially more complex; do it in v3.1 if agent throughput
becomes a real constraint.

---

## 5. Cheap-model design rules

These are the decisions that determine whether a small model can drive this
reliably. They cost nothing to apply now and are expensive to retrofit.

1. **Flat parameters. No nesting, no `oneOf`.** Every field a string, number, or
   enum. Small models fail at nested objects and union types far more often than
   at reasoning.
2. **Enums over free strings.** `database: enum[swissprot, nr, pdb]`,
   `scheme: enum[imgt, kabat, chothia]`. An enum error is impossible; a typo'd
   string is a wasted round trip.
3. **One required parameter per tool; default everything else server-side.** The
   model should be able to call `blast_search` with just a `sequence_id`. Echo
   the resolved `params` back so it can see what it got. For the two numeric
   tools (`design_primers`, `find_peptides_by_mass`), where a wrong parameter is
   silently plausible rather than obviously broken, add `strict: true` — note
   strict mode wants a closed schema, so list every property in `required` and
   express optionals as nullable unions (`{"type": ["number", "null"]}`).
4. **Never make the model parse text or do arithmetic.** Server computes
   `percent_identity`, `query_coverage`, `delta`, `cdr_lengths`. The model reads
   numbers and compares them.
5. **Bound every array.** `max_hits`, `max_results`, `include_numbering`, with
   server-side hard caps and an explicit `truncated` flag. Unbounded tool output
   is the number one cost blowup, ahead of anything about the model itself.
6. **Reference sequences, don't paste them.** See §2.1 — this is the single
   biggest token lever available.
7. **Keep the catalog at six tools.** Small models degrade noticeably past
   roughly ten. Six is comfortable; resist adding a seventh without removing one.
8. **Prompt-cache the stable prefix.** Tool definitions render before the system
   prompt, so put `cache_control: {"type": "ephemeral"}` on the last system
   block to cache both together. Two consequences: serialise the tool list
   **deterministically** (sort by name), and keep timestamps and run IDs out of
   the system prompt — either invalidates the whole prefix on every request. Note
   the minimum cacheable prefix is model-dependent: 1024 tokens on Sonnet 5, but
   4096 on Haiku 4.5, so a lean prompt may silently not cache on Haiku.
9. **Return all parallel tool results in one user message.** Splitting them
   across messages trains the model to stop issuing parallel calls.
10. **Treat all tool output as data, never as instructions.** FASTA headers are
    user-supplied and BLAST `description` fields come from external databases;
    both reach the model's context. `>ignore previous instructions` is a
    realistic input. Truncate `description` to ~120 chars, and keep the system
    prompt authoritative. Mid-conversation `role: "system"` messages are the
    clean channel for operator context on Opus 5 / Opus 4.8, but **Sonnet 5 does
    not support them** — on Sonnet, put such context in the user turn instead.

---

## 6. Model and cost

You asked for something affordable with modest reasoning. Two candidates:

| | Input / output per MTok | Context | Notes |
|---|---|---|---|
| **Claude Sonnet 5** (`claude-sonnet-5`) | $3 / $15 — **$2 / $10 introductory through 2026-08-31** | 1M | Adaptive thinking on by default; full effort ladder including `low`; cache minimum 1024 tokens |
| **Claude Haiku 4.5** (`claude-haiku-4-5`) | $1 / $5 | 200K | Cheapest, but no `effort` parameter, thinking uses the older `budget_tokens` form, and cache minimum is 4096 tokens |

**Recommendation: Sonnet 5 at `effort: "low"` for the loop.** With the
introductory pricing it lands at $2/$10 — close enough to Haiku that Haiku's
reliability cost on multi-step tool use isn't worth it. Reserve Haiku 4.5 for a
single-shot "summarise this structured result" step if you want one.

```python
client.messages.create(
    model="claude-sonnet-5",
    max_tokens=8192,
    thinking={"type": "adaptive"},
    output_config={"effort": "low"},   # low | medium | high
    tools=catalog_as_tool_definitions(),
    system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
    messages=messages,
)
```

Two notes on the thinking config:

- **Leave adaptive thinking on rather than disabling it.** Sonnet 5 with thinking
  disabled is measurably *less* willing to reach for tools, which is the opposite
  of what an agent needs. `effort: "low"` is the right lever for "reasonable
  amount of reasoning"; `thinking: {"type": "disabled"}` is not.
- `budget_tokens` is removed on Sonnet 5 and returns a 400. Use `effort`.

Use the SDK's tool runner (`client.beta.messages.tool_runner` with `@beta_tool`)
rather than hand-writing the loop — it gives you per-turn hooks for the approval
gate and step logging without owning the control flow. Cap it with
`max_iterations` (start at 8).

**Rough cost per run**, assuming `sequence_id` references, three tool calls, and
a warm cache: ~15–25k input / ~2k output → **on the order of $0.05** at the
introductory rate. Treat that as an estimate to validate, not a number to quote
— it moves with prompt size and hit counts. `python-json-logger` is already
wired up, so log `usage.input_tokens`, `usage.output_tokens`, and
`usage.cache_read_input_tokens` per step from day one and measure it.

---

## 7. Phased plan

Each phase is a standalone commit and independently shippable.

**Phase 1 — tool contract (no agent yet).**
`core/fasta.py` resolver; `analysis/tools.py` registry with the six tools;
result envelope + error-code enum; `sequence-analysis` moved onto the task
machinery. Existing endpoints keep their current response shape by wrapping the
envelope, so the frontend is untouched.

**Phase 2 — structured results.**
BLAST `-outfmt 6` + parser + `max_hits`; peptide-calc list + caps +
`num_amino_acids` ceiling; antibody `include_numbering`; MSA summary fields.
Frontend `BlastResult` / `PeptideCalcResult` types updated; `output` and
`csv_content` retained and marked deprecated.

**Phase 3 — access control.**
`AnalysisTask.owner` + nullable `project` FK, migration, queryset filtering on
both task views. Prerequisite for phase 5.

**Phase 4 — catalog endpoint.**
`GET /api/agent/tools/`, `POST /api/agent/tools/<name>/`. At this point an
external agent (or an MCP server) can drive the app with no LLM code in the repo
at all — a useful checkpoint to validate the contract before committing to the
loop.

**Phase 5 — the agent.**
`agent` app, `AgentRun`/`AgentStep`, Celery loop on its own queue, `anthropic`
added to `requirements.txt`, `ANTHROPIC_API_KEY` in settings with the same
`ImproperlyConfigured` guard pattern as `SECRET_KEY`. Per-user run throttle
(new scope, e.g. `agent: 20/hour`) — an agent run is 5–10× the cost of a tool
call and the existing `user: 120/min` does not bound spend.

**Phase 6 — frontend.**
Chat-style run view reusing `useTaskPolling`, step timeline from `AgentStep`,
per-run token/cost readout.

---

## 8. Non-goals for v3.0

- Streaming the agent's tokens to the browser (needs SSE or WebSockets; poll first)
- Sub-task dispatch from inside the loop (see the §4 trade-off)
- MCP server exposure — phase 4 makes it easy later, but it is not this spec
- `NucleotideSequence` model (see §9)
- Multi-agent / sub-agent delegation

## 9. Decisions I'd like from you

1. **DNA storage.** `design_primers` needs DNA and there is no DNA model — the
   store is protein-only by validation. Options: (a) `design_primers` takes
   inline `fasta` text only, no `sequence_id` support (cheapest, and what phase 1
   assumes); (b) add a `NucleotideSequence` model in phase 1 (correct, ~half a
   phase of work). I've written the spec for (a) and flagged every place it
   shows.
2. **`num_amino_acids` ceiling.** Dropping the max from 20 to 6 is technically a
   breaking API change, though every value above ~5 currently times out, so no
   working call is affected. Confirm you're happy calling that a fix.
3. **BLAST `output` retention.** Keeping the raw pairwise text alongside `hits`
   for one release is safe but doubles the stored result size on the biggest
   tool. Drop it immediately instead?
