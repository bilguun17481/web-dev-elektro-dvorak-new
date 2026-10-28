"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "./action-state";
import { providerById } from "@/adapters/carriers/registry";
import { fromKc } from "@/domain/money";
import { canManageShipping, currentSession, signIn, signOut } from "@/server/auth";
import { pricingSchema } from "@/server/shipping/config";
import {
  deleteConnection,
  deleteMethod,
  saveConnection,
  saveMethod,
  testConnection,
} from "@/server/shipping/repo";

/**
 * Every action validates its input with zod and re-checks the session. A server action is
 * a public endpoint: that the only button pointing at it sits behind a login proves
 * nothing about who called it.
 */

async function requireShippingManager(): Promise<ActionState | null> {
  const session = await currentSession();
  if (session === null) return { error: "Nejste přihlášeni.", notice: null };
  if (!canManageShipping(session.role)) return { error: "K této změně nemáte oprávnění.", notice: null };
  return null;
}

const loginSchema = z.object({
  email: z.string().min(1, "Vyplňte e-mail"),
  password: z.string().min(1, "Vyplňte heslo"),
});

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Vyplňte přihlašovací údaje",
      notice: null,
      email: typedEmail,
    };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, notice: null, email: typedEmail };

  redirect("/admin/");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login/");
}

const connectionSchema = z.object({
  id: z.string().min(1).nullable(),
  providerId: z.string().min(1),
  label: z.string().default(""),
  enabled: z.boolean(),
});

export async function saveConnectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireShippingManager();
  if (denied !== null) return denied;

  const parsed = connectionSchema.safeParse({
    id: (formData.get("id") as string | null) || null,
    providerId: formData.get("providerId"),
    label: formData.get("label") ?? "",
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { error: "Formulář je neúplný.", notice: null };

  const provider = providerById(parsed.data.providerId);
  if (provider === null) return { error: "Neznámý poskytovatel.", notice: null };

  // Credential fields are whatever the provider declared, so they are read by name here
  // rather than being a fixed list.
  const credentials = Object.fromEntries(
    provider.definition.credentials.map((field) => [
      field.key,
      String(formData.get(`cred.${field.key}`) ?? ""),
    ]),
  );

  const result = await saveConnection({ ...parsed.data, credentials });
  if (!result.ok) return { error: result.error, notice: null };

  revalidatePath("/admin/doprava");
  return { error: null, notice: `Připojení ${result.value.label} uloženo.` };
}

export async function testConnectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireShippingManager();
  if (denied !== null) return denied;

  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: "Chybí připojení.", notice: null };

  const result = await testConnection(id);
  revalidatePath("/admin/doprava");

  return result.ok
    ? { error: null, notice: `Spojení funguje. Účet: ${result.value.account}` }
    : { error: `${result.error}${result.detail === undefined ? "" : ` (${result.detail})`}`, notice: null };
}

export async function deleteConnectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireShippingManager();
  if (denied !== null) return denied;

  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: "Chybí připojení.", notice: null };

  await deleteConnection(id);
  revalidatePath("/admin/doprava");
  return { error: null, notice: "Připojení smazáno i se svými způsoby dopravy." };
}

const methodSchema = z.object({
  id: z.string().min(1).nullable(),
  connectionId: z.string().min(1, "Vyberte připojení"),
  carrierCode: z.string().min(1, "Vyberte dopravce"),
  name: z.string().min(1, "Vyplňte název"),
  description: z.string().default(""),
  enabled: z.boolean(),
  sort: z.coerce.number().int(),
  vatRateBp: z.coerce.number().int().nonnegative(),
  needsPickupPoint: z.boolean(),
  allowsBulky: z.boolean(),
});

/** Admin types Kč; haléře are what gets stored. The conversion happens only here. */
function kcField(formData: FormData, name: string): number {
  const raw = String(formData.get(name) ?? "")
    .replace(",", ".")
    .trim();
  const value = Number(raw);
  return Number.isFinite(value) ? fromKc(value) : 0;
}

function numberField(formData: FormData, name: string, fallback: number): number {
  const raw = String(formData.get(name) ?? "")
    .replace(",", ".")
    .trim();
  const value = Number(raw);
  return Number.isFinite(value) && raw !== "" ? value : fallback;
}

export async function saveMethodAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireShippingManager();
  if (denied !== null) return denied;

  const parsed = methodSchema.safeParse({
    id: (formData.get("id") as string | null) || null,
    connectionId: formData.get("connectionId"),
    carrierCode: formData.get("carrierCode"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    enabled: formData.get("enabled") === "on",
    sort: formData.get("sort") ?? 0,
    vatRateBp: formData.get("vatRateBp") ?? 2100,
    needsPickupPoint: formData.get("needsPickupPoint") === "on",
    allowsBulky: formData.get("allowsBulky") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulář je neúplný.", notice: null };
  }

  const kind = String(formData.get("pricingKind") ?? "flat");
  const freeOverRaw = String(formData.get("freeOverKc") ?? "").trim();

  const pricingInput =
    kind === "store_pickup"
      ? { kind }
      : kind === "fofr_pallet"
        ? {
            kind,
            baseKc: numberField(formData, "baseKc", 0),
            perKgKc: numberField(formData, "perKgKc", 0),
            minChargeableKg: numberField(formData, "minChargeableKg", 0),
            fixedFeeKc: numberField(formData, "fixedFeeKc", 0),
            fuelSurchargeBp: Math.round(numberField(formData, "fuelSurchargePercent", 0) * 100),
            codRateBp: Math.round(numberField(formData, "codRatePercent", 0) * 100),
            volumetricKgPerM3: numberField(formData, "volumetricKgPerM3", 122),
            codCeilingMinor: kcField(formData, "codCeilingKc"),
            insuranceLimitMinor: kcField(formData, "insuranceLimitKc"),
          }
        : {
            kind,
            priceMinor: kcField(formData, "priceKc"),
            freeOverMinor: freeOverRaw === "" ? null : kcField(formData, "freeOverKc"),
            codFeeMinor: kcField(formData, "codFeeKc"),
          };

  const pricing = pricingSchema.safeParse(pricingInput);
  if (!pricing.success) {
    return { error: `Ceník není platný: ${pricing.error.issues[0]?.message ?? ""}`, notice: null };
  }

  const result = await saveMethod({ ...parsed.data, pricing: pricing.data });
  if (!result.ok) return { error: result.error, notice: null };

  revalidatePath("/admin/doprava");
  revalidatePath("/kosik");
  return { error: null, notice: `Způsob dopravy ${result.value.name} uložen.` };
}

export async function deleteMethodAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await requireShippingManager();
  if (denied !== null) return denied;

  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: "Chybí způsob dopravy.", notice: null };

  await deleteMethod(id);
  revalidatePath("/admin/doprava");
  revalidatePath("/kosik");
  return { error: null, notice: "Způsob dopravy smazán." };
}
