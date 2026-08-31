"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

/** 숫자만 남깁니다. "19,900원" → 19900 */
const toNumber = (v: FormDataEntryValue | null) => {
  const digits = String(v ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

const toText = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s || null;
};

/**
 * RLS가 막았을 때 나오는 메시지는 사람이 읽기 어렵습니다.
 * 실제로 십중팔구인 원인(관리자 명단 누락)을 알려 줍니다.
 */
function humanize(message: string, code?: string) {
  if (code === "42501" || /row-level security/i.test(message)) {
    return "권한이 없습니다. Supabase의 admins 표에 내 계정이 들어 있는지 확인하세요 (schema.sql 5번).";
  }
  return message;
}

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function addDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await adminClient();

  const title = toText(formData.get("title"));
  const url = toText(formData.get("url"));
  const price = toNumber(formData.get("price"));

  if (!title) return { error: "상품명을 적어 주세요." };
  if (!url) return { error: "링크를 적어 주세요." };
  if (price === null) return { error: "지금 가격을 적어 주세요." };

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
  } catch {
    return { error: "링크는 http:// 나 https:// 로 시작해야 합니다." };
  }

  const listPrice = toNumber(formData.get("list_price"));
  if (listPrice !== null && listPrice < price) {
    return { error: "평소 가격이 지금 가격보다 쌉니다. 두 칸이 바뀐 것 같습니다." };
  }

  const { error } = await supabase.from("deals").insert({
    title,
    url,
    price,
    list_price: listPrice,
    mall: toText(formData.get("mall")) ?? "toss",
    image: toText(formData.get("image")),
    category: toText(formData.get("category")) ?? "기타",
    note: toText(formData.get("note")),
    hot: formData.get("hot") === "on",
    created_by: user.id,
  });

  if (error) return { error: humanize(error.message, error.code) };

  refresh();
  return { ok: `"${title}" 올렸습니다.` };
}

export async function setEnded(formData: FormData) {
  const { supabase } = await adminClient();
  const id = String(formData.get("id") ?? "");
  const ended = formData.get("ended") === "true";

  await supabase.from("deals").update({ ended }).eq("id", id);
  refresh();
}

export async function deleteDeal(formData: FormData) {
  const { supabase } = await adminClient();
  const id = String(formData.get("id") ?? "");

  await supabase.from("deals").delete().eq("id", id);
  refresh();
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
