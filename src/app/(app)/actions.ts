"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { disconnectAccount, getAccount, getValidAccessToken } from "@/lib/accounts/service";
import { createMediaAsset, createSignedUpload, createSignedUploadUrl, finalizeMediaAsset, thumbnailPathFor, type NewMediaInput } from "@/lib/media/service";
import { createApiKey, revokeApiKey } from "@/lib/mcp/api-keys";
import { getCreatorInfo, type TikTokCreatorInfo } from "@/lib/platforms/tiktok";
import type { CreatePostInput } from "@/lib/posts/schema";
import { cancelPost, createPost, PostValidationError, retryTarget } from "@/lib/posts/service";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const { userId } = await auth.protect();
  try {
    return { ok: true, data: await fn(userId) };
  } catch (err) {
    if (err instanceof PostValidationError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function startUploadAction(input: NewMediaInput) {
  return run(async (userId) => {
    const asset = await createMediaAsset(userId, input);
    const thumbnailPath = thumbnailPathFor(asset);
    const [uploadUrl, thumbnailUploadUrl] = await Promise.all([createSignedUpload(asset), createSignedUploadUrl(thumbnailPath)]);
    return { assetId: asset.id, uploadUrl, thumbnailPath, thumbnailUploadUrl };
  });
}

export async function finishUploadAction(assetId: string, thumbnailPath: string | null) {
  return run(async (userId) => {
    const asset = await finalizeMediaAsset(userId, assetId, { thumbnailPath });
    return { assetId: asset.id };
  });
}

export async function createPostAction(input: CreatePostInput, tiktokMaxDurationS?: number) {
  return run(async (userId) => {
    const post = await createPost(userId, input, "web", { tiktokMaxDurationS });
    revalidatePath("/dashboard");
    revalidatePath("/posts");
    return { postId: post.id };
  });
}

export async function tiktokCreatorInfoAction(accountId: string): Promise<ActionResult<TikTokCreatorInfo>> {
  return run(async (userId) => {
    const account = await getAccount(userId, accountId);
    if (account.platform !== "tiktok") throw new Error("Not a TikTok account");
    return getCreatorInfo(await getValidAccessToken(account));
  });
}

export async function cancelPostAction(postId: string) {
  return run(async (userId) => {
    await cancelPost(userId, postId);
    revalidatePath(`/posts/${postId}`);
    revalidatePath("/posts");
  });
}

export async function retryTargetAction(postId: string, targetId: string) {
  return run(async (userId) => {
    await retryTarget(userId, targetId);
    revalidatePath(`/posts/${postId}`);
  });
}

export async function disconnectAccountAction(accountId: string) {
  return run(async (userId) => {
    await disconnectAccount(userId, accountId);
    revalidatePath("/accounts");
  });
}

export async function createApiKeyAction(name: string) {
  return run(async (userId) => {
    const { key } = await createApiKey(userId, name);
    revalidatePath("/settings");
    return { key };
  });
}

export async function revokeApiKeyAction(id: string) {
  return run(async (userId) => {
    await revokeApiKey(userId, id);
    revalidatePath("/settings");
  });
}
