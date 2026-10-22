import type { RulePack } from "@careplan/engine";
import { readBanner } from "./banner.js";
import { normalize } from "./normalize.js";
import { readPaging } from "./paging.js";
import { addTask, buildResult, type ResultParts } from "./result.js";
import { mostCommonUnits, readRows, type ReadRow } from "./rows.js";
import { readHeaders } from "./serviceHeader.js";
import { ROWS_ONLY_SERVICE_CODE, serviceCodeForLabel } from "./services.js";
import type { ImportedService, ImportIssue, ImportResult } from "./types.js";

type ServiceBase = Omit<ImportedService, "serviceCode" | "tasks" | "transport" | "unread">;

/** IMP-04/05/12: put a service's rows into tasks, transportation and unread rows. */
function buildService(base: ServiceBase, rows: ReadRow[], duplicates: ImportIssue[]): ImportedService {
  const service: ImportedService = {
    label: base.label,
    serviceCode: base.label ? serviceCodeForLabel(base.label) : ROWS_ONLY_SERVICE_CODE,
    provider: base.provider,
    phone: base.phone,
    start: base.start,
    end: base.end,
    units: base.units,
    cost: base.cost,
    pa: base.pa,
    tasks: [],
    transport: null,
    unread: [],
  };
  for (const row of rows) {
    if (row.kind === "unread") {
      service.unread.push({ raw: row.raw, reason: row.reason });
    } else if (row.kind === "transport") {
      service.transport ??= { unitsPerMonth: row.unitsPerMonth, minutesPerMonth: row.minutesPerMonth };
    } else {
      addTask(service, row.task, duplicates);
    }
  }
  return service;
}

/** Read one paste into the participant, paging and services it holds, without working out issues. */
export function readPaste(text: string, pack: RulePack): ResultParts {
  const t = normalize(text);
  const banner = readBanner(t);
  const headers = readHeaders(t);
  const duplicates: ImportIssue[] = [];
  const services: ImportedService[] = [];

  if (headers.length) {
    // IMP-04: rows after a group row, up to the next group row, belong to it.
    headers.forEach((header, i) => {
      const region = t.slice(header.textEnd, headers[i + 1]?.index ?? t.length);
      services.push(buildService(header, readRows(region, header.units, pack), duplicates));
    });
  } else {
    // IMP-05: no group row, so the most frequent "<n> units" gives the units.
    const units = mostCommonUnits(t);
    if (units !== null) {
      const bodyStart = banner ? t.indexOf("\n", t.search(/\(DCN:/)) : 0;
      const base: ServiceBase = {
        label: null, provider: null, phone: null,
        start: banner ? banner.start : null, end: banner ? banner.end : null,
        units, cost: null, pa: null,
      };
      services.push(buildService(base, readRows(t.slice(Math.max(0, bodyStart)), units, pack), duplicates));
    }
  }

  return {
    participant: banner ? { name: banner.name, dcn: banner.dcn } : null,
    bannerPlan: banner ? { start: banner.start, end: banner.end } : null,
    totalCost: banner ? banner.totalCost : null,
    paging: readPaging(t),
    services,
    duplicates,
  };
}

/**
 * Read a care plan pasted from Fusion (or the text of its PDF) into participant, plan dates,
 * services, tasks and issues. Pure: nothing is stored, logged or sent anywhere (IMP-16).
 */
export function parseFusionText(text: string, pack: RulePack): ImportResult {
  return buildResult(readPaste(text, pack));
}
