import { collection, getDocs } from "firebase/firestore";
import { MO_2026_07, type ServiceCode, type Visit } from "@careplan/engine";
import { getDb } from "../auth/firebase";
import { asString } from "./docFields";

/** A participant as the app is allowed to know it: the internal id and its agency alias. */
export interface ParticipantAlias {
  id: string;
  displayName: string;
}

/**
 * The agency aliases only: `tenants/{t}/participants` carry a `displayName`, never a
 * name, DCN or address (firestore.rules R-21 to R-28). The internal id is the random
 * document id.
 */
export async function listParticipants(tenantId: string): Promise<ParticipantAlias[]> {
  const db = getDb();
  const snapshot = await getDocs(collection(db, "tenants", tenantId, "participants"));
  return snapshot.docs
    .map((doc) => ({ id: doc.id, displayName: asString((doc.data() as Record<string, unknown>).displayName) }))
    .filter((participant) => participant.displayName !== "")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function asServiceCode(value: string): ServiceCode | null {
  const service = MO_2026_07.services.find((candidate) => candidate.code === value);
  return service ? service.code : null;
}

function visitFromDoc(participantId: string, docId: string, data: Record<string, unknown>): Visit | null {
  const serviceCode = asServiceCode(asString(data.serviceCode));
  const caregiverId = asString(data.caregiverId);
  const start = asString(data.start);
  const end = asString(data.end);
  if (!serviceCode || caregiverId === "" || start === "" || end === "") return null;
  const taskIds = Array.isArray(data.taskIds) ? data.taskIds.filter((task): task is string => typeof task === "string") : [];
  return {
    id: docId,
    participantId: asString(data.participantId) || participantId,
    caregiverId,
    serviceCode,
    start,
    end,
    taskIds,
  };
}

/** The union of the participants' visits, for the cross-participant worker-load checks. */
export async function listVisits(tenantId: string, participantIds: string[]): Promise<Visit[]> {
  const db = getDb();
  const perParticipant = await Promise.all(
    participantIds.map(async (participantId) => {
      const snapshot = await getDocs(collection(db, "tenants", tenantId, "participants", participantId, "visits"));
      return snapshot.docs
        .map((doc) => visitFromDoc(participantId, doc.id, doc.data() as Record<string, unknown>))
        .filter((visit): visit is Visit => visit !== null);
    }),
  );
  return perParticipant.flat();
}
