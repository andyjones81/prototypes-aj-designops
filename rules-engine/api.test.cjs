const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('all imported rules are published with explicit reviewed applicability', () => {
    const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'api/rules.json'), 'utf8'));
    assert.equal(catalogue.rules.length, 173);
    assert.equal(catalogue.meta.draft, 0);
    catalogue.rules.forEach((rule) => {
        assert.equal(rule.status, 'Published', rule.id);
        assert.equal(rule.enabled, true, rule.id);
        assert.ok(rule.conditions.length, rule.id);
        assert.ok(rule.applicabilityNote, rule.id);
    });
});

test('static catalogue, individual files and browser seed share the same model', () => {
    const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'api/rules.json'), 'utf8'));
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'api/rules-seed.js'), 'utf8'), context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.RULES_SEED)), catalogue.rules);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.RULES_MODEL)), catalogue.parameters);
    for (const rule of catalogue.rules) {
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname, 'api/rules', rule.id + '.json'), 'utf8')), rule);
        for (const condition of rule.conditions.concat(...rule.conditionGroups)) assert.ok(catalogue.parameters.fields[condition.field], rule.id + ': ' + condition.field);
        assert.equal(rule.versions[0].snap.version, 1);
    }
});

function createAPI(saved) {
    let stored = saved;
    const context = {
        window: { addEventListener() { } },
        document: { addEventListener() { } },
        localStorage: {
            getItem() { return stored || null; },
            setItem(key, value) { stored = value; }
        },
        URL,
        URLSearchParams
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'api/rules-seed.js'), 'utf8'), context);
    const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    vm.runInContext(source.replace(/\brender\(\);\s*\}\)\(\);/, '})();'), context);
    return {
        request(method, endpoint, body) {
            return JSON.parse(JSON.stringify(context.window.RulesAPI.request(method, endpoint, body)));
        },
        saved() { return stored; }
    };
}

test('returns published matching rules and actions without changing stored data', () => {
    const api = createAPI();
    const before = api.saved();
    const published = api.request('GET', '/rules?status=Published').body.rules;
    const result = api.request('POST', '/evaluate', JSON.stringify({ stage: 'Build', channel: ['Online'], personalData: 'Yes' }));
    assert.equal(result.status, 200);
    assert.ok(result.body.matched.length > 0);
    assert.equal(result.body.rulesEvaluated, published.length);
    assert.ok(result.body.matched.every((rule) => published.some((candidate) => candidate.id === rule.id)));
    assert.equal(result.body.actionCount, result.body.matched.reduce((count, rule) => count + rule.actions.length, 0));
    assert.deepEqual(result.body.work, { stage: 'Build', channel: ['Online'], personalData: 'Yes' });
    assert.equal(api.saved(), before);
});

test('rejects invalid JSON, request shapes, unknown names and invalid parameter values', () => {
    const api = createAPI();
    const invalid = ['{', 'null', '[]', '1', '"text"', '{"__proto__":{}}', '{"constructor":"Build"}',
        ...[{ stage: 'Unknown' }, { typo: 'Build' }, { channel: 'Online' }, { channel: ['Unknown'] },
        { estTransactions: -1 }, { estTransactions: 1.5 }, { estTransactions: false }, { personalData: true },
        { risk: null }, { title: 10 }].map((body) => JSON.stringify(body))];
    invalid.forEach((body) => assert.equal(api.request('POST', '/evaluate', body).status, 400, body));
});

test('does not match missing numeric or negative-comparison parameters', () => {
    const state = JSON.parse(createAPI().saved());
    const base = state.rules[0];
    state.rules = [
        { ...base, id: 'TEST-1', status: 'Published', enabled: true, conditions: [{ field: 'estTransactions', op: 'gte', value: '0' }] },
        { ...base, id: 'TEST-2', status: 'Published', enabled: true, conditions: [{ field: 'stage', op: 'isnot', value: 'Build' }] },
        { ...base, id: 'TEST-3', status: 'Published', enabled: true, conditions: [{ field: 'personalData', op: 'is', value: 'No' }] }
    ];
    const api = createAPI(JSON.stringify(state));
    assert.equal(api.request('POST', '/evaluate', '{}').body.matched.length, 0);
    assert.deepEqual(api.request('POST', '/evaluate', '{}').body.work, {});
    const result = api.request('POST', '/evaluate', JSON.stringify({ estTransactions: 0, stage: 'Idea', personalData: 'No' }));
    assert.equal(result.body.matched.length, 3);
});

test('every published imported rule has a satisfiable request and a missing-input trace', () => {
    const api = createAPI();
    const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'api/rules.json'), 'utf8'));
    const schema = api.request('GET', '/parameters').body.fields;
    for (const rule of catalogue.rules) {
        const input = {};
        const satisfy = (condition) => {
            assert.ok(schema[condition.field], rule.id + ': ' + condition.field);
            if (condition.op === 'includes') input[condition.field] = [...new Set([...(input[condition.field] || []), condition.value])];
            else if (condition.op === 'intersects') input[condition.field] = [...new Set([...(input[condition.field] || []), condition.value[0]])];
            else input[condition.field] = condition.op === 'in' ? condition.value[0] : condition.value;
        };
        rule.conditions.forEach(satisfy);
        (rule.conditionGroups || []).forEach((group) => satisfy(group[0]));
        const result = api.request('POST', '/evaluate', JSON.stringify(input));
        assert.equal(result.status, 200, rule.id);
        assert.ok(result.body.matched.some((match) => match.id === rule.id), rule.id + ' cannot be satisfied');
        const trace = result.body.trace.find((entry) => entry.id === rule.id);
        assert.equal(trace.result, 'matched', rule.id);
        delete input.serviceType;
        const incomplete = api.request('POST', '/evaluate', JSON.stringify(input)).body;
        assert.equal(incomplete.trace.find((entry) => entry.id === rule.id).result, 'missing', rule.id);
        assert.ok(!incomplete.matched.some((match) => match.id === rule.id), rule.id);
    }
});

test('OR alternatives distinguish missing inputs, known false values and matches', () => {
    const api = createAPI();
    const request = (input) => api.request('POST', '/evaluate', JSON.stringify(input)).body.trace.find((entry) => entry.id === 'RUL-159');
    const input = { serviceType: 'Digital service', publicFacing: 'Yes', personalData: 'No', dataTypes: [], authentication: 'No', technology: [], criticalService: 'No' };
    assert.equal(request(input).result, 'not-matched');
    delete input.technology;
    assert.equal(request(input).result, 'missing');
    input.authentication = 'Yes';
    assert.equal(request(input).result, 'matched');
    input.publicFacing = 'No';
    assert.equal(request(input).result, 'not-matched');
});

test('existing stored drafts migrate once while preserving actions and rule history', () => {
    const state = JSON.parse(createAPI().saved());
    delete state.catalogueVersion;
    const rule = state.rules.find((entry) => entry.id === 'RUL-159');
    rule.status = 'Draft';
    rule.enabled = false;
    rule.modelVersion = 1;
    const beforeActions = JSON.stringify(state.actions), beforeVersions = rule.versions.length;
    const api = createAPI(JSON.stringify(state));
    const migrated = JSON.parse(api.saved());
    const updated = migrated.rules.find((entry) => entry.id === rule.id);
    assert.equal(updated.status, 'Published');
    assert.equal(updated.versions.length, beforeVersions + 1);
    assert.equal(JSON.stringify(migrated.actions), beforeActions);
    const reloaded = JSON.parse(createAPI(api.saved()).saved());
    assert.equal(reloaded.rules.find((entry) => entry.id === rule.id).versions.length, updated.versions.length);
});