import { ProviderError } from "../providers/errors";
import { normalizeMinecraftPlayerInput } from "../providers/guards";
import { verifyPlayerGatewayProfileReceipt } from "../providers/player-gateway-auth";

export type ProfileReceiptSaveInput = {
  username: string;
  profileId: string;
  receipt?: unknown;
};

export type VerifiedProfileSave = {
  minecraftUuid: string;
  username: string;
  profileName: string;
  gameMode: string;
  selected: boolean;
  dataState: "complete" | "partial";
  fetchedAt: string;
};

export async function verifiedProfileFromReceipt(
  input: ProfileReceiptSaveInput,
  options: {
    now?: number;
    secret?: string;
  } = {},
): Promise<VerifiedProfileSave> {
  const secret = (options.secret ?? process.env.PLAYER_GATEWAY_SECRET)?.trim();
  if (!secret || secret.length < 32) {
    throw new ProviderError({
      code: "missing_credentials",
      message: "Saved live profiles are not configured for this deployment.",
      status: 503,
      action: "An administrator must configure SkyPilot's profile receipt verifier.",
    });
  }
  if (!input.receipt) {
    throw new ProviderError({
      code: "invalid_input",
      message: "This live profile lookup did not include a save receipt.",
      status: 400,
      action: "Run the live lookup again, then choose Save profile within ten minutes.",
    });
  }
  const receipt = await verifyPlayerGatewayProfileReceipt(
    secret,
    input.receipt,
    options.now ?? Date.now(),
  );
  if (!receipt || receipt.profileId !== input.profileId) {
    throw new ProviderError({
      code: "invalid_input",
      message: "The live profile save receipt is invalid or expired.",
      status: 400,
      action: "Run the live lookup again, then choose Save profile within ten minutes.",
    });
  }
  const selector = normalizeMinecraftPlayerInput(input.username);
  const matchesPlayer = selector.kind === "uuid"
    ? selector.uuid === receipt.playerUuid
    : selector.username.toLowerCase() === receipt.username.toLowerCase();
  if (!matchesPlayer) {
    throw new ProviderError({
      code: "invalid_input",
      message: "The live profile save receipt does not match this player.",
      status: 400,
      action: "Run the live lookup again before saving the profile.",
    });
  }
  return {
    minecraftUuid: receipt.playerUuid,
    username: receipt.username,
    profileName: receipt.profileName,
    gameMode: receipt.gameMode,
    selected: receipt.selected,
    dataState: receipt.dataState,
    fetchedAt: receipt.fetchedAt,
  };
}
