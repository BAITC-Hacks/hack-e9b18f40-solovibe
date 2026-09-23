export interface Principal { ownerIds: string[]; primaryOwnerId: string | null; userId: string | null; kind: "guest" | "account" }
