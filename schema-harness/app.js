(function () {
  "use strict";

  const TYPES = SCHEMA_TYPES;
  const DEFAULT_TYPE = "Work";
  const THING_PROPS = ["name", "alternateName", "identifier", "description", "url"];
  const NS = {
    schema: "https://schema.org/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    fs: "https://firestarter.example/schema#"
  };
  const SOURCE_LABELS = { blueprint: "Blueprint", proposed: "Proposed", implied: "Implied" };
  const PRIORITY_LABELS = { high: "High", medium: "Medium" };

  const byId = new Map(TYPES.map((t) => [t.id, t]));

  const el = {
    search: document.getElementById("search"),
    group: document.getElementById("group-filter"),
    cls: document.getElementById("class-filter"),
    gaps: document.getElementById("gaps-only"),
    count: document.getElementById("count"),
    list: document.getElementById("type-list"),
    main: document.getElementById("main"),
    modeButtons: document.querySelectorAll("[data-mode]")
  };

  let listMode = "types";
  let currentTab = "schema";

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function isSchemaRef(ref) {
    return ref.startsWith("schema:");
  }

  function groupName(n) {
    const g = SCHEMA_GROUPS.find((x) => x.n === n);
    return g ? g.name : "";
  }

  // Firestarter ancestors, nearest first. Stops at the first schema.org parent.
  function lineage(t) {
    const out = [];
    let cur = t;
    while (cur && !isSchemaRef(cur.parent)) {
      cur = byId.get(cur.parent);
      if (cur) out.push(cur);
    }
    return out;
  }

  function schemaRoot(t) {
    const lin = lineage(t);
    return (lin.length ? lin[lin.length - 1] : t).parent;
  }

  // Own properties first, then inherited from Firestarter ancestors, then the schema:Thing base.
  function effectiveProps(t) {
    const seen = new Map();
    for (const owner of [t, ...lineage(t)]) {
      for (const p of owner.props) {
        if (!seen.has(p)) seen.set(p, { name: p, definedOn: owner.id, inherited: owner !== t });
      }
    }
    for (const p of THING_PROPS) {
      if (!seen.has(p)) seen.set(p, { name: p, definedOn: "schema:Thing", inherited: true });
    }
    return [...seen.values()];
  }

  function domainsOf(propName) {
    const domains = TYPES.filter((t) => t.props.includes(propName)).map((t) => t.id);
    if (THING_PROPS.includes(propName)) domains.push("schema:Thing");
    return domains;
  }

  function subtypesOf(t) {
    return TYPES.filter((x) => x.parent === t.id);
  }

  function rangeOf(propName) {
    const p = PROPERTIES[propName];
    return p ? p.range : [];
  }

  function refLink(ref) {
    if (isSchemaRef(ref)) return `<span class="ext">${esc(ref)}</span>`;
    return `<a href="#type/${encodeURIComponent(ref)}">${esc(ref)}</a>`;
  }

  // Range entries may be Firestarter type ids or bare schema.org type names.
  function rangeHtml(propName) {
    return rangeOf(propName)
      .map((r) => (byId.has(r) ? refLink(r) : `<span class="ext">schema:${esc(r)}</span>`))
      .join(" or ");
  }

  function propLink(name) {
    return `<a href="#prop/${encodeURIComponent(name)}">${esc(name)}</a>`;
  }

  function badges(t) {
    let html = "";
    if (t.priority) html += `<span class="badge prio-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>`;
    html += `<span class="badge src-${t.source}">${SOURCE_LABELS[t.source]}</span>`;
    return html;
  }

  function matchesType(t, q) {
    return (
      t.id.toLowerCase().includes(q) ||
      t.comment.toLowerCase().includes(q) ||
      t.parent.toLowerCase().includes(q) ||
      t.props.some((p) => p.toLowerCase().includes(q))
    );
  }

  function renderSidebar() {
    const q = el.search.value.trim().toLowerCase();
    el.modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === listMode));
    const route = parseRoute();

    if (listMode === "props") {
      const names = Object.keys(PROPERTIES).filter((n) => {
        if (!q) return true;
        return n.toLowerCase().includes(q) || PROPERTIES[n].description.toLowerCase().includes(q);
      });
      el.count.textContent = `${names.length} of ${Object.keys(PROPERTIES).length} properties`;
      const fsNames = names.filter((n) => n.startsWith("fs:"));
      const schemaNames = names.filter((n) => !n.startsWith("fs:"));
      const item = (n) =>
        `<a class="type-link${route.kind === "prop" && route.value === n ? " active" : ""}" href="#prop/${encodeURIComponent(n)}"><span>${esc(n)}</span></a>`;
      let html = "";
      if (schemaNames.length) html += `<div class="group-head">schema.org properties</div>` + schemaNames.map(item).join("");
      if (fsNames.length) html += `<div class="group-head">Firestarter properties</div>` + fsNames.map(item).join("");
      el.list.innerHTML = html || `<p class="empty">No properties match.</p>`;
      return;
    }

    const g = el.group.value;
    const c = el.cls.value;
    const gapsOnly = el.gaps.checked;
    const list = TYPES.filter(
      (t) =>
        (!g || String(t.group) === g) &&
        (!c || t.classification === c) &&
        (!gapsOnly || t.priority) &&
        (!q || matchesType(t, q))
    );
    el.count.textContent = `${list.length} of ${TYPES.length} types`;

    let html = "";
    for (const grp of SCHEMA_GROUPS) {
      const items = list.filter((t) => t.group === grp.n);
      if (!items.length) continue;
      html += `<div class="group-head">${grp.n}. ${esc(grp.name)}</div>`;
      for (const t of items) {
        const active = route.kind === "type" && route.value === t.id ? " active" : "";
        html += `<a class="type-link${active}" href="#type/${encodeURIComponent(t.id)}"><span class="type-name">${esc(t.id)}</span><span class="badges">${badges(t)}</span></a>`;
      }
    }
    el.list.innerHTML = html || `<p class="empty">No types match these filters.</p>`;
  }

  function renderTypeHeader(t) {
    const lin = lineage(t);
    const chain = [schemaRoot(t), ...lin.slice().reverse().map((x) => x.id), t.id];
    const hierarchy = chain.map((ref, i) => (i === chain.length - 1 ? `<strong>${esc(ref)}</strong>` : refLink(ref))).join(" › ");
    return `
      <header class="type-head">
        <p class="eyebrow">${esc(groupName(t.group))}</p>
        <h1>${esc(t.id)}</h1>
        <p class="lede">${esc(t.comment)}</p>
        <dl class="facts">
          <dt>Parent</dt><dd>${refLink(t.parent)}</dd>
          <dt>Hierarchy</dt><dd class="hierarchy">${hierarchy}</dd>
          <dt>Classification</dt><dd>${esc(t.classification)} <span class="muted">(${esc(SCHEMA_CLASSES[t.classification])})</span></dd>
          <dt>Source</dt><dd>${esc(SOURCE_LABELS[t.source])}</dd>
          <dt>Priority gap</dt><dd>${t.priority ? esc(PRIORITY_LABELS[t.priority]) : '<span class="muted">None</span>'}</dd>
        </dl>
      </header>`;
  }

  function renderSchemaTab(t) {
    const subs = subtypesOf(t);
    const subHtml = subs.length
      ? `<ul class="inline">${subs.map((s) => `<li>${refLink(s.id)}</li>`).join("")}</ul>`
      : '<p class="muted">No subtypes in this model.</p>';

    const rows = effectiveProps(t)
      .map((p) => {
        const range = rangeHtml(p.name);
        const definedOn = p.definedOn.startsWith("schema:")
          ? `<span class="ext">${esc(p.definedOn)}</span>`
          : refLink(p.definedOn);
        return `<tr>
          <td>${propLink(p.name)}</td>
          <td>${range}</td>
          <td>${definedOn}${p.inherited ? ' <span class="badge inherited">inherited</span>' : ""}</td>
          <td>${esc(PROPERTIES[p.name] ? PROPERTIES[p.name].description : "")}</td>
        </tr>`;
      })
      .join("");

    return `
      <section>
        <h2>Subtypes</h2>
        ${subHtml}
      </section>
      <section>
        <h2>Properties <span class="muted">(${effectiveProps(t).length}, including inherited)</span></h2>
        <table class="props">
          <thead><tr><th>Property</th><th>Expected type</th><th>Defined on</th><th>Description</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="note">Expected types are modelled from the mapping spec. They are not checked against schema.org.</p>
      </section>`;
  }

  // schema.org-style JSON-LD: an rdfs:Class for the type, and rdf:Property nodes
  // using schema:domainIncludes / schema:rangeIncludes.
  function refId(ref) {
    return isSchemaRef(ref) ? ref : `fs:${ref}`;
  }

  function propId(name) {
    return name.startsWith("fs:") ? name : `schema:${name}`;
  }

  function rangeId(r) {
    return byId.has(r) ? `fs:${r}` : `schema:${r}`;
  }

  function buildJsonLd(t) {
    const classNode = {
      "@id": `fs:${t.id}`,
      "@type": "rdfs:Class",
      "rdfs:label": t.id,
      "rdfs:comment": t.comment,
      "rdfs:subClassOf": { "@id": refId(t.parent) },
      "fs:classification": t.classification,
      "fs:source": t.source
    };
    if (t.priority) classNode["fs:priority"] = t.priority;

    const propNodes = effectiveProps(t).map((p) => ({
      "@id": propId(p.name),
      "@type": "rdf:Property",
      "rdfs:label": p.name,
      "rdfs:comment": PROPERTIES[p.name] ? PROPERTIES[p.name].description : "",
      "schema:domainIncludes": domainsOf(p.name).map((d) => ({ "@id": refId(d) })),
      "schema:rangeIncludes": rangeOf(p.name).map((r) => ({ "@id": rangeId(r) }))
    }));

    return {
      "@context": {
        schema: NS.schema,
        rdfs: NS.rdfs,
        rdf: NS.rdf,
        fs: NS.fs
      },
      "@graph": [classNode, ...propNodes]
    };
  }

  function renderJsonLdTab(t) {
    const json = JSON.stringify(buildJsonLd(t), null, 2);
    return `
      <section>
        <h2>JSON-LD</h2>
        <p class="note">Uses schema.org conventions. The <code>fs:</code> namespace (${esc(NS.fs)}) is a placeholder until a real base IRI is agreed.</p>
        <pre class="jsonld">${esc(json)}</pre>
      </section>`;
  }

  function renderType(t) {
    const tabs = `
      <nav class="tabs">
        <button type="button" data-tab="schema" class="${currentTab === "schema" ? "active" : ""}">Schema</button>
        <button type="button" data-tab="jsonld" class="${currentTab === "jsonld" ? "active" : ""}">JSON-LD</button>
      </nav>`;
    const body = currentTab === "jsonld" ? renderJsonLdTab(t) : renderSchemaTab(t);
    return renderTypeHeader(t) + tabs + body;
  }

  function renderProperty(name) {
    const p = PROPERTIES[name];
    const domains = domainsOf(name);
    const ranges = rangeHtml(name);
    const domainHtml = domains.length
      ? `<ul class="inline">${domains.map((d) => `<li>${refLink(d)}</li>`).join("")}</ul>`
      : '<p class="muted">Not used by any type.</p>';
    return `
      <header class="type-head">
        <p class="eyebrow">${name.startsWith("fs:") ? "Firestarter property" : "schema.org property"}</p>
        <h1>${esc(name)}</h1>
        <p class="lede">${esc(p.description)}</p>
        <dl class="facts">
          <dt>Expected type</dt><dd>${ranges}</dd>
          <dt>Used by</dt><dd>${domains.length} type${domains.length === 1 ? "" : "s"}</dd>
        </dl>
      </header>
      <section>
        <h2>Declared on</h2>
        ${domainHtml}
        <p class="note">Each property is declared once and reused across types. Subtypes inherit it.</p>
      </section>`;
  }

  function parseRoute() {
    const raw = decodeURIComponent(location.hash.slice(1));
    const slash = raw.indexOf("/");
    const kind = slash === -1 ? "" : raw.slice(0, slash);
    const value = slash === -1 ? "" : raw.slice(slash + 1);
    if (kind === "prop" && PROPERTIES[value]) return { kind: "prop", value };
    if (kind === "type" && byId.has(value)) return { kind: "type", value };
    return { kind: "type", value: DEFAULT_TYPE };
  }

  function renderMain() {
    const route = parseRoute();
    if (route.kind === "prop") {
      el.main.innerHTML = renderProperty(route.value);
    } else {
      el.main.innerHTML = renderType(byId.get(route.value));
    }
    renderSidebar();
  }

  function populateFilters() {
    el.group.insertAdjacentHTML(
      "beforeend",
      SCHEMA_GROUPS.map((g) => `<option value="${g.n}">${g.n}. ${esc(g.name)}</option>`).join("")
    );
    el.cls.insertAdjacentHTML(
      "beforeend",
      Object.keys(SCHEMA_CLASSES).map((k) => `<option value="${k}">${esc(k)}</option>`).join("")
    );
  }

  function init() {
    populateFilters();
    [el.search, el.group, el.cls, el.gaps].forEach((input) => input.addEventListener("input", renderSidebar));
    el.modeButtons.forEach((b) =>
      b.addEventListener("click", () => {
        listMode = b.dataset.mode;
        renderSidebar();
      })
    );
    el.main.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tab]");
      if (!btn) return;
      currentTab = btn.dataset.tab;
      renderMain();
    });
    window.addEventListener("hashchange", renderMain);
    renderMain();
  }

  init();
})();
