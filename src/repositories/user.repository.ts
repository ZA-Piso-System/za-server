import { Role } from "@/common/types/role.type";
import db from "@/db";
import { users } from "@/db/schemas";
import { eq } from "drizzle-orm";

export const getUserRole = async (id: string): Promise<string> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  return user?.role ?? Role.User;
};
