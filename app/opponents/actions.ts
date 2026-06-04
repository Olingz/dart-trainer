"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeOpponentName,
  validateOpponentName,
} from "@/lib/multiplayer";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

export async function addLocalOpponent(name: string): Promise<ActionResult> {
  const validationError = validateOpponentName(name);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ikke logget ind" };
  }

  const { error } = await supabase.from("local_opponents").insert({
    user_id: user.id,
    name: normalizeOpponentName(name),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Modstanderen findes allerede" };
    }
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/play/new");
  revalidatePath("/play/opponents");
  return {};
}

export async function deleteLocalOpponent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ikke logget ind" };
  }

  const { error } = await supabase
    .from("local_opponents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/play/new");
  revalidatePath("/play/opponents");
  return {};
}
