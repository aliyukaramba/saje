"use server";

import { redirect } from "next/navigation";
import { prisma, refundPayment, OrderInputError } from "@restaurant/database";
import { parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../../lib/auth";

function back(orderNumber: string, message: string): never {
  redirect(`/admin/receipts/${encodeURIComponent(orderNumber)}?refund=${encodeURIComponent(message)}`);
}

export async function issueRefund(formData: FormData) {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const staff = await staffWith("refunds:issue");
  if (!staff) redirect("/admin/login");

  const paymentId = String(formData.get("paymentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) back(orderNumber, "Give a reason for the refund (at least 3 characters)");

  let amount: bigint;
  try {
    amount = parseMajorToMinor(String(formData.get("amount") ?? "").replace(/,/g, "").trim());
  } catch {
    back(orderNumber, "Enter the refund amount as a number, for example 1500");
  }

  try {
    await refundPayment(prisma, { paymentId, amount, reason, staffEmail: staff.user.email, staffId: staff.user.id });
  } catch (e) {
    if (e instanceof OrderInputError) back(orderNumber, e.message);
    console.error("refund failed", e);
    back(orderNumber, "The refund could not be saved. Please try again.");
  }
  redirect(`/admin/receipts/${encodeURIComponent(orderNumber)}?refund=done`);
}
