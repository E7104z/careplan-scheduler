/* CarePlan Scheduler — Quick Schedule model (reference implementation for APP-SPEC section 5).
 * Pure: state in, model out. Uses only @careplan/engine for schedule math and rules. */
(function (root) {
  "use strict";

  function pad(n) { return String(n).padStart(2, "0"); }
  function addMonths(ym, n) {
    var p = ym.split("-").map(Number), i = p[0] * 12 + (p[1] - 1) + n;
    return Math.floor(i / 12) + "-" + pad(i % 12 + 1);
  }
  function monthsBetween(startIso, endIso) {
    var out = [], m = startIso.slice(0, 7), last = endIso.slice(0, 7);
    while (m <= last) { out.push(m); m = addMonths(m, 1); }
    return out;
  }
  function lastDayIso(E, ym) { var p = ym.split("-").map(Number); return ym + "-" + pad(E.daysInMonth(p[0], p[1])); }
  function isFullMonth(E, ym, start, end) { return start <= ym + "-01" && end >= lastDayIso(E, ym); }
  function validTask(t) { return Number.isInteger(t.minPerDay) && t.minPerDay > 0 && t.minPerDay <= 1440; }

  /**
   * QS-FIT (SCH-17): when a month's authorized units are fewer than the weekly pattern needs
   * (a 31-day month against Fusion's monthly figure), trim from the end of the month until it
   * fits. Daily tasks are trimmed first, then the longest occurrences. Returns kind "fit"
   * exceptions. Trims only the pattern itself; a person's minute changes are never absorbed.
   */
  function fitTrims(E, template, auth, monthlyAuthorizations, months) {
    var trims = [];
    var tasksById = {};
    auth.tasks.forEach(function (t) { tasksById[t.id] = t; });
    var transportUnits = E.monthTransportUnits(auth);
    months.forEach(function (ym) {
      var fusion = monthlyAuthorizations.find(function (ma) { return ma.source === "fusion" && ma.month === ym; });
      if (!fusion) return;   // derived months fit by construction (F-3 factors)
      var p = ym.split("-").map(Number);
      var expanded = E.expandMonth(template, [], p[0], p[1], auth.start, auth.end);
      var budget = Math.max(0, fusion.units - transportUnits) * 15;
      var dates = Object.keys(expanded).sort();
      var scheduled = 0;
      dates.forEach(function (d) { Object.values(expanded[d]).forEach(function (m) { scheduled += m; }); });
      var over = scheduled - budget;
      for (var i = dates.length - 1; i >= 0 && over > 0; i--) {
        var day = Object.entries(expanded[dates[i]]).filter(function (e) { return e[1] > 0; });
        day.sort(function (a, b) {
          var da = tasksById[a[0]] ? tasksById[a[0]].daysPerWeek : 0, db = tasksById[b[0]] ? tasksById[b[0]].daysPerWeek : 0;
          return db - da || b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
        });
        for (var j = 0; j < day.length && over > 0; j++) {
          var cut = Math.min(over, day[j][1]);
          trims.push({ id: "fit-" + dates[i] + "-" + day[j][0], participantId: auth.participantId, date: dates[i],
            taskId: day[j][0], minutesDelta: -cut, reason: "Units for the month run out", author: "CarePlan Scheduler",
            createdAt: "", kind: "fit" });
          over -= cut;
        }
      }
    });
    return trims;
  }

  /**
   * build(state, E, pack) -> QuickModel
   * state.source: "fusion" (imported, plan values locked) | "manual"
   * state.plan: { start, end } ISO dates; state.headerUnits: Fusion's monthly figure (fusion only)
   * state.transport: fusion { minutesPerMonth, day } | manual { minPerTrip, tripsPerWeek, day }
   */
  function build(state, E, pack) {
    var svc = pack.services.find(function (s) { return s.code === state.serviceCode; });
    var tasks = state.tasks.filter(validTask).map(function (t) {
      return { id: t.id, serviceAuthId: "quick", taskCode: t.taskCode || ("FUSION:" + t.name), name: t.name, minPerDay: t.minPerDay, daysPerWeek: t.daysPerWeek };
    });
    var transportOn = svc && (svc.program === "CDS" || svc.program === "ILW");
    var transportMinutesPerMonth = 0, weeklyTransport = 0, allowance = null;
    if (transportOn && state.source === "fusion" && state.transport && state.transport.minutesPerMonth > 0) {
      transportMinutesPerMonth = state.transport.minutesPerMonth;
      weeklyTransport = Math.floor(Math.floor(transportMinutesPerMonth / 15) / 5) * 15;
      allowance = { minutesPerMonth: transportMinutesPerMonth, units: Math.floor(transportMinutesPerMonth / 15),
        unallocatedMinutes: transportMinutesPerMonth % 15, weeklyMinutes: weeklyTransport };
    } else if (transportOn && state.source !== "fusion" && state.transport && state.transport.minPerTrip > 0) {
      var a = E.transportAllowance(state.transport.minPerTrip, state.transport.tripsPerWeek);
      transportMinutesPerMonth = a.minutesPerMonth;
      weeklyTransport = state.transport.minPerTrip * state.transport.tripsPerWeek;
      allowance = { minutesPerMonth: a.minutesPerMonth, units: a.units, unallocatedMinutes: a.unallocatedMinutes, weeklyMinutes: weeklyTransport };
    }
    var overrides = {};
    state.tasks.forEach(function (t) { if (t.pinned && t.pinned.length) overrides[t.id] = t.pinned; });
    var composed = E.composeWeek({ tasks: tasks, activeDays: state.activeDays, overrides: overrides,
      weeklyTransportMinutes: weeklyTransport, transportDay: state.transport ? state.transport.day : 1 });
    var entries = composed.entries.map(function (e) {
      var k = e.taskId + ":" + e.weekday;
      return Object.prototype.hasOwnProperty.call(state.edits, k) ? { taskId: e.taskId, weekday: e.weekday, minutes: state.edits[k] } : e;
    }).filter(function (e) { return e.minutes > 0; });

    var months = monthsBetween(state.plan.start, state.plan.end);
    var auth = { id: "quick", participantId: "quick", program: svc.program, serviceCode: svc.code,
      start: state.plan.start, end: state.plan.end, state: "active", suspensions: [], revision: 1, tasks: tasks };
    if (transportMinutesPerMonth > 0) auth.transportMinutesPerMonth = transportMinutesPerMonth;

    var monthlyAuthorizations = [];
    if (state.source === "fusion" && Number.isInteger(state.headerUnits)) {
      // IMP-10: Fusion's figure caps every full month of the plan (conservative until DHSS confirms
      // whether 31-day months receive more). Partial months fall to SCH-12.
      months.forEach(function (ym) {
        if (isFullMonth(E, ym, auth.start, auth.end)) monthlyAuthorizations.push({ serviceAuthId: "quick", month: ym, units: state.headerUnits, source: "fusion", revision: 1 });
      });
    } else {
      Object.keys(state.fusion || {}).forEach(function (ym) {
        var u = state.fusion[ym];
        if (months.indexOf(ym) >= 0 && Number.isInteger(u) && u >= 0) monthlyAuthorizations.push({ serviceAuthId: "quick", month: ym, units: u, source: "fusion", revision: 1 });
      });
    }

    var pattern = { id: "quick-template", participantId: "quick", start: auth.start, end: auth.end, entries: composed.entries, rulePackVersion: pack.id };
    var template = { id: "quick-template", participantId: "quick", start: auth.start, end: auth.end, entries: entries, rulePackVersion: pack.id };
    var trims = tasks.length ? fitTrims(E, pattern, auth, monthlyAuthorizations, months) : [];
    var results = tasks.length ? E.validateSchedule({ pack: pack, authorizations: [auth], monthlyAuthorizations: monthlyAuthorizations,
      template: template, exceptions: trims, visits: [], caregivers: [], enrollments: [], months: months, tenantWorkweekStart: 0 }) : [];

    var checksum = null;
    if (state.source === "fusion" && Number.isInteger(state.headerUnits) && tasks.length) {
      var full = months.filter(function (ym) { return isFullMonth(E, ym, auth.start, auth.end); });
      var byLength = {};
      full.forEach(function (ym) {
        var p = ym.split("-").map(Number), len = E.daysInMonth(p[0], p[1]);
        if (!(len in byLength)) byLength[len] = E.derivedServiceMonthUnits(auth, p[0], p[1]);
      });
      var values = Object.keys(byLength).map(function (k) { return byLength[k]; });
      checksum = { fusion: state.headerUnits, byMonthLength: byLength, matches: values.indexOf(state.headerUnits) >= 0 };
    }

    return { svc: svc, tasks: tasks, entries: entries, auth: auth, template: template, trims: trims,
      allowance: allowance, months: months, monthlyAuthorizations: monthlyAuthorizations, results: results, checksum: checksum };
  }

  /** Figures for one month (meter and calendar). Same test as SCH-08, so they always agree. */
  function monthFigures(E, model, ym) {
    var p = ym.split("-").map(Number);
    var expanded = E.expandMonth(model.template, model.trims, p[0], p[1], model.auth.start, model.auth.end);
    var fusion = model.monthlyAuthorizations.find(function (ma) { return ma.month === ym; });
    var calculated = E.derivedServiceMonthUnits(model.auth, p[0], p[1]);
    var authorized = fusion ? fusion.units : calculated;
    var transportUnits = E.monthTransportUnits(model.auth);
    var budget = Math.max(0, authorized - transportUnits) * 15;
    var scheduled = 0;
    Object.values(expanded).forEach(function (d) { Object.values(d).forEach(function (m) { scheduled += m; }); });
    var trimmed = model.trims.filter(function (t) { return t.date.slice(0, 7) === ym; });
    return { expanded: expanded, authorizedUnits: authorized, source: fusion ? "fusion" : "calculated", calculatedUnits: calculated,
      transportUnits: transportUnits, taskBudgetMinutes: budget, scheduledTaskMinutes: scheduled, over: scheduled > budget,
      trims: trimmed, trimmedMinutes: trimmed.reduce(function (s, t) { return s - t.minutesDelta; }, 0) };
  }

  function blocks(model) { return model.results.filter(function (r) { return r.severity === "BLOCK"; }); }

  /**
   * QS-GUARD: a person's change is accepted only if the schedule still has no Must-fix result.
   * Returns { ok: true, model } or { ok: false, blocks } (the first new BLOCK results).
   */
  function tryChange(nextState, E, pack) {
    var model = build(nextState, E, pack);
    var b = blocks(model);
    return b.length ? { ok: false, blocks: b, model: model } : { ok: true, model: model };
  }

  /** Largest minutes (<= requested) a weekly-grid cell can hold without a Must-fix result. */
  function maxCellMinutes(state, key, requested, E, pack) {
    function fits(v) {
      var s = JSON.parse(JSON.stringify(state));
      s.edits[key] = v;
      return blocks(build(s, E, pack)).length === 0;
    }
    if (fits(requested)) return requested;
    var lo = 0, hi = Math.floor(requested / 5);   // in 5-minute steps
    while (lo < hi) { var mid = Math.ceil((lo + hi) / 2); if (fits(mid * 5)) lo = mid; else hi = mid - 1; }
    return lo * 5;
  }

  var MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

  /** IMP-11: a parsed Fusion plan -> Quick Schedule state (plan values locked, nothing pinned). */
  function fromFusion(parsed, serviceIndex, today) {
    var s = parsed.services[serviceIndex];
    var plan = parsed.plan || { start: s.start, end: s.end };
    var maxDpw = s.tasks.reduce(function (m, t) { return Math.max(m, t.daysPerWeek); }, 1);
    var active = [false, false, false, false, false, false, false];
    MONDAY_FIRST.slice(0, maxDpw).forEach(function (d) { active[d] = true; });
    var lastActive = MONDAY_FIRST.slice(0, maxDpw).slice(-1)[0];
    var ym = today.toISOString().slice(0, 7);
    var months = monthsBetween(plan.start, plan.end);
    var n = 0;
    return {
      source: "fusion",
      identity: parsed.participant ? { name: parsed.participant.name, dcn: parsed.participant.dcn } : null,
      provider: s.provider, pa: s.pa, serviceLabel: s.label,
      serviceCode: s.serviceCode, plan: plan, headerUnits: s.units,
      tasks: s.tasks.map(function (t) { n += 1; return { id: "qt-" + n, taskCode: t.taskCode, name: t.name, minPerDay: t.minPerDay, daysPerWeek: t.daysPerWeek, pinned: null, locked: true }; }),
      nextId: n + 1,
      activeDays: active,
      transport: { minutesPerMonth: s.transport ? s.transport.minutesPerMonth : 0, day: lastActive },
      edits: {}, fusion: {},
      viewMonth: months.indexOf(ym) >= 0 ? ym : months[0],
    };
  }

  root.QuickModel = { fromFusion: fromFusion, build: build, monthFigures: monthFigures, tryChange: tryChange, maxCellMinutes: maxCellMinutes,
    fitTrims: fitTrims, monthsBetween: monthsBetween, addMonths: addMonths, isFullMonth: isFullMonth };
})(typeof window !== "undefined" ? window : globalThis);
