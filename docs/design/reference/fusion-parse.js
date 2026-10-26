/* CarePlan Scheduler — Fusion care plan reader (reference implementation for docs/IMPORT-SPEC.md).
 * Pure: text in, structured plan out. No network, no storage, no logging. */
(function (root) {
  "use strict";

  // Fusion service labels we have verified, mapped to engine service codes (IMP-07).
  var SERVICE_LABELS = { "PC - CDS": "T1019U2" };

  var MDY = "(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})";
  var pad = function (n) { return String(n).padStart(2, "0"); };
  function ymd(m, d, y) { return y + "-" + pad(m) + "-" + pad(d); }
  function isRealDate(iso) {
    var p = iso.split("-").map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return dt.getUTCFullYear() === p[0] && dt.getUTCMonth() === p[1] - 1 && dt.getUTCDate() === p[2];
  }

  // IMP-01: normalise what browsers and PDFs put on the clipboard.
  function normalize(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[   ]/g, " ")
      .replace(/[‐-―]/g, "-")
      .replace(/__/g, "");
  }

  // IMP-02: "NAME (DCN: 12345678) Care Plan: 08/01/2025 - 06/30/2026 Total Cost: $2468.56"
  function readBanner(t) {
    var re = new RegExp("^[ \\t]*([^\\n(]{1,120}?)\\s*\\(DCN:\\s*(\\d{6,12})\\)\\s*Care Plan:\\s*" + MDY + "\\s*-\\s*" + MDY +
      "(?:\\s*Total Cost:\\s*\\$\\s*([\\d,]+\\.\\d{2}))?", "m");
    var m = t.match(re);
    if (!m) return null;
    return {
      name: m[1].trim(), dcn: m[2],
      start: ymd(m[3], m[4], m[5]), end: ymd(m[6], m[7], m[8]),
      totalCost: m[9] ? m[9].replace(/,/g, "") : null,
    };
  }

  // IMP-03: "Showing 1 to 10 of 14 entries" (Fusion shows 10 rows per page).
  function readPaging(t) {
    var all = [];
    var re = /Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+entries/gi, m;
    while ((m = re.exec(t))) all.push({ from: +m[1], to: +m[2], total: +m[3] });
    return all;
  }

  // IMP-04: service group header row.
  var HEADER_RE = new RegExp(
    "([A-Z]{2,6}\\s*-\\s*[A-Z][A-Za-z]*(?:[ ][A-Z][A-Za-z]*)*)\\s*\\|\\s*([^|\\n]*?)\\s*\\|\\s*(?:(\\d{10})\\s*\\|\\s*)?" +
    MDY + "\\s*-\\s*" + MDY + "\\s*\\|\\s*(\\d{1,4})\\s*units\\s*(?:\\|\\s*\\$\\s*([\\d,]+\\.\\d{2})\\s*)?(?:\\|\\s*PA:\\s*(\\d+))?", "g");

  function readHeaders(t) {
    var out = [], m;
    HEADER_RE.lastIndex = 0;
    while ((m = HEADER_RE.exec(t))) {
      var label = m[1].replace(/\s*-\s*/, " - ").trim();
      out.push({
        index: m.index, textEnd: HEADER_RE.lastIndex,
        label: label, provider: m[2].trim(), phone: m[3] || null,
        start: ymd(m[4], m[5], m[6]), end: ymd(m[7], m[8], m[9]),
        units: +m[10], cost: m[11] ? m[11].replace(/,/g, "") : null, pa: m[12] || null,
      });
    }
    return out;
  }

  // Text that follows the table on screen and must not be read as part of the last row.
  var TAIL_RE = /(Showing\s+\d+\s+to\s+\d+|\bPrevious\b|\bNext\b|Search:|Export\s*\.\.\.|Total Units\s*Task Type)/i;

  function cutTail(s) {
    var m = s.match(TAIL_RE);
    return m ? s.slice(0, m.index) : s;
  }

  function mostCommonUnits(t) {
    var counts = {}, m, re = /(\d{1,4})\s*units/gi, best = null;
    while ((m = re.exec(t))) counts[m[1]] = (counts[m[1]] || 0) + 1;
    Object.keys(counts).forEach(function (k) { if (best === null || counts[k] > counts[best]) best = k; });
    return best === null ? null : +best;
  }

  // IMP-06: task name -> rule-pack task. Exact name or alias first, then a unique prefix
  // (Fusion truncates long names, e.g. "Essential Correspond").
  function matchTask(pack, name) {
    var lower = name.trim().toLowerCase().replace(/\s+/g, " ");
    var exact = pack.tasks.find(function (t) {
      return t.name.toLowerCase() === lower || t.aliases.some(function (a) { return a.toLowerCase() === lower; });
    });
    if (exact) return exact;
    if (lower.length < 6) return null;
    var prefixed = pack.tasks.filter(function (t) {
      return t.name.toLowerCase().indexOf(lower) === 0 || t.aliases.some(function (a) { return a.toLowerCase().indexOf(lower) === 0; });
    });
    return prefixed.length === 1 ? prefixed[0] : null;
  }

  // IMP-05: one row of the table, in any of the clipboard shapes.
  function readRow(chunk, pack) {
    var raw = cutTail(chunk).replace(/^[\s|]+|[\s|]+$/g, "");
    if (!raw) return null;
    var name, nums = [], digits = null;
    if (raw.indexOf("\t") >= 0 || raw.indexOf("|") >= 0 || / {2,}/.test(raw)) {
      var cells = raw.split(/\t| *\| *| {2,}/).map(function (c) { return c.trim(); });
      name = cells[0];
      for (var i = 1; i < cells.length; i++) if (/^\d+$/.test(cells[i])) nums.push(+cells[i]);
      if (!name || /\d/.test(name)) return { raw: raw, error: "unreadable" };
    } else {
      var m = raw.match(/^(.*?[^\d\s])\s*([\d\s]*)$/);
      if (!m) return { raw: raw, error: "unreadable" };
      name = m[1].trim();
      var rest = m[2].trim();
      // Single spaces between numbers ("Bathing 45 5") are separate cells; no spaces
      // ("Bathing455") is a run-together copy.
      if (/\s/.test(rest)) nums = rest.split(/\s+/).map(Number);
      else if (rest) digits = rest;
    }
    var def = matchTask(pack, name);
    var transport = def ? def.isTransport === true : /transport/i.test(name);

    if (transport) {
      var minutes = null, units = null;
      var pairs = [];
      if (digits) {
        for (var k = 1; k < digits.length; k++) pairs.push([+digits.slice(0, k), +digits.slice(k)]);
      } else {
        for (var a = 0; a < nums.length; a++) for (var b = 0; b < nums.length; b++) if (a !== b) pairs.push([nums[a], nums[b]]);
      }
      for (var p = 0; p < pairs.length; p++) {
        if (pairs[p][1] > 0 && Math.floor(pairs[p][1] / 15) === pairs[p][0]) { units = pairs[p][0]; minutes = pairs[p][1]; break; }
      }
      if (minutes === null) return { raw: raw, name: name, transport: true, error: "transport-numbers" };
      return { raw: raw, name: name, transport: true, unitsPerMonth: units, minutesPerMonth: minutes, taskCode: def ? def.taskCode : null };
    }

    var minPerDay = null, daysPerWeek = null;
    if (digits) {
      if (digits.length >= 2) { daysPerWeek = +digits.slice(-1); minPerDay = +digits.slice(0, -1); }
    } else if (nums.length >= 2) {
      minPerDay = nums[0]; daysPerWeek = nums[1];
    }
    if (!(daysPerWeek >= 1 && daysPerWeek <= 7) || !(minPerDay >= 1 && minPerDay <= 1440)) {
      return { raw: raw, name: name, error: "task-numbers" };
    }
    return {
      raw: raw, name: def ? def.name : name, fusionName: name, taskCode: def ? def.taskCode : null,
      minPerDay: minPerDay, daysPerWeek: daysPerWeek,
    };
  }

  function rowsFrom(region, units, pack) {
    var token = new RegExp(units + "\\s*units", "gi");
    var parts = region.split(token);
    var rows = [];
    for (var i = 1; i < parts.length; i++) {
      var r = readRow(parts[i], pack);
      if (r) rows.push(r);
    }
    return rows;
  }

  /**
   * parseFusionText(text, pack) -> {
   *   participant: { name, dcn } | null, plan: { start, end } | null, totalCost,
   *   paging: [{ from, to, total }], services: [ServicePlan], issues: [{ level, code, message }] }
   * ServicePlan: { label, serviceCode, provider, phone, start, end, units, cost, pa,
   *   tasks: [{ name, fusionName, taskCode, minPerDay, daysPerWeek }],
   *   transport: { unitsPerMonth, minutesPerMonth } | null, unread: [{ raw, reason }] }
   */
  function parseFusionText(text, pack) {
    var t = normalize(text);
    var banner = readBanner(t);
    var paging = readPaging(t);
    var headers = readHeaders(t);
    var services = [];

    if (headers.length) {
      headers.forEach(function (h, i) {
        var region = t.slice(h.textEnd, i + 1 < headers.length ? headers[i + 1].index : t.length);
        services.push(buildService(h, rowsFrom(region, h.units, pack)));
      });
    } else {
      var units = mostCommonUnits(t);
      if (units !== null) {
        var bodyStart = banner ? t.indexOf("\n", t.search(/\(DCN:/)) : 0;
        var rows = rowsFrom(t.slice(Math.max(0, bodyStart)), units, pack);
        services.push(buildService({
          label: null, provider: null, phone: null,
          start: banner ? banner.start : null, end: banner ? banner.end : null,
          units: units, cost: null, pa: null,
        }, rows));
      }
    }

    var issues = [];
    var rowCount = services.reduce(function (n, s) { return n + s.tasks.length + (s.transport ? 1 : 0) + s.unread.length; }, 0);
    if (!services.length || rowCount === 0) {
      issues.push({ level: "error", code: "no-rows", message: "We couldn't find care plan tasks in this text." });
    }
    var total = paging.length ? Math.max.apply(null, paging.map(function (p) { return p.total; })) : null;
    if (total !== null && rowCount < total) {
      issues.push({ level: "error", code: "incomplete", have: rowCount, total: total,
        message: "This copy has " + rowCount + " of the plan's " + total + " rows." });
    }
    services.forEach(function (s) {
      if (s.label && !s.serviceCode) issues.push({ level: "error", code: "unknown-service", label: s.label,
        message: "We don't know which service \"" + s.label + "\" is yet." });
      s.unread.forEach(function (u) { issues.push({ level: "error", code: "unread-row", raw: u.raw, message: "We couldn't read this row: " + u.raw }); });
      s.tasks.forEach(function (tk) {
        if (!tk.taskCode) issues.push({ level: "warn", code: "unknown-task", name: tk.name, message: "\"" + tk.name + "\" isn't in our Missouri task list. We'll still schedule it." });
        if (tk.minPerDay % 5 !== 0) issues.push({ level: "warn", code: "odd-minutes", name: tk.name, message: tk.name + " has " + tk.minPerDay + " minutes a day, which isn't a 5-minute step. Check it against Fusion." });
      });
      var seen = {};
      s.tasks.forEach(function (tk) { var k = tk.name.toLowerCase(); if (seen[k]) issues.push({ level: "error", code: "duplicate-task", name: tk.name, message: tk.name + " appears twice." }); seen[k] = true; });
    });
    var plan = banner ? { start: banner.start, end: banner.end } : (services[0] && services[0].start ? { start: services[0].start, end: services[0].end } : null);
    if (!plan && rowCount > 0) {
      issues.push({ level: "input", code: "no-plan-dates", message: "The plan dates weren't included. Enter them from Fusion." });
    }
    if (plan && (!isRealDate(plan.start) || !isRealDate(plan.end) || plan.end < plan.start)) {
      issues.push({ level: "error", code: "bad-dates", message: "The plan dates don't make sense. Check them against Fusion." });
    }
    return {
      participant: banner ? { name: banner.name, dcn: banner.dcn } : null,
      plan: plan,
      totalCost: banner ? banner.totalCost : null,
      paging: paging,
      services: services,
      issues: issues,
    };
  }

  function buildService(h, rows) {
    var tasks = [], transport = null, unread = [];
    rows.forEach(function (r) {
      if (r.error) { unread.push({ raw: r.raw, reason: r.error }); return; }
      if (r.transport) { transport = { unitsPerMonth: r.unitsPerMonth, minutesPerMonth: r.minutesPerMonth }; return; }
      tasks.push({ name: r.name, fusionName: r.fusionName, taskCode: r.taskCode, minPerDay: r.minPerDay, daysPerWeek: r.daysPerWeek });
    });
    return {
      label: h.label, serviceCode: h.label ? (SERVICE_LABELS[h.label] || null) : "T1019U2",
      provider: h.provider, phone: h.phone, start: h.start, end: h.end,
      units: h.units, cost: h.cost, pa: h.pa, tasks: tasks, transport: transport, unread: unread,
    };
  }

  /** IMP-09: combine two or more pastes of the same plan (Fusion page 1, page 2, ...). */
  function mergeFusionText(texts, pack) {
    var parsed = texts.map(function (x) { return parseFusionText(x, pack); });
    var base = JSON.parse(JSON.stringify(parsed[0]));
    var problems = [];
    for (var i = 1; i < parsed.length; i++) {
      var p = parsed[i];
      if (base.participant && p.participant && base.participant.dcn !== p.participant.dcn) {
        problems.push({ level: "error", code: "different-participant", message: "Page " + (i + 1) + " is for a different participant." });
        continue;
      }
      p.services.forEach(function (s) {
        var target = base.services.find(function (b) { return b.label === s.label && b.units === s.units; });
        if (!target) { base.services.push(s); return; }
        s.tasks.forEach(function (tk) {
          if (!target.tasks.some(function (x) { return x.name.toLowerCase() === tk.name.toLowerCase(); })) target.tasks.push(tk);
        });
        if (!target.transport && s.transport) target.transport = s.transport;
        target.unread = target.unread.concat(s.unread);
      });
      base.paging = base.paging.concat(p.paging);
    }
    // Recompute issues for the merged plan by re-running the checks on a synthetic result.
    var merged = recheck(base);
    merged.issues = problems.concat(merged.issues);
    return merged;
  }

  function recheck(r) {
    var rowCount = r.services.reduce(function (n, s) { return n + s.tasks.length + (s.transport ? 1 : 0) + s.unread.length; }, 0);
    var issues = r.issues.filter(function (x) { return x.code !== "incomplete" && x.code !== "no-rows" && x.code !== "duplicate-task"; });
    var total = r.paging.length ? Math.max.apply(null, r.paging.map(function (p) { return p.total; })) : null;
    if (rowCount === 0) issues.push({ level: "error", code: "no-rows", message: "We couldn't find care plan tasks in this text." });
    if (total !== null && rowCount < total) issues.push({ level: "error", code: "incomplete", have: rowCount, total: total, message: "This copy has " + rowCount + " of the plan's " + total + " rows." });
    r.issues = issues;
    return r;
  }

  root.FusionImport = { parseFusionText: parseFusionText, mergeFusionText: mergeFusionText, matchTask: matchTask, SERVICE_LABELS: SERVICE_LABELS };
})(typeof window !== "undefined" ? window : globalThis);
