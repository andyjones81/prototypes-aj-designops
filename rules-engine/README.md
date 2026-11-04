# Rules API Workspace

Open `index.html` directly. The default local simulator evaluates published rules
without an HTTP server. HTTP mode posts JSON to the supplied evaluation endpoint;
that service must allow the browser origin through CORS. Requests time out after
15 seconds. The static JSON files are not an HTTP evaluation backend.

## Catalogue

The catalogue contains 173 imported rules, all published, alongside the eight
original demo rules. `tools/rule-model.json` is the reviewed prototype
applicability model and request parameter catalogue. Original CSV wording is
retained in `conditionsText`; each imported rule has an `applicabilityNote`.

Publication is a prototype state, not confirmation of legal or policy approval.
Ambiguous source conditions are explicitly marked as prototype interpretations.
ORR entries with no source delivery phase retain the Build assumption unless
the rule names a specific assessment phase. Those assumptions need confirmation
from policy and assurance owners before production use.

Rebuild all static files and the browser seed from the CSVs and model:

```sh
python3 rules-engine/tools/build-rules.py
node --test rules-engine/api.test.cjs
```

Run these commands from the repository root. Generation fails if any of the 173
imported rules lacks a reviewed mapping. Tests exercise a satisfying request for
every imported rule, missing inputs, OR alternatives, migration and file parity.

## API Contract

`GET /parameters` returns parameter types, allowed values, descriptions, groups
and rule usage. Parameters cover service scope, delivery stage, users and data,
hosting and technology, suppliers, identity, security activities and risk facts.
The same schema is embedded in the static catalogue under `parameters`.

`POST /evaluate` accepts a JSON object and returns matching rules and actions,
counts, missing parameter names, and a trace for every published rule.

```js
RulesAPI.request(
  "POST",
  "/evaluate",
  JSON.stringify({
    serviceType: "Digital service",
    stage: "Build",
    publicFacing: "Yes",
    personalData: "Yes",
    technology: ["Web application", "Cloud hosting"],
    authentication: "Yes",
  }),
);
```

All `conditions` are ANDed. Every entry in `conditionGroups` is an OR group;
at least one condition in each group must be true. `includes` checks one array
member; `intersects` checks whether any listed member is present.

Omitted inputs are unknown, not false. Explicit `No` and empty arrays are known
negative answers. A false mandatory condition makes a rule `not-matched`; with
no known failure, unresolved inputs make it `missing`. Only `matched` rules
return actions. Evaluation does not create work, actions or trigger history.

Request history stays in the current page session. Existing browser catalogues
are migrated once to the refined model; work, actions and historical versions
are preserved. The collection presets are illustrative test scenarios, not
claims that all obligations have been satisfied.
