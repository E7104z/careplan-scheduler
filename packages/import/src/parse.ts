import type { RulePack } from "@careplan/engine";
import { readBanner } from "./banner.js";
import { normalize } from "./normalize.js";
import { readPaging } from "./paging.js";
import { isReport, readReport } from "./report.js";
import { buildResult, buildService, type ResultParts, type ServiceBase } from "./result.js";
import { mostCommonUnits, readRows } from "./rows.js";
import { readHeaders } from "./serviceHeader.js";
import type { ImportedService, ImportIssue, ImportResult } from "./types.js";

/** Read one paste into the participant, paging and services it holds, without working out issues. */
export function readPaste(text: string, pack: RulePack): ResultParts {
  const t = normalize(text);
  if (isReport(t)) return readReport(t, pack);
  const banner = readBanner(t);
  const headers = readHeaders(t);
  const duplicates: ImportIssue[] = [];
  const services: ImportedService[] = [];

  if (headers.length) {
    // IMP-04: rows after a group row, up to the next group row, belong to it.
    headers.forEach((header, i) => {
      const region = t.slice(header.textEnd, headers[i + 1]?.index ?? t.length);
      services.push(buildService({ ...header, monthly: null }, readRows(region, header.units, pack), duplicates));
    });
  } else {
    // IMP-05: no group row, so the most frequent "<n> units" gives the units.
    const units = mostCommonUnits(t);
    if (units !== null) {
      const bodyStart = banner ? t.indexOf("\n", t.search(/\(DCN:/)) : 0;
      const base: ServiceBase = {
        label: null, provider: null, phone: null,
        start: banner ? banner.start : null, end: banner ? banner.end : null,
        units, cost: null, pa: null, monthly: null,
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
    visits: [],
    others: [],
    duplicates,
    skipped: [],
  };
}

/**
 * Read a care plan pasted from Fusion (or the text of its PDF) into participant, plan dates,
 * services, tasks and issues. Pure: nothing is stored, logged or sent anywhere (IMP-16).
 */
export function parseFusionText(text: string, pack: RulePack): ImportResult {
  return buildResult(readPaste(text, pack));
}
