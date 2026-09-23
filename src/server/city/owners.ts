import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { cityOwners } from "@/server/db/schema";
import { CityError } from "./errors";
import type { Principal } from "./principal";

const COOKIE = "citybalance_guest";
const RETENTION = 30 * 86400;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const secure = () => (process.env.APP_URL || "").startsWith("https:");
const cookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/", maxAge: RETENTION });

export async function resolvePrincipal(options: { create?: boolean; refresh?: boolean } = {}): Promise<Principal> {
  const db = getDb();
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) {
    // Serialize initial owner creation, including requests from two account tabs.
    const rows = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`);
      let owned = await tx.select().from(cityOwners).where(eq(cityOwners.userId, session.user.id)).orderBy(cityOwners.createdAt);
      if (!owned.length && options.create) owned = await tx.insert(cityOwners).values({ id: randomUUID(), userId: session.user.id }).returning();
      return owned;
    });
    return { ownerIds: rows.map(r => r.id), primaryOwnerId: rows[0]?.id ?? null, userId: session.user.id, kind: "account" };
  }
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const [owner] = await db.select().from(cityOwners).where(and(eq(cityOwners.guestTokenHash, hashToken(token)), isNull(cityOwners.userId), gt(cityOwners.expiresAt, new Date())));
    if (owner) {
      if (options.refresh) {
        await db.update(cityOwners).set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + RETENTION * 1000) }).where(and(eq(cityOwners.id, owner.id), isNull(cityOwners.userId)));
        jar.set(COOKIE, token, cookieOptions());
      }
      return { ownerIds: [owner.id], primaryOwnerId: owner.id, userId: null, kind: "guest" };
    }
  }
  if (!options.create) return { ownerIds: [], primaryOwnerId: null, userId: null, kind: "guest" };
  const newToken = randomBytes(32).toString("hex");
  const id = randomUUID();
  await db.insert(cityOwners).values({ id, guestTokenHash: hashToken(newToken), expiresAt: new Date(Date.now() + RETENTION * 1000) });
  jar.set(COOKIE, newToken, cookieOptions());
  return { ownerIds: [id], primaryOwnerId: id, userId: null, kind: "guest" };
}

export async function claimGuest() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new CityError("SESSION_EXPIRED", 401);
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await getDb().transaction(async tx => {
      await tx.update(cityOwners).set({ userId: session.user.id, guestTokenHash: null, expiresAt: null, lastSeenAt: new Date() })
        .where(and(eq(cityOwners.guestTokenHash, hashToken(token)), isNull(cityOwners.userId), gt(cityOwners.expiresAt, new Date())));
    });
  }
  jar.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return { claimed: true };
}
